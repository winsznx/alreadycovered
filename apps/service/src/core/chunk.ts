import type { ExtractedSection } from "./extract.js";
import { sha256Hex } from "./hash.js";

export const MAX_CHUNK_CHARS = 1200;

export type DraftChunk = {
  ordinal: number;
  heading?: string;
  pageStart?: number;
  pageEnd?: number;
  text: string;
  chunkSha256: string;
};

/** Splits extracted sections into bounded, stable chunks for retrieval + model context. */
export function chunkSections(sections: ExtractedSection[]): DraftChunk[] {
  const chunks: DraftChunk[] = [];
  let ordinal = 0;

  for (const section of sections) {
    const words = section.text.split(/\s+/);
    let buffer: string[] = [];

    const flush = () => {
      if (buffer.length === 0) return;
      const text = buffer.join(" ").trim();
      if (text.length > 0) {
        chunks.push({
          ordinal,
          heading: section.heading,
          pageStart: section.pageStart,
          pageEnd: section.pageEnd,
          text,
          chunkSha256: sha256Hex(text),
        });
        ordinal += 1;
      }
      buffer = [];
    };

    for (const word of words) {
      const candidateLength = buffer.join(" ").length + word.length + 1;
      if (candidateLength > MAX_CHUNK_CHARS && buffer.length > 0) {
        flush();
      }
      buffer.push(word);
    }
    flush();
  }

  return chunks;
}
