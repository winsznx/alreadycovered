import { z } from "zod";

/**
 * Prompt contract `lesson-draft-v1` (PRD §8.4-8.5).
 * Schema validity is not factual validity — callers must still cross-check
 * citedChunkIds / requiredMaterialIds against the candidate set that was offered.
 */
export const LessonDraftSchema = z
  .object({
    lessonTitle: z.string().max(120),
    summary: z.string().max(600),
    steps: z.array(z.string().min(1).max(400)).min(1).max(12),
    citedChunkIds: z.array(z.string()).max(20),
    requiredMaterialIds: z.array(z.string()).max(20),
    unansweredQuestions: z.array(z.string().max(200)).max(12),
  })
  .strict();
export type LessonDraft = z.infer<typeof LessonDraftSchema>;

export const PROMPT_VERSION = "lesson-draft-v1";

export const CandidateSourceSchema = z.object({
  id: z.string(),
  fileId: z.string(),
  heading: z.string().optional(),
  page: z.number().int().positive().optional(),
  excerpt: z.string(),
});
export type CandidateSource = z.infer<typeof CandidateSourceSchema>;

export const LessonDraftRequestSchema = z.object({
  profileLabel: z.string(),
  localDate: z.string(),
  timeBlock: z.object({
    subject: z.string(),
    startMinute: z.number().int(),
    endMinute: z.number().int(),
  }),
  candidateSources: z.array(CandidateSourceSchema).max(12),
  allowedMaterialIds: z.array(z.string()),
  verifiedRoutines: z.array(z.object({ title: z.string(), text: z.string() })).optional(),
});
export type LessonDraftRequest = z.infer<typeof LessonDraftRequestSchema>;

export type ModelHealth = {
  reachable: boolean;
  configuredModel: string;
  installedTag: string | null;
  digest: string | null;
  error: string | null;
  checkedAt: string;
};
