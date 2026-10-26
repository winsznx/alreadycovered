import { describe, expect, it } from "vitest";
import { computeBlockFingerprint, computeSourceFingerprint } from "../../apps/service/src/core/fingerprint.js";

describe("computeBlockFingerprint", () => {
  it("produces the same fingerprint for the same inputs regardless of chunk order", () => {
    // #given two chunk-hash lists that differ only in order
    const a = computeBlockFingerprint({ timetableBlockId: "block1", sourceFileSha256: "abc", chunkShas: ["x", "y", "z"] });
    const b = computeBlockFingerprint({ timetableBlockId: "block1", sourceFileSha256: "abc", chunkShas: ["z", "y", "x"] });
    // #when / #then the fingerprints are equal
    expect(a).toBe(b);
  });

  it("changes when the source file hash changes", () => {
    // #given the same block and chunks but a different file hash
    const a = computeBlockFingerprint({ timetableBlockId: "block1", sourceFileSha256: "abc", chunkShas: ["x"] });
    const b = computeBlockFingerprint({ timetableBlockId: "block1", sourceFileSha256: "def", chunkShas: ["x"] });
    // #when / #then the fingerprints differ
    expect(a).not.toBe(b);
  });

  it("changes when the linked file becomes null (missing)", () => {
    // #given a fingerprint computed with a file, and one computed without
    const withFile = computeBlockFingerprint({ timetableBlockId: "block1", sourceFileSha256: "abc", chunkShas: [] });
    const withoutFile = computeBlockFingerprint({ timetableBlockId: "block1", sourceFileSha256: null, chunkShas: [] });
    // #when / #then the fingerprints differ
    expect(withFile).not.toBe(withoutFile);
  });
});

describe("computeSourceFingerprint", () => {
  it("is stable across unordered block fingerprint input", () => {
    // #given the same block fingerprints supplied in two different orders
    const a = computeSourceFingerprint({ scheduleRevision: 1, routinesRevision: 1, overridesRevisionTag: "0:none", blockFingerprints: ["aa", "bb"] });
    const b = computeSourceFingerprint({ scheduleRevision: 1, routinesRevision: 1, overridesRevisionTag: "0:none", blockFingerprints: ["bb", "aa"] });
    // #when / #then the fingerprints are equal
    expect(a).toBe(b);
  });

  it("changes when the schedule revision changes", () => {
    // #given two fingerprints differing only by scheduleRevision
    const a = computeSourceFingerprint({ scheduleRevision: 1, routinesRevision: 1, overridesRevisionTag: "0:none", blockFingerprints: [] });
    const b = computeSourceFingerprint({ scheduleRevision: 2, routinesRevision: 1, overridesRevisionTag: "0:none", blockFingerprints: [] });
    // #when / #then the fingerprints differ
    expect(a).not.toBe(b);
  });
});
