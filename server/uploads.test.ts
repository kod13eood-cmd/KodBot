import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { sanitizeUploadName, storeUpload } from "./uploads.ts";

const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "kodbot-upload-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("upload names", () => {
  it("decodes a percent-encoded phone filename", () => {
    expect(sanitizeUploadName("Screenshot%202026-11-01%20at%2010.42.png")).toBe(
      "Screenshot 2026-11-01 at 10.42.png",
    );
    expect(sanitizeUploadName("%D0%94%D0%BE%D0%BA%D0%BB%D0%B0%D0%B4.pdf")).toBe("Доклад.pdf");
  });

  it("keeps a name to one path segment", () => {
    expect(sanitizeUploadName("..%2F..%2Fetc%2Fpasswd")).toBe("passwd");
    expect(sanitizeUploadName("C%3A%5CUsers%5Cme%5Creport.pdf")).toBe("report.pdf");
    expect(sanitizeUploadName("%2E%2E")).toBe("attachment");
    expect(sanitizeUploadName("")).toBe("attachment");
  });

  it("removes control characters instead of letting them reach the filesystem", () => {
    expect(sanitizeUploadName("line%0Abreak.txt")).toBe("linebreak.txt");
    expect(sanitizeUploadName("bell%07.txt")).toBe("bell.txt");
  });

  it("bounds very long names without splitting a character", () => {
    const name = sanitizeUploadName(`${"д".repeat(200)}.pdf`);
    expect(Array.from(name).length).toBe(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});

describe("stored uploads", () => {
  it("writes the bytes and reports their real size", () => {
    const dir = tempDir();
    const bytes = Buffer.from("hello, KodBot\n");
    const stored = storeUpload(bytes, "notes.txt", dir);
    expect(stored.name).toBe("notes.txt");
    expect(stored.size).toBe(bytes.byteLength);
    expect(stored.path.startsWith(dir)).toBe(true);
    expect(readFileSync(stored.path)).toEqual(bytes);
  });

  it("gives two files with the same name separate paths", () => {
    const dir = tempDir();
    const first = storeUpload(Buffer.from("one"), "same.txt", dir);
    const second = storeUpload(Buffer.from("two"), "same.txt", dir);
    expect(first.path).not.toBe(second.path);
    expect(readFileSync(first.path, "utf8")).toBe("one");
    expect(readFileSync(second.path, "utf8")).toBe("two");
  });
});
