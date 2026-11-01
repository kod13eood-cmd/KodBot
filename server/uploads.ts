import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { DATA_DIR } from "./config.ts";

/** A phone attachment is copied once into the host's data directory. The
 * ceiling is deliberately modest: this is for screenshots, PDFs and logs a
 * person attached to a prompt, not for moving bulk data through the API. */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

export const UPLOAD_DIR = join(DATA_DIR, "uploads");

/** The displayed name a phone sends in `x-kodbot-filename`, percent-encoded
 * so non-ASCII names survive an HTTP header. The result is a single path
 * segment: no directory separators, no control characters, no hidden-file
 * `..` lead, and short enough not to hit filesystem limits. */
export function sanitizeUploadName(raw: string | string[] | undefined, fallback = "attachment"): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return fallback;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // A sender that does not percent-encode still gets a usable name; the
    // path stripping below is what keeps it safe either way.
  }

  const segment = basename(decoded.replaceAll("\\", "/"));
  const cleaned = segment
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  // Count code points so a multibyte name is never cut through a character.
  const limited = Array.from(cleaned).slice(-120).join("");
  return limited && limited !== "." && limited !== ".." ? limited : fallback;
}

export interface StoredUpload {
  path: string;
  name: string;
  size: number;
}

/** Write one upload under a fresh, collision-resistant name and return the
 * absolute path the agent can open. The original name is kept (minus unsafe
 * characters) so a person still recognises the file in a transcript. */
export function storeUpload(bytes: Buffer, name: string, dir = UPLOAD_DIR): StoredUpload {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${Date.now()}-${randomUUID().slice(0, 8)}-${name}`);
  writeFileSync(path, bytes, { flag: "wx" });
  return { path, name, size: bytes.byteLength };
}
