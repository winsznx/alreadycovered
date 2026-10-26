import { describe, expect, it } from "vitest";
import { chunkSections, MAX_CHUNK_CHARS } from "../../apps/service/src/core/chunk.js";

describe("chunkSections", () => {
  it("keeps a short section as a single chunk", () => {
    // #given one short section
    const chunks = chunkSections([{ heading: "Intro", pageStart: 1, pageEnd: 1, text: "A short lesson note." }]);
    // #when / #then it produces exactly one chunk with the original text
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe("A short lesson note.");
  });

  it("splits a long section into multiple bounded chunks", () => {
    // #given a section far longer than the max chunk size
    const longText = Array.from({ length: 2000 }, (_, i) => `word${i}`).join(" ");
    // #when chunking it
    const chunks = chunkSections([{ text: longText }]);
    // #then every chunk stays within the configured character bound
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 50);
    }
  });

  it("assigns strictly increasing ordinals across sections", () => {
    // #given two short sections
    const chunks = chunkSections([{ text: "First." }, { text: "Second." }]);
    // #when / #then ordinals increase monotonically
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1]);
  });

  it("produces a stable sha256 for identical chunk text", () => {
    // #given the same text chunked twice independently
    const a = chunkSections([{ text: "Same content." }]);
    const b = chunkSections([{ text: "Same content." }]);
    // #when / #then their chunk hashes match
    expect(a[0]!.chunkSha256).toBe(b[0]!.chunkSha256);
  });
});
