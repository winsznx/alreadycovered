import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { sanitizeArchiveEntryName } from "../security/paths.js";
import { sha256Hex } from "../core/hash.js";
import type { Manifest, ManifestEntry } from "./manifest.js";

export type ZipMaterialInput = {
  absolutePath: string;
  expectedSha256: string;
  subject: string;
  sourceRelativePath: string;
  attributionText?: string;
  orderIndex: number;
};

/**
 * Re-opens and re-hashes every file immediately before writing it into the
 * archive (PRD §11.3) and aborts the whole export if any file no longer
 * matches the packet snapshot - protects against a source changing mid-export.
 */
export async function buildMaterialsManifest(materials: ZipMaterialInput[]): Promise<
  | { ok: true; entries: Array<ManifestEntry & { absolutePath: string; buffer: Buffer }> }
  | { ok: false; mismatchedPath: string }
> {
  const entries: Array<ManifestEntry & { absolutePath: string; buffer: Buffer }> = [];
  for (const material of materials) {
    const buffer = await readFile(material.absolutePath);
    const actualSha256 = sha256Hex(buffer);
    if (actualSha256 !== material.expectedSha256) {
      return { ok: false, mismatchedPath: material.sourceRelativePath };
    }
    const ext = material.sourceRelativePath.includes(".") ? material.sourceRelativePath.split(".").pop() : "";
    const base = sanitizeArchiveEntryName(`${String(material.orderIndex).padStart(2, "0")}_${material.subject}`);
    const archivePath = `Materials/${base}${ext ? `.${ext}` : ""}`;
    entries.push({
      archivePath,
      sourceRelativePath: material.sourceRelativePath,
      sha256: actualSha256,
      sizeBytes: buffer.length,
      citedForSubject: material.subject,
      attributionText: material.attributionText,
      absolutePath: material.absolutePath,
      buffer,
    });
  }
  return { ok: true, entries };
}

export async function writePacketZip(
  destinationPath: string,
  pdfBuffer: Buffer,
  manifest: Manifest,
  materials: Array<{ archivePath: string; buffer: Buffer }>,
  readmeText: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(destinationPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    archive.append(pdfBuffer, { name: "00_Substitute_Plan.pdf" });
    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    archive.append(readmeText, { name: "README.txt" });
    for (const material of materials) {
      archive.append(material.buffer, { name: material.archivePath });
    }

    void archive.finalize();
  });
}
