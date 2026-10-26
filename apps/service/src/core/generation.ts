import type { TimetableBlock } from "@alreadycovered/shared";
import type { OllamaClient } from "../ai/ollama.js";
import { buildUserPrompt, PROMPT_VERSION, SYSTEM_PROMPT } from "../ai/prompts.js";
import type { LessonRepository } from "../db/repositories/lessons.js";
import type { ProfileRepository } from "../db/repositories/profiles.js";
import type { SourceRepository } from "../db/repositories/sources.js";
import { computeBlockFingerprint } from "./fingerprint.js";

export type GenerationDeps = {
  profiles: ProfileRepository;
  sources: SourceRepository;
  lessons: LessonRepository;
  ollama: OllamaClient;
};

export type GenerationResult = { ok: true; generatedInstructionId: string } | { ok: false; errorCode: string; message: string };

/**
 * Generates and persists a schema-validated lesson draft for one block. The
 * model is only ever offered the candidate chunk IDs and material IDs
 * already bound to this block's material link - it cannot reference
 * arbitrary files. Every cited ID is re-validated against that bounded set
 * before being trusted.
 */
export async function generateInstructionForBlock(
  deps: GenerationDeps,
  input: { profileId: string; userId: string; localDate: string; block: TimetableBlock },
): Promise<GenerationResult> {
  const profile = await deps.profiles.getProfile(input.profileId);
  if (!profile) return { ok: false, errorCode: "NOT_FOUND", message: "Profile not found." };

  const link = await deps.lessons.getMaterialLink(input.block.id, input.localDate);
  if (!link || !link.sourceFileId || link.status === "ambiguous" || link.status === "missing") {
    return { ok: false, errorCode: "MATCH_MISSING", message: "No confirmed material to generate from." };
  }

  const file = await deps.sources.getByIdForUser(link.sourceFileId, input.userId);
  if (!file || file.status !== "indexed") {
    return { ok: false, errorCode: "SOURCE_FILE_MISSING", message: "The linked file is no longer indexed." };
  }

  const allChunks = await deps.sources.getChunks(file.id);
  const chunks = link.sourceChunkIds.length > 0 ? allChunks.filter((c) => link.sourceChunkIds.includes(c.id)) : allChunks;
  if (chunks.length === 0) {
    return { ok: false, errorCode: "SOURCE_TEXT_NOT_AVAILABLE", message: "The linked file has no usable text." };
  }

  const candidateIds = new Set(chunks.map((c) => c.id));
  const allowedMaterialIds = [file.id];

  const routines = (await deps.profiles.getRoutines(input.profileId))
    .filter((r) => r.includeInPacket && r.teacherVerifiedAt)
    .map((r) => ({ title: r.title, text: r.text }));

  const userPrompt = buildUserPrompt({
    profileLabel: profile.label,
    localDate: input.localDate,
    timeBlock: { subject: input.block.subject, startMinute: input.block.startMinute, endMinute: input.block.endMinute },
    candidateSources: chunks.slice(0, 12).map((c) => ({ id: c.id, fileId: file.id, heading: c.heading, page: c.pageStart, excerpt: c.text })),
    allowedMaterialIds,
    verifiedRoutines: routines,
  });

  const response = await deps.ollama.generateLessonDraft(SYSTEM_PROMPT, userPrompt);
  if (!response.ok) {
    return { ok: false, errorCode: response.errorCode, message: response.message };
  }

  const draft = response.draft;

  const groundedCitedChunkIds = draft.citedChunkIds.filter((id) => candidateIds.has(id));
  const groundedMaterialIds = draft.requiredMaterialIds.filter((id) => allowedMaterialIds.includes(id));
  const ungroundedCount = draft.citedChunkIds.length - groundedCitedChunkIds.length;
  const unansweredQuestions = [...draft.unansweredQuestions];
  if (ungroundedCount > 0) {
    unansweredQuestions.push(`The model referenced ${ungroundedCount} source citation(s) outside the provided material; they were removed and should be reviewed.`);
  }

  const blockFingerprint = computeBlockFingerprint({
    timetableBlockId: input.block.id,
    sourceFileSha256: file.sha256,
    chunkShas: chunks.map((c) => c.chunkSha256),
  });

  const saved = await deps.lessons.saveGeneratedInstruction({
    timetableBlockId: input.block.id,
    localDate: input.localDate,
    lessonTitle: draft.lessonTitle,
    summary: draft.summary,
    steps: draft.steps,
    requiredMaterialFileIds: groundedMaterialIds,
    citedChunkIds: groundedCitedChunkIds,
    unsupportedQuestions: unansweredQuestions,
    modelTag: response.rawModelTag,
    promptVersion: PROMPT_VERSION,
    sourceFingerprint: blockFingerprint,
  });

  return { ok: true, generatedInstructionId: saved.id };
}
