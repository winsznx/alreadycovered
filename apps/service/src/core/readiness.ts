import { AppError, type Issue, type PacketState, type TimetableBlock } from "@alreadycovered/shared";
import type { ProfileRepository } from "../db/repositories/profiles.js";
import type { SourceRepository } from "../db/repositories/sources.js";
import type { LessonRepository } from "../db/repositories/lessons.js";
import type { PacketRepository } from "../db/repositories/packets.js";
import { computeBlockFingerprint, computeSourceFingerprint } from "./fingerprint.js";
import { shortlistCandidates } from "./retrieval.js";
import { weekdayForDate } from "./schedule.js";

export type AssembledBlock = {
  timetableBlock: TimetableBlock;
  blockFingerprint: string;
  materialLinkId: string | null;
  generatedInstructionId: string | null;
  needsGeneration: boolean;
};

export type AssembledPacket = {
  packetId: string;
  revision: number;
  state: PacketState;
  sourceFingerprint: string;
  blocks: AssembledBlock[];
  issues: Issue[];
};

export type ReadinessDeps = {
  profiles: ProfileRepository;
  sources: SourceRepository;
  lessons: LessonRepository;
  packets: PacketRepository;
};

/**
 * Deterministic packet assembly (never calls the model - readiness is
 * derived from indexed source state, teacher-confirmed links, and existing
 * generated instructions only). Callers that find `needsGeneration` blocks
 * are expected to enqueue generation jobs and re-run assembly after.
 */
