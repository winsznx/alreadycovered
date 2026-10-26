import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { SupportedExtensionSchema, type SupportedExtension } from "@alreadycovered/shared";
import type { SourceRepository } from "../../apps/service/src/db/repositories/sources.js";
import { ingestUploadedFile } from "../../apps/service/src/core/ingest.js";

/**
 * Test-only helper that ingests every supported file in a fixture directory
 * the same way the real upload endpoint does, without going over HTTP. Mirrors
 * routes/sources.ts's upload handler's per-file logic.
 */
export async function reconcileFixtureFiles(
  sources: SourceRepository,
  input: { userId: string; root: string },
): Promise<{ total: number; parsed: number; failed: number }> {
  const entries = await readdir(input.root, { withFileTypes: true });
  let total = 0;
  let parsed = 0;
  let failed = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = extname(entry.name).toLowerCase();
    const parsedExtension = SupportedExtensionSchema.safeParse(extension);
    if (!parsedExtension.success) continue;

    total += 1;
    const absolutePath = join(input.root, entry.name);
    const buffer = await readFile(absolutePath);
    const result = await ingestUploadedFile(sources, {
      userId: input.userId,
      absolutePath,
      storageKey: entry.name,
      displayName: entry.name,
      extension: extension as SupportedExtension,
      buffer,
    });
    if (result.ok) parsed += 1;
    else failed += 1;
  }

  return { total, parsed, failed };
}
