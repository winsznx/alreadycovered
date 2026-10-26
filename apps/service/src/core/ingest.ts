import type { SupportedExtension } from "@alreadycovered/shared";
import type { SourceRepository } from "../db/repositories/sources.js";
import { chunkSections } from "./chunk.js";
import { extractSource } from "./extract.js";
import { sha256Hex } from "./hash.js";

export type IngestResult = { ok: true; sourceId: string } | { ok: false; sourceId: string; errorCode: string };

/**
 * Indexes one freshly-uploaded file (replaces the old local-folder watcher +
 * reconciliation loop: an upload is a discrete event, so there's nothing to
 * debounce or reconcile - we just extract and chunk it immediately).
 */
export async function ingestUploadedFile(
  sources: SourceRepository,
  input: { userId: string; absolutePath: string; storageKey: string; displayName: string; extension: SupportedExtension; buffer: Buffer },
): Promise<IngestResult> {
  const sha256 = sha256Hex(input.buffer);
  const source = await sources.create({
    userId: input.userId,
    storageKey: input.storageKey,
    displayName: input.displayName,
    extension: input.extension,
    sizeBytes: input.buffer.length,
    sha256,
  });

  const extraction = await extractSource(input.absolutePath, input.extension);
  if (!extraction.ok) {
    await sources.markStatus(source.id, extraction.errorCode === "SOURCE_TEXT_NOT_AVAILABLE" ? "unreadable" : "error", extraction.errorCode);
    return { ok: false, sourceId: source.id, errorCode: extraction.errorCode };
  }

  const chunks = chunkSections(extraction.sections);
  await sources.replaceChunks(source.id, sha256, chunks);
  await sources.markStatus(source.id, "indexed");
  return { ok: true, sourceId: source.id };
}
