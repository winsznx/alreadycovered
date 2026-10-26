import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import { AppError, type ExportRecord } from "@alreadycovered/shared";
import type { AssembledPacket } from "../core/readiness.js";
import type { LessonRepository } from "../db/repositories/lessons.js";
import type { ProfileRepository } from "../db/repositories/profiles.js";
import type { SourceRepository } from "../db/repositories/sources.js";
import { getExportsDir, resolveUserStoragePath } from "../security/storage.js";
import { sha256Hex } from "../core/hash.js";
import { buildMaterialsManifest, writePacketZip } from "./renderZip.js";
import { renderPacketPdf, type PacketPdfBlock } from "./renderPdf.js";
import type { Manifest } from "./manifest.js";

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
}

export type ExportDeps = {
  profiles: ProfileRepository;
  sources: SourceRepository;
  lessons: LessonRepository;
};

export type ExportOutcome = { ok: true; record: ExportRecord } | { ok: false; errorCode: string; message: string };

/**
 * Builds the real PDF + ZIP + manifest for an assembled packet. Revalidates
 * every material against the live source index immediately before writing
 * so a file deleted mid-export cannot silently succeed. Files are written
 * under this user's own exports directory (security/storage.ts) and
 * referenced afterward only by storage key, never a client-supplied path.
 */
