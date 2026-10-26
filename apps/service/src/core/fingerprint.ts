import { sha256Hex } from "./hash.js";

/**
 * A packet's sourceFingerprint hashes everything that, if changed, must
 * invalidate a teacher's review (PRD §7.3): schedule/routines revisions,
 * referenced file hashes, linked chunk hashes, and the overrides revision tag.
 */
export function computeSourceFingerprint(parts: {
  scheduleRevision: number;
  routinesRevision: number;
  overridesRevisionTag: string;
  blockFingerprints: string[];
}): string {
  const material = [
    `schedule:${parts.scheduleRevision}`,
    `routines:${parts.routinesRevision}`,
    `overrides:${parts.overridesRevisionTag}`,
    ...parts.blockFingerprints.sort(),
  ].join("|");
  return `sha256:${sha256Hex(material)}`;
}

export function computeBlockFingerprint(parts: {
  timetableBlockId: string;
  sourceFileSha256: string | null;
  chunkShas: string[];
}): string {
  const material = [parts.timetableBlockId, parts.sourceFileSha256 ?? "none", ...parts.chunkShas.sort()].join("|");
  return sha256Hex(material);
}
