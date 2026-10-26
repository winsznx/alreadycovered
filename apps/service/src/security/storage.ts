import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { resolveWithinRoot } from "./paths.js";

/**
 * Per-tenant disk storage root. Every user's uploads and exports live under
 * their own subdirectory of STORAGE_ROOT; nothing is ever addressed by a
 * client-supplied raw path - only by a database-issued ID resolved here,
 * with the same symlink/traversal containment used for the old local-folder
 * model (security/paths.ts), now protecting tenant isolation on shared disk
 * instead of protecting a single teacher's folder boundary.
 */
function getStorageRoot(): string {
  const root = process.env.STORAGE_ROOT ?? join(process.cwd(), ".local-storage");
  mkdirSync(root, { recursive: true });
  return root;
}

export function getUserStorageDir(userId: string): string {
  const dir = join(getStorageRoot(), "users", userId);
  mkdirSync(join(dir, "uploads"), { recursive: true });
  mkdirSync(join(dir, "exports"), { recursive: true });
  return dir;
}

export function getUploadsDir(userId: string): string {
  return join(getUserStorageDir(userId), "uploads");
}

export function getExportsDir(userId: string): string {
  return join(getUserStorageDir(userId), "exports");
}

/** Resolves a stored-file's storageKey (relative to that user's dir) to a safe absolute path. */
export function resolveUserStoragePath(userId: string, storageKey: string): string {
  return resolveWithinRoot(getUserStorageDir(userId), storageKey);
}
