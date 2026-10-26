export const ErrorCodeValues = [
  "FOLDER_NOT_FOUND",
  "FOLDER_NOT_READABLE",
  "FOLDER_NOT_A_DIRECTORY",
  "FOLDER_EMPTY_OR_UNSUPPORTED",
  "FOLDER_ESCAPE_ATTEMPT",
  "SCHEDULE_OVERLAP",
  "SCHEDULE_INVALID_RANGE",
  "SOURCE_FILE_MISSING",
  "SOURCE_FILE_UNREADABLE",
  "SOURCE_PATH_UNAUTHORIZED",
  "SOURCE_UNSUPPORTED_TYPE",
  "SOURCE_TEXT_NOT_AVAILABLE",
  "SOURCE_TOO_LARGE",
  "MODEL_UNAVAILABLE",
  "MODEL_INVALID_RESPONSE",
  "MODEL_TIMEOUT",
  "MATCH_AMBIGUOUS",
  "MATCH_MISSING",
  "PACKET_NOT_FOUND",
  "PACKET_STALE",
  "PACKET_REVISION_MISMATCH",
  "PACKET_HAS_BLOCKING_ISSUES",
  "EXPORT_SOURCE_CHANGED",
  "EXPORT_FAILED",
  "EXPORT_NOT_FOUND",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof ErrorCodeValues)[number];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { statusCode?: number; details?: Record<string, unknown>; retryable?: boolean },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = options?.statusCode ?? 400;
    this.details = options?.details;
    this.retryable = options?.retryable ?? false;
  }

  toJSON(): { error: { code: ErrorCode; message: string; details?: Record<string, unknown>; retryable: boolean } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        retryable: this.retryable,
      },
    };
  }
}
