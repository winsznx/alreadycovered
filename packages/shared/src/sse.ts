import { z } from "zod";

export const SseEventTypeValues = [
  "scan.started",
  "scan.progress",
  "scan.completed",
  "file.indexed",
  "file.failed",
  "source.deleted",
  "lesson.generating",
  "lesson.generated",
  "packet.stale",
  "packet.updated",
  "job.failed",
  "export.completed",
  "model.unavailable",
  "model.available",
] as const;
export const SseEventTypeSchema = z.enum(SseEventTypeValues);
export type SseEventType = z.infer<typeof SseEventTypeSchema>;

export const SseEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  type: SseEventTypeSchema,
  jobId: z.string().optional(),
  packetId: z.string().optional(),
  timestamp: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type SseEvent = z.infer<typeof SseEventSchema>;