export async function exportPacket(
  deps: ExportDeps,
  input: { profileId: string; userId: string; localDate: string; assembled: AssembledPacket; confirmWithWarnings: boolean },
): Promise<ExportOutcome> {
  const profile = await deps.profiles.getProfile(input.profileId);
  if (!profile) return { ok: false, errorCode: "NOT_FOUND", message: "Profile not found." };

  const hasIssues = input.assembled.issues.length > 0;
  if (hasIssues && !input.confirmWithWarnings) {
    return { ok: false, errorCode: "PACKET_HAS_BLOCKING_ISSUES", message: "This packet still has unresolved items. Export with warnings to continue." };
  }

  const pdfBlocks: PacketPdfBlock[] = [];
  const materialInputs: Array<{ absolutePath: string; expectedSha256: string; subject: string; sourceRelativePath: string; attributionText?: string; orderIndex: number }> = [];
  const omitted: Array<{ subject: string; reason: string }> = [];
  let orderIndex = 1;

  for (const block of input.assembled.blocks) {
    const link = block.materialLinkId ? await deps.lessons.getMaterialLinkById(block.materialLinkId) : null;
    const generated = block.generatedInstructionId
      ? await deps.lessons.getGeneratedInstruction(block.timetableBlock.id, input.localDate, block.blockFingerprint)
      : null;

    const file = link?.sourceFileId ? await deps.sources.getByIdForUser(link.sourceFileId, input.userId) : null;
    const fileValid = !!file && file.status === "indexed";

    let materialsLabel: string | null = null;
    let sourceReference: string | null = null;
    const unresolved: string[] = [];

    if (link && fileValid && file) {
      if (link.exportPermission === "approved") {
        materialInputs.push({
          absolutePath: resolveUserStoragePath(input.userId, join("uploads", file.relativePath)),
          expectedSha256: file.sha256,
          subject: block.timetableBlock.subject,
          sourceRelativePath: file.relativePath,
          attributionText: link.attributionText,
          orderIndex: orderIndex++,
        });
        materialsLabel = file.displayName;
      } else {
        omitted.push({
          subject: block.timetableBlock.subject,
          reason: link.exportPermission === "excluded" ? "Teacher excluded this file from the handover." : "Not yet approved for copying into the handover.",
        });
        unresolved.push(`"${file.displayName}" was not approved for copying - it is referenced but not attached.`);
      }
      const linkedChunks = link.sourceChunkIds.length > 0 ? await deps.sources.getChunksByIds(link.sourceChunkIds) : [];
      const chunk = linkedChunks[0];
      sourceReference = chunk?.pageStart ? `${file.displayName}, page ${chunk.pageStart}` : chunk?.heading ? `${file.displayName}, ${chunk.heading}` : file.displayName;
    } else if (link?.status === "ambiguous") {
      unresolved.push("Multiple files matched this lesson; the teacher must choose one.");
    } else {
      unresolved.push("No material is linked to this lesson.");
    }

    if (!generated) unresolved.push("Substitute-facing instructions were not available at export time.");

    pdfBlocks.push({
      subject: block.timetableBlock.subject,
      startLabel: minutesToLabel(block.timetableBlock.startMinute),
      endLabel: minutesToLabel(block.timetableBlock.endMinute),
      lessonTitle: generated?.lessonTitle ?? null,
      objective: generated?.summary ?? null,
      steps: generated?.steps ?? [],
      materialsLabel,
      sourceReference,
      unresolved,
    });
  }

  const manifestResult = await buildMaterialsManifest(materialInputs);
  if (!manifestResult.ok) {
    return { ok: false, errorCode: "EXPORT_SOURCE_CHANGED", message: `"${manifestResult.mismatchedPath}" changed during export. Export cancelled - please try again.` };
  }

  const routines = (await deps.profiles.getRoutines(input.profileId)).filter((r) => r.includeInPacket && r.teacherVerifiedAt);
  const needsAttention = input.assembled.issues.map((i) => i.humanMessage);

  const pdfBuffer = await renderPacketPdf({
    classLabel: profile.label,
    dateLabel: input.localDate,
    teacherDisplayName: profile.teacherDisplayName,
    preparedAtLabel: new Date().toLocaleString("en-US", { timeZone: profile.timezone }),
    revision: input.assembled.revision,
    statusLabel: hasIssues ? "Exported with warnings" : "Reviewed",
    exportedWithWarnings: hasIssues,
    blocks: pdfBlocks,
    routines: routines.map((r) => ({ title: r.title, text: r.text })),
    needsAttention,
  });

  const manifest: Manifest = {
    productVersion: "0.2.0",
    classLabel: profile.label,
    localDate: input.localDate,
    packetRevision: input.assembled.revision,
    exportedWithWarnings: hasIssues,
    createdAt: new Date().toISOString(),
    materials: manifestResult.entries.map((e) => ({
      archivePath: e.archivePath,
      sourceRelativePath: e.sourceRelativePath,
      sha256: e.sha256,
      sizeBytes: e.sizeBytes,
      citedForSubject: e.citedForSubject,
      attributionText: e.attributionText,
    })),
    omitted,
  };

  const exportId = ulid();
  const exportDir = join(getExportsDir(input.userId), input.localDate, exportId);
  const tmpDir = `${exportDir}.tmp`;
  await mkdir(tmpDir, { recursive: true });

  try {
    const safeClassLabel = profile.label.replace(/[^a-z0-9]+/gi, "_");
    const pdfName = `AlreadyCovered_${safeClassLabel}_${input.localDate}.pdf`;
    const zipName = `AlreadyCovered_${safeClassLabel}_${input.localDate}.zip`;
    await writeFile(join(tmpDir, pdfName), pdfBuffer);

    const readmeText = [
      "AlreadyCovered substitute packet",
      `Class: ${profile.label}`,
      `Date: ${input.localDate}`,
      hasIssues ? "This export contains unresolved items - see manifest.json and the PDF's first page." : "This packet was reviewed by the teacher before export.",
    ].join("\n");

    await writePacketZip(join(tmpDir, zipName), pdfBuffer, manifest, manifestResult.entries.map((e) => ({ archivePath: e.archivePath, buffer: e.buffer })), readmeText);

    await rename(tmpDir, exportDir);

    const manifestSha256 = sha256Hex(JSON.stringify(manifest));
    const record: ExportRecord = {
      id: exportId,
      packetId: input.assembled.packetId,
      packetRevision: input.assembled.revision,
      pdfStorageKey: join(input.localDate, exportId, pdfName),
      zipStorageKey: join(input.localDate, exportId, zipName),
      manifestSha256,
      exportedWithWarnings: hasIssues,
      createdAt: new Date().toISOString(),
    };
    return { ok: true, record };
  } catch (error) {
    await rm(tmpDir, { recursive: true, force: true });
    throw new AppError("EXPORT_FAILED", error instanceof Error ? error.message : "Export failed.", { statusCode: 500 });
  }
}
