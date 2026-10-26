import { realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { AppError } from "@alreadycovered/shared";

const IGNORED_SEGMENT_PATTERN = /^(\.git|\.AlreadyCovered|node_modules|\$RECYCLE\.BIN|\.DS_Store)$/i;
const IGNORED_SUFFIX_PATTERN = /\.(tmp|lock|crdownload|part)$/i;

export function isIgnoredSegment(segment: string): boolean {
  return IGNORED_SEGMENT_PATTERN.test(segment) || segment.startsWith("~$") || segment.startsWith(".~");
}

export function isIgnoredFileName(name: string): boolean {
  return IGNORED_SUFFIX_PATTERN.test(name) || name.startsWith(".");
}

/**
 * Validates a teacher-submitted absolute root path: must exist, be readable,
 * be a real directory, and resolve to a canonical realpath with no symlink
 * trickery. Returns the canonical absolute path.
 */
export function validateAuthorizedRoot(rawPath: string): string {
  if (!rawPath || typeof rawPath !== "string") {
    throw new AppError("VALIDATION_ERROR", "A teaching-folder path is required.");
  }
  const trimmed = rawPath.trim();
  if (!isAbsolute(trimmed)) {
    throw new AppError("FOLDER_NOT_FOUND", "Please provide an absolute folder path.");
  }

  let stat;
  try {
    stat = statSync(trimmed);
  } catch {
    throw new AppError("FOLDER_NOT_FOUND", "That folder could not be found on this computer.");
  }

  if (!stat.isDirectory()) {
    throw new AppError("FOLDER_NOT_A_DIRECTORY", "That path exists but is not a folder.");
  }

  let canonical: string;
  try {
    canonical = realpathSync(trimmed);
  } catch {
    throw new AppError("FOLDER_NOT_READABLE", "That folder exists but could not be read.");
  }

  try {
    // Confirm read access by attempting to stat the canonical path again.
    statSync(canonical);
  } catch {
    throw new AppError("FOLDER_NOT_READABLE", "That folder could not be read.");
  }

  return canonical;
}

/**
 * Resolves a relative path against a canonical root and guarantees the
 * result stays inside the root, following symlinks. Throws on any escape
 * attempt (traversal, symlink pointing outside root, etc).
 */
export function resolveWithinRoot(canonicalRoot: string, relativePath: string): string {
  const candidate = resolve(canonicalRoot, relativePath);
  const relativeToRoot = relative(canonicalRoot, candidate);
  if (relativeToRoot.startsWith("..") || isAbsolute(relativeToRoot)) {
    throw new AppError("FOLDER_ESCAPE_ATTEMPT", "Refused to access a path outside the authorised folder.", {
      statusCode: 403,
    });
  }

  let realCandidate: string;
  try {
    realCandidate = realpathSync(candidate);
  } catch {
    throw new AppError("SOURCE_FILE_MISSING", "That file is no longer available.", { statusCode: 404 });
  }

  const realRoot = realpathSync(canonicalRoot);
  const containment = relative(realRoot, realCandidate);
  if (containment.startsWith("..") || isAbsolute(containment)) {
    throw new AppError("FOLDER_ESCAPE_ATTEMPT", "Refused to access a path outside the authorised folder.", {
      statusCode: 403,
    });
  }

  return realCandidate;
}

export function toPosixRelative(root: string, absolutePath: string): string {
  const rel = relative(root, absolutePath);
  return rel.split(sep).join("/");
}

export function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return !rel.startsWith("..") && !isAbsolute(rel);
}

/** Sanitises a filename for safe use inside an export ZIP (no traversal, no device names). */
export function sanitizeArchiveEntryName(name: string): string {
  const stripped = name.replace(/[\\/]+/g, "_").replace(/\.\./g, "_").trim();
  const safe = stripped.length > 0 ? stripped : "file";
  return safe.replace(/^[.]+/, "_");
}

export function assertSafeJoin(base: string, ...segments: string[]): string {
  const target = join(base, ...segments);
  if (!isWithin(base, target)) {
    throw new AppError("FOLDER_ESCAPE_ATTEMPT", "Refused unsafe path join.", { statusCode: 403 });
  }
  return target;
}
