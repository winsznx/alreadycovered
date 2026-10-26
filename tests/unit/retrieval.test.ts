import { describe, expect, it } from "vitest";
import { shortlistCandidates } from "../../apps/service/src/core/retrieval.js";
import type { SourceChunk, SourceFile } from "@alreadycovered/shared";

function mkFile(id: string, displayName: string): SourceFile {
  return { id, relativePath: displayName, displayName, extension: ".md", sizeBytes: 10, sha256: "a".repeat(64), mtimeMs: 0, status: "indexed" };
}
function mkChunk(id: string, sourceFileId: string, text: string): SourceChunk {
  return { id, sourceFileId, sourceSha256: "a".repeat(64), ordinal: 0, text, chunkSha256: "b".repeat(64) };
}

describe("shortlistCandidates", () => {
  it("matches a fractions worksheet to the subject 'Mathematics' via synonyms, not a literal word match", () => {
    // #given a file whose text never contains the word "mathematics"
    const file = mkFile("file1", "fractions-worksheet.pdf");
    const chunk = mkChunk("chunk1", "file1", "Shade three 1/4 strips and write the resulting fraction.");
    // #when shortlisting candidates for the subject "Mathematics"
    const { candidates } = shortlistCandidates({
      subject: "Mathematics",
      sources: [file],
      chunksByFileId: new Map([["file1", [chunk]]]),
    });
    // #then the fractions file is found despite never saying "mathematics"
    expect(candidates.map((c) => c.fileId)).toContain("file1");
  });

  it("returns no candidates when nothing matches the subject at all", () => {
    // #given a file about an unrelated subject
    const file = mkFile("file1", "chapter6-reading-notes.docx");
    const chunk = mkChunk("chunk1", "file1", "Students summarize the chapter and discuss the protagonist.");
    // #when shortlisting candidates for "Science"
    const { candidates } = shortlistCandidates({
      subject: "Science",
      sources: [file],
      chunksByFileId: new Map([["file1", [chunk]]]),
    });
    // #then nothing is proposed rather than a false-positive guess
    expect(candidates).toHaveLength(0);
  });

  it("weighs a filename match higher than an incidental body-text match", () => {
    // #given one file whose name matches the subject and another that only mentions it once in passing
    const namedFile = mkFile("file1", "science-lab-notes.md");
    const incidentalFile = mkFile("file2", "reading-notes.md");
    const namedChunk = mkChunk("chunk1", "file1", "Observe the reaction and record results.");
    const incidentalChunk = mkChunk("chunk2", "file2", "Mention science only once, briefly, in passing.");
    // #when shortlisting candidates for "Science"
    const { candidates } = shortlistCandidates({
      subject: "Science",
      sources: [namedFile, incidentalFile],
      chunksByFileId: new Map([
        ["file1", [namedChunk]],
        ["file2", [incidentalChunk]],
      ]),
    });
    // #then the filename-matching file ranks first
    expect(candidates[0]?.fileId).toBe("file1");
  });

  it("never mixes candidate chunks from more than one file, even when another file's chunk scores higher", () => {
    // #given two different files that each contain subject-matching chunks,
    // with the second file's single chunk scoring higher than any individual
    // chunk in the first file (but the first file wins overall via a
    // filename match) - a real production bug let these get mixed into one
    // candidate list while the material link recorded only one sourceFileId,
    // corrupting the fingerprint used to find the cached generated instruction
    // later (see internal/VALIDATION.md).
    const strongFile = mkFile("file1", "fractions-worksheet.pdf");
    const weakFile = mkFile("file2", "fractions-notes.md");
    const strongChunks = [mkChunk("chunk1", "file1", "Shade the unit fractions."), mkChunk("chunk2", "file1", "Write the resulting fraction.")];
    const weakChunks = [mkChunk("chunk3", "file2", "fractions fractions fractions fractions fractions")];
    // #when shortlisting candidates for "Mathematics"
    const { candidates } = shortlistCandidates({
      subject: "Mathematics",
      sources: [strongFile, weakFile],
      chunksByFileId: new Map([
        ["file1", strongChunks],
        ["file2", weakChunks],
      ]),
    });
    // #then every returned candidate belongs to exactly one file
    const distinctFileIds = new Set(candidates.map((c) => c.fileId));
    expect(distinctFileIds.size).toBe(1);
  });

  it("honors a pinned file regardless of keyword score", () => {
    // #given two files, neither matching the subject by keyword
    const file1 = mkFile("file1", "unrelated.md");
    const file2 = mkFile("file2", "also-unrelated.md");
    const chunk1 = mkChunk("chunk1", "file1", "Nothing relevant here.");
    // #when a specific file is pinned
    const { candidates } = shortlistCandidates({
      subject: "Mathematics",
      sources: [file1, file2],
      chunksByFileId: new Map([["file1", [chunk1]]]),
      pinnedFileId: "file1",
    });
    // #then only the pinned file's chunks are returned
    expect(candidates.every((c) => c.fileId === "file1")).toBe(true);
  });
});
