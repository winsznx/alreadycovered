import type { ModelHealth, SourceFile } from "@alreadycovered/shared";

export type HealthResponse = {
  service: string;
  buildVersion: string;
  sqlite: string;
  watcher: string;
  ollama: string;
  modelHealth: ModelHealth;
};

export type SettingsResponse =
  | { setupComplete: false; modelHealth: ModelHealth }
  | {
      setupComplete: true;
      profile: { id: string; label: string; grade: string; timezone: string; locale: string; teacherDisplayName?: string };
      modelHealth: ModelHealth;
    };

export type TimetableBlockView = {
  id: string;
  profileId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  subject: string;
  optionalTeacherNotes?: string;
  enabled: boolean;
};

export type RoutineView = {
  id: string;
  profileId: string;
  category: string;
  title: string;
  text: string;
  teacherVerifiedAt: string | null;
  includeInPacket: boolean;
};

export type SourcesResponse = { sources: SourceFile[] };

export type JobView = {
  id: string;
  type: string;
  state: string;
  stage?: string;
  processedCount?: number;
  totalCount?: number;
  errorMessage?: string;
  retryable?: boolean;
};

export type IssueView = {
  id: string;
  blockId?: string;
  code: string;
  severity: "warning" | "blocking";
  humanMessage: string;
};

export type PacketBlockView = {
  timetableBlockId: string;
  subject: string;
  startMinute: number;
  endMinute: number;
  materialLink: {
    id: string;
    status: string;
    sourceFileId: string | null;
    sourceFileName: string | null;
    exportPermission: string;
    selectedBy: string;
  } | null;
  instruction: {
    id: string;
    lessonTitle: string;
    summary: string;
    steps: string[];
    unsupportedQuestions: string[];
    modelTag: string;
    citedChunkIds: string[];
  } | null;
  needsGeneration: boolean;
};

export type PacketView = {
  packetId: string;
  profileId: string;
  localDate: string;
  revision: number;
  state: string;
  sourceFingerprint: string;
  blocks: PacketBlockView[];
  issues: IssueView[];
};
