import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWithinRoot, sanitizeArchiveEntryName, validateAuthorizedRoot } from "../../apps/service/src/security/paths.js";

describe("validateAuthorizedRoot", () => {
  it("accepts a real directory and returns its canonical path", () => {
    // #given a real directory on disk
    const dir = mkdtempSync(join(tmpdir(), "ac-root-"));
    // #when validating it as an authorised root
    const canonical = validateAuthorizedRoot(dir);
    // #then it returns a canonical path pointing at that directory
    expect(canonical).toContain(dir.split("/").pop()!);
  });

  it("rejects a relative path", () => {
    // #given a relative (non-absolute) path
    // #when / #then validating it throws
    expect(() => validateAuthorizedRoot("relative/path")).toThrow();
  });

  it("rejects a path that does not exist", () => {
    // #given a path with nothing on disk
    // #when / #then validating it throws
    expect(() => validateAuthorizedRoot("/definitely/not/a/real/path/xyz")).toThrow();
  });

  it("rejects a file path (not a directory)", () => {
    // #given a plain file, not a directory
    const dir = mkdtempSync(join(tmpdir(), "ac-root-"));
    const file = join(dir, "a.txt");
    writeFileSync(file, "hi");
    // #when / #then validating it as a root throws
    expect(() => validateAuthorizedRoot(file)).toThrow();
  });
});

describe("resolveWithinRoot", () => {
  it("resolves a plain relative path inside the root", () => {
    // #given a root containing one file
    const dir = mkdtempSync(join(tmpdir(), "ac-root-"));
    writeFileSync(join(dir, "a.txt"), "hi");
    // #when resolving that file's relative path against the root
    const resolved = resolveWithinRoot(dir, "a.txt");
    // #then it resolves to the real file inside the root (realpath'd, since
    // macOS's tmpdir itself is a symlink: /var -> /private/var)
    expect(resolved).toBe(realpathSync(join(dir, "a.txt")));
  });

  it("rejects ../ traversal escaping the root", () => {
    // #given a root directory
    const dir = mkdtempSync(join(tmpdir(), "ac-root-"));
    // #when / #then resolving a traversal path throws
    expect(() => resolveWithinRoot(dir, "../../etc/passwd")).toThrow();
  });

  it("rejects a symlink that points outside the root", () => {
    // #given a root containing a symlink to a file outside the root
    const root = mkdtempSync(join(tmpdir(), "ac-root-"));
    const outside = mkdtempSync(join(tmpdir(), "ac-outside-"));
    const secretFile = join(outside, "secret.txt");
    writeFileSync(secretFile, "top secret");
    symlinkSync(secretFile, join(root, "escape-link"));
    // #when / #then resolving the symlink throws instead of following it out
    expect(() => resolveWithinRoot(root, "escape-link")).toThrow();
  });

  it("rejects a nested directory symlink that points outside the root", () => {
    // #given a root containing a symlinked directory that leads outside the root
    const root = mkdtempSync(join(tmpdir(), "ac-root-"));
    const outside = mkdtempSync(join(tmpdir(), "ac-outside-"));
    mkdirSync(join(outside, "nested"));
    writeFileSync(join(outside, "nested", "file.txt"), "secret");
    symlinkSync(outside, join(root, "link-dir"));
    // #when / #then resolving a path through that symlink throws
    expect(() => resolveWithinRoot(root, "link-dir/nested/file.txt")).toThrow();
  });
});

describe("sanitizeArchiveEntryName", () => {
  it("strips forward-slash path separators to prevent zip-slip", () => {
    // #given a traversal-style unix path
    // #when sanitizing it for use as an archive entry name
    const sanitized = sanitizeArchiveEntryName("../../etc/passwd");
    // #then it contains no path separators
    expect(sanitized).not.toContain("/");
  });

  it("strips backslash path separators to prevent zip-slip", () => {
    // #given a traversal-style windows path
    // #when sanitizing it for use as an archive entry name
    const sanitized = sanitizeArchiveEntryName("..\\..\\windows\\system32");
    // #then it contains no path separators
    expect(sanitized).not.toContain("\\");
  });

  it("keeps a normal filename intact", () => {
    // #given an ordinary, safe filename
    // #when sanitizing it
    const sanitized = sanitizeArchiveEntryName("worksheet.pdf");
    // #then it is unchanged
    expect(sanitized).toBe("worksheet.pdf");
  });
});
