import { z } from "zod";
import {
  ExportPermissionSchema,
  IssueSeveritySchema,
  JobStateSchema,
  JobTypeSchema,
  MatchStatusSchema,
  PacketStateSchema,
  RoutineCategorySchema,
  SourceStatusSchema,
  SupportedExtensionSchema,
} from "./enums.js";

export const ClassProfileSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(120),
  grade: z.string().min(1).max(40),
  timezone: z.string().min(1),
  locale: z.string().min(1),
  teacherDisplayName: z.string().max(120).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ClassProfile = z.infer<typeof ClassProfileSchema>;

export const TimetableBlockSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  weekday: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  subject: z.string().min(1).max(120),
  optionalTeacherNotes: z.string().max(500).optional(),
  enabled: z.boolean(),
});
export type TimetableBlock = z.infer<typeof TimetableBlockSchema>;

export const DateOverrideSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  localDate: z.string(), // ISO yyyy-mm-dd
  kind: z.enum(["no_school", "block_override"]),
  blocks: z.array(TimetableBlockSchema.omit({ id: true, profileId: true, weekday: true })).optional(),
});
export type DateOverride = z.infer<typeof DateOverrideSchema>;

export const SourceFileSchema = z.object({
  id: z.string(),
  relativePath: z.string().min(1),
  displayName: z.string().min(1),
  extension: SupportedExtensionSchema,
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().length(64),
  mtimeMs: z.number(),
  status: SourceStatusSchema,
  errorCode: z.string().optional(),
  indexedAt: z.string().optional(),
});
export type SourceFile = z.infer<typeof SourceFileSchema>;

export const SourceChunkSchema = z.object({
  id: z.string(),
  sourceFileId: z.string(),
  sourceSha256: z.string().length(64),
  ordinal: z.number().int().nonnegative(),
  heading: z.string().optional(),
  pageStart: z.number().int().positive().optional(),
  pageEnd: z.number().int().positive().optional(),
  text: z.string(),
  chunkSha256: z.string().length(64),
});
export type SourceChunk = z.infer<typeof SourceChunkSchema>;

export const ClassroomRoutineSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  category: RoutineCategorySchema,
  title: z.string().min(1).max(120),
  text: z.string().min(1).max(2000),
  teacherVerifiedAt: z.string().nullable(),
  includeInPacket: z.boolean(),
});
export type ClassroomRoutine = z.infer<typeof ClassroomRoutineSchema>;

export const MaterialLinkSchema = z.object({
  id: z.string(),
  timetableBlockId: z.string(),
  localDate: z.string(),
  sourceFileId: z.string().nullable(),
  sourceChunkIds: z.array(z.string()),
  status: MatchStatusSchema,
  rationale: z.string().max(400),
  selectedBy: z.enum(["model", "teacher", "rule"]),
  confirmedAt: z.string().optional(),
  expectedLabel: z.string().optional(),
  exportPermission: ExportPermissionSchema,
  attributionText: z.string().optional(),
});
export type MaterialLink = z.infer<typeof MaterialLinkSchema>;

export const GeneratedInstructionSchema = z.object({
  id: z.string(),
  timetableBlockId: z.string(),
  localDate: z.string(),
  lessonTitle: z.string().max(120),
  summary: z.string().max(600),
  steps: z.array(z.string().min(1).max(400)),
  requiredMaterialFileIds: z.array(z.string()),
  citedChunkIds: z.array(z.string()),
  unsupportedQuestions: z.array(z.string()),
  modelTag: z.string(),
  promptVersion: z.string(),
  createdAt: z.string(),
});
export type GeneratedInstruction = z.infer<typeof GeneratedInstructionSchema>;

export const TeacherOverrideSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  timetableBlockId: z.string(),
  localDate: z.string(),
  field: z.enum(["summary", "steps", "material_link", "note"]),
  valueJson: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: z.literal("local_teacher"),
});
export type TeacherOverride = z.infer<typeof TeacherOverrideSchema>;

export const PacketSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  localDate: z.string(),
  revision: z.number().int().positive(),
  state: PacketStateSchema,
  sourceFingerprint: z.string(),
  reviewedRevision: z.number().int().optional(),
  reviewedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Packet = z.infer<typeof PacketSchema>;

export const IssueSchema = z.object({
  id: z.string(),
  packetId: z.string(),
  blockId: z.string().optional(),
  code: z.string(),
  severity: IssueSeveritySchema,
  humanMessage: z.string(),
  resolvedAt: z.string().optional(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const ExportRecordSchema = z.object({
  id: z.string(),
  packetId: z.string(),
  packetRevision: z.number().int().positive(),
  pdfStorageKey: z.string(),
  zipStorageKey: z.string(),
  manifestSha256: z.string(),
  exportedWithWarnings: z.boolean(),
  createdAt: z.string(),
});
export type ExportRecord = z.infer<typeof ExportRecordSchema>;

export const JobSchema = z.object({
  id: z.string(),
  type: JobTypeSchema,
  state: JobStateSchema,
  payloadJson: z.unknown(),
  stage: z.string().optional(),
  processedCount: z.number().int().nonnegative().optional(),
  totalCount: z.number().int().nonnegative().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  retryable: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Job = z.infer<typeof JobSchema>;
