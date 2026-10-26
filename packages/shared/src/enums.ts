import { z } from "zod";

export const SourceStatusValues = [
  "pending",
  "indexed",
  "unsupported",
  "unreadable",
  "error",
  "deleted",
] as const;
export const SourceStatusSchema = z.enum(SourceStatusValues);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const MatchStatusValues = [
  "proposed",
  "confirmed",
  "rejected",
  "missing",
  "ambiguous",
] as const;
export const MatchStatusSchema = z.enum(MatchStatusValues);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const PacketStateValues = [
  "preparing",
  "needs_attention",
  "ready_for_review",
  "reviewed",
  "stale",
  "failed",
] as const;
export const PacketStateSchema = z.enum(PacketStateValues);
export type PacketState = z.infer<typeof PacketStateSchema>;

export const JobStateValues = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export const JobStateSchema = z.enum(JobStateValues);
export type JobState = z.infer<typeof JobStateSchema>;

export const JobTypeValues = [
  "scan",
  "extract_file",
  "generate_lesson",
  "export_packet",
] as const;
export const JobTypeSchema = z.enum(JobTypeValues);
export type JobType = z.infer<typeof JobTypeSchema>;

export const ExportPermissionValues = ["approved", "excluded", "unreviewed"] as const;
export const ExportPermissionSchema = z.enum(ExportPermissionValues);
export type ExportPermission = z.infer<typeof ExportPermissionSchema>;

export const RoutineCategoryValues = [
  "arrival",
  "transitions",
  "materials",
  "dismissal",
  "other",
] as const;
export const RoutineCategorySchema = z.enum(RoutineCategoryValues);
export type RoutineCategory = z.infer<typeof RoutineCategorySchema>;

export const IssueSeverityValues = ["warning", "blocking"] as const;
export const IssueSeveritySchema = z.enum(IssueSeverityValues);
export type IssueSeverity = z.infer<typeof IssueSeveritySchema>;

export const SupportedExtensionValues = [".pdf", ".docx", ".txt", ".md"] as const;
export const SupportedExtensionSchema = z.enum(SupportedExtensionValues);
export type SupportedExtension = z.infer<typeof SupportedExtensionSchema>;