export async function assemblePacket(deps: ReadinessDeps, profileId: string, userId: string, localDate: string): Promise<AssembledPacket> {
  const profile = await deps.profiles.getProfile(profileId);
  if (!profile) {
    throw new AppError("NOT_FOUND", "No class profile is configured yet.", { statusCode: 404 });
  }

  const override = await deps.profiles.getDateOverride(profileId, localDate);
  const issues: Issue[] = [];
  let effectiveBlocks: TimetableBlock[];

  if (override?.kind === "no_school") {
    effectiveBlocks = [];
  } else if (override?.kind === "block_override" && override.blocks) {
    effectiveBlocks = override.blocks.map((b, i) => ({
      id: `${localDate}-override-${i}`,
      profileId,
      weekday: weekdayForDate(localDate, profile.timezone) as TimetableBlock["weekday"],
      ...b,
    }));
  } else {
    const weekday = weekdayForDate(localDate, profile.timezone);
    effectiveBlocks = (await deps.profiles.getSchedule(profileId)).filter((b) => b.enabled && b.weekday === weekday);
  }

  const sources = await deps.sources.listActive(userId);
  const chunksByFileId = new Map(await Promise.all(sources.map(async (s) => [s.id, await deps.sources.getChunks(s.id)] as const)));

  const assembledBlocks: AssembledBlock[] = [];
  const blockFingerprints: string[] = [];

  for (const block of effectiveBlocks.sort((a, b) => a.startMinute - b.startMinute)) {
    let link = await deps.lessons.getMaterialLink(block.id, localDate);

    if (!link) {
      const { candidates, ambiguousFileIds } = shortlistCandidates({
        subject: block.subject,
        sources,
        chunksByFileId,
      });
      if (ambiguousFileIds.length > 1) {
        link = await deps.lessons.upsertMaterialLink({
          timetableBlockId: block.id,
          localDate,
          sourceFileId: null,
          sourceChunkIds: [],
          status: "ambiguous",
          rationale: "Multiple files matched this subject equally well.",
          selectedBy: "rule",
        });
      } else if (candidates.length === 0) {
        link = await deps.lessons.upsertMaterialLink({
          timetableBlockId: block.id,
          localDate,
          sourceFileId: null,
          sourceChunkIds: [],
          status: "missing",
          rationale: "No indexed file matched this subject.",
          selectedBy: "rule",
        });
      } else {
        link = await deps.lessons.upsertMaterialLink({
          timetableBlockId: block.id,
          localDate,
          sourceFileId: candidates[0]!.fileId,
          sourceChunkIds: candidates.map((c) => c.id),
          status: "proposed",
          rationale: "Best keyword match against the lesson subject.",
          selectedBy: "rule",
        });
      }
    }

    const linkedFile = link.sourceFileId ? await deps.sources.getByIdForUser(link.sourceFileId, userId) : null;
    const fileStillValid = !!linkedFile && linkedFile.status === "indexed";

    if (link.status === "ambiguous") {
      issues.push(mkIssue(block.id, "MATCH_AMBIGUOUS", "warning", `Two or more files may match "${block.subject}". Choose one to include.`));
    } else if (link.status === "missing" || !link.sourceFileId) {
      issues.push(mkIssue(block.id, "SOURCE_FILE_MISSING", "warning", `No uploaded file is linked to "${block.subject}" yet.`));
    } else if (!fileStillValid) {
      issues.push(mkIssue(block.id, "SOURCE_FILE_MISSING", "blocking", `The file previously linked to "${block.subject}" is no longer available.`));
    }

    const linkedChunks = linkedFile && link.sourceChunkIds.length > 0 ? await deps.sources.getChunksByIds(link.sourceChunkIds) : [];
    const blockFingerprint = computeBlockFingerprint({
      timetableBlockId: block.id,
      sourceFileSha256: fileStillValid ? linkedFile!.sha256 : null,
      chunkShas: linkedChunks.map((c) => c.chunkSha256),
    });
    blockFingerprints.push(blockFingerprint);

    const generated = fileStillValid ? await deps.lessons.getGeneratedInstruction(block.id, localDate, blockFingerprint) : null;

    const needsGeneration = fileStillValid && link.status !== "ambiguous" && !generated;
    if (needsGeneration) {
      issues.push(mkIssue(block.id, "GENERATION_PENDING", "warning", `Substitute instructions for "${block.subject}" have not been generated yet.`));
    }

    assembledBlocks.push({
      timetableBlock: block,
      blockFingerprint,
      materialLinkId: link.id,
      generatedInstructionId: generated?.id ?? null,
      needsGeneration,
    });
  }

  const routines = await deps.profiles.getRoutines(profileId);
  const unverifiedRoutineCount = routines.filter((r) => r.includeInPacket && !r.teacherVerifiedAt).length;
  if (unverifiedRoutineCount > 0) {
    issues.push(mkIssue(undefined, "ROUTINE_NOT_VERIFIED", "warning", `${unverifiedRoutineCount} classroom routine(s) still need your explicit verification.`));
  }

  const sourceFingerprint = computeSourceFingerprint({
    scheduleRevision: profile.scheduleRevision,
    routinesRevision: profile.routinesRevision,
    overridesRevisionTag: await deps.lessons.getAllOverridesRevisionTag(profileId),
    blockFingerprints,
  });

  const existingPacket = await deps.packets.getByProfileAndDate(profileId, localDate);
  const reviewedFingerprint = existingPacket ? await deps.packets.getReviewedFingerprint(existingPacket.id) : null;

  let state: PacketState;
  if (issues.length > 0) {
    state = "needs_attention";
  } else if (reviewedFingerprint === sourceFingerprint) {
    state = "reviewed";
  } else if (reviewedFingerprint !== null) {
    state = "stale";
  } else {
    state = "ready_for_review";
  }

  const packet = await deps.packets.upsertRevision({ profileId, localDate, sourceFingerprint, state });

  await deps.packets.replaceBlocks(
    packet.id,
    assembledBlocks.map((b) => ({
      timetableBlockId: b.timetableBlock.id,
      subject: b.timetableBlock.subject,
      startMinute: b.timetableBlock.startMinute,
      endMinute: b.timetableBlock.endMinute,
      generatedInstructionId: b.generatedInstructionId,
      materialLinkId: b.materialLinkId,
    })),
  );
  await deps.packets.replaceIssues(
    packet.id,
    issues.map((i) => ({ blockId: i.blockId, code: i.code, severity: i.severity, humanMessage: i.humanMessage })),
  );

  return {
    packetId: packet.id,
    revision: packet.revision,
    state,
    sourceFingerprint,
    blocks: assembledBlocks,
    issues: await deps.packets.getIssues(packet.id),
  };
}

function mkIssue(blockId: string | undefined, code: string, severity: Issue["severity"], humanMessage: string): Issue {
  return { id: "", packetId: "", blockId, code, severity, humanMessage };
}
