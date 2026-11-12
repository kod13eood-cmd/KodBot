// What is attached to the next message: text too long for the input or a
// file dropped onto the window. Chips fold back into a normal prompt on
// send, so every driver receives the same message shape.
export type PasteAttachment = {
  kind: "paste";
  id: string;
  text: string;
  size: number;
  lines: number;
};

export type FileAttachment = {
  kind: "file";
  id: string;
  path: string;
  name: string;
  size: number;
  /** The picked bytes, kept in memory so a remote host can receive them.
   * Drafts persist only path/name/size; after a reload the user re-attaches. */
  file?: File;
  /** Already stored on the harness (a recorded voice note, for example), so
   * a remote-mode send must not try to upload it a second time. */
  remote?: boolean;
  /** Show this as a voice note chip and keep it playable. */
  audio?: boolean;
};

export type Attachment = PasteAttachment | FileAttachment;

export function isAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== "object") return false;
  const attachment = value as Record<string, unknown>;
  if (typeof attachment.id !== "string" || !validSize(attachment.size)) return false;
  if (attachment.kind === "paste") {
    return (
      typeof attachment.text === "string" &&
      typeof attachment.lines === "number" &&
      Number.isInteger(attachment.lines) &&
      attachment.lines >= 1
    );
  }
  if (attachment.kind === "file") {
    return (
      typeof attachment.path === "string" &&
      attachment.path.length > 0 &&
      typeof attachment.name === "string"
    );
  }
  return false;
}

function validSize(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Past this, a paste stops reading as typing and becomes an attachment.
 * Long-but-narrow (a stack trace, a log) counts by line, not just chars. */
export const PASTE_CHARS = 900;
export const PASTE_LINES = 12;

export function isLongPaste(text: string): boolean {
  return text.length >= PASTE_CHARS || countLines(text) >= PASTE_LINES;
}

export function countLines(text: string): number {
  return text.split("\n").length;
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `a${Math.random().toString(36).slice(2)}`;
}

export function fileAttachment(name: string, path: string, size: number, file?: File): FileAttachment {
  return { kind: "file", id: newId(), path, name, size, ...(file ? { file } : {}) };
}

export function pasteAttachment(text: string): PasteAttachment {
  const id = newId();
  // measured once, here: a chip re-renders on every keystroke in the
  // composer, and encoding half a megabyte each time would be felt
  return { kind: "paste", id, text, size: byteLength(text), lines: countLines(text) };
}

export const INLINE_DROP_LIMIT = 512 * 1024;

export type DroppedFile = Pick<File, "name" | "size" | "type" | "text">;

/** Turn a browser drop into composer attachments. Electron-backed files
 * keep their disk path; small pathless text drops keep their contents.
 * Promise.all preserves the user's drop order even when text reads finish
 * in a different order. */
export async function attachmentsFromDroppedFiles<T extends DroppedFile>(
  files: readonly T[],
  getPath: (file: T) => string,
): Promise<{ attachments: Attachment[]; rejectedNames: string[] }> {
  const results = await Promise.all(
    files.map(async (file) => {
      let path = "";
      try {
        path = getPath(file);
      } catch {
        // A browser or older desktop shell has no disk path to expose.
      }
      if (path) return { attachment: fileAttachment(file.name, path, file.size, file as T & File) };
      if (isInlineText(file) && file.size <= INLINE_DROP_LIMIT) {
        try {
          return { attachment: pasteAttachment(await file.text()) };
        } catch {
          // Treat an unreadable browser drag like any other pathless file.
        }
      }
      return { rejectedName: file.name };
    }),
  );

  return {
    attachments: results.flatMap((result) =>
      "attachment" in result && result.attachment ? [result.attachment] : [],
    ),
    rejectedNames: results.flatMap((result) =>
      "rejectedName" in result && result.rejectedName ? [result.rejectedName] : [],
    ),
  };
}

function isInlineText(file: DroppedFile): boolean {
  return file.type.startsWith("text/") || file.type === "application/json";
}

/** What the paste actually weighs — String#length counts UTF-16 units, so
 * it reads a third under on accented text and half under on CJK. */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** "12 lines, 3.4 KB" — what the chip says under the preview. */
export function pasteSummary(a: { lines: number; size: number }): string {
  return `${a.lines} lines, ${formatSize(a.size)}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The prompt the bot receives: what was typed, then one block per
 * attachment. Tagged blocks rather than fences — pasted code and markdown
 * carry fences of their own, and nesting them loses the boundary. A file
 * needs only its path: every driver here is an agent that can open it. */
export function composeMessage(text: string, attachments: Attachment[]): string {
  const parts = [text.trim()];
  attachments.forEach((a, i) => {
    if (a.kind === "paste") {
      parts.push(`<pasted-text index="${i + 1}">\n${a.text}\n</pasted-text>`);
    } else {
      parts.push(`<attached-file path="${escapeAttribute(a.path)}" />`);
    }
  });
  return parts.filter(Boolean).join("\n\n");
}

/** File paths are untrusted prompt content. Keep them inside the quoted
 * attribute even when a filename contains XML characters or line breaks. */
export function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\t", "&#9;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\n", "&#10;");
}

export interface StoredVoiceNote {
  path: string;
  name: string;
  size: number;
  /** Same-origin URL that plays the stored clip. */
  url: string;
}

/** Store a recorded clip on the harness and return both the path the agent
 * can open and the URL the transcript can play. Works in local and remote
 * mode because the bytes go to the harness that owns the workspace. */
export async function uploadVoiceNote(
  blob: Blob,
  name: string,
  post: typeof fetch = fetch,
): Promise<StoredVoiceNote> {
  const response = await post("/api/uploads", {
    method: "POST",
    headers: {
      "content-type": blob.type || "audio/webm",
      "x-kodbot-filename": encodeURIComponent(name),
    },
    body: blob,
  });
  const saved = (await response.json().catch(() => null)) as
    | { path?: string; url?: string; name?: string; size?: number; error?: string }
    | null;
  if (!response.ok) throw new Error(saved?.error || `Couldn't store the voice note (HTTP ${response.status}).`);
  if (!saved?.path || !saved?.url) throw new Error("The server didn't return a path for the voice note.");
  return {
    path: saved.path,
    url: saved.url,
    name: saved.name || name,
    size: typeof saved.size === "number" ? saved.size : blob.size,
  };
}

/** A remote harness cannot open a path on this laptop. Send the bytes to the
 * host first and rewrite each file attachment to the path it stored. Paste
 * attachments are already text and stay untouched. */
export const REMOTE_UPLOAD_LIMIT = 30 * 1024 * 1024;

export async function uploadRemoteAttachments(
  attachments: Attachment[],
  post: typeof fetch = fetch,
): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const attachment of attachments) {
    if (attachment.kind !== "file") {
      out.push(attachment);
      continue;
    }
    if (attachment.remote) {
      out.push(attachment);
      continue;
    }
    if (!attachment.file) {
      throw new Error(`"${attachment.name}" needs to be attached again for the remote server.`);
    }
    if (attachment.file.size > REMOTE_UPLOAD_LIMIT) {
      throw new Error(`"${attachment.name}" is larger than 30 MB.`);
    }
    const response = await post("/api/uploads", {
      method: "POST",
      headers: {
        "content-type": attachment.file.type || "application/octet-stream",
        "x-kodbot-filename": encodeURIComponent(attachment.name),
      },
      body: attachment.file,
    });
    const saved = (await response.json().catch(() => null)) as
      | { path?: string; name?: string; size?: number; error?: string }
      | null;
    if (!response.ok) {
      throw new Error(saved?.error || `Couldn't upload ${attachment.name} (HTTP ${response.status}).`);
    }
    if (!saved?.path) throw new Error(`The remote server didn't return a path for ${attachment.name}.`);
    out.push({
      ...attachment,
      path: saved.path,
      name: saved.name || attachment.name,
      size: typeof saved.size === "number" ? saved.size : attachment.size,
    });
  }
  return out;
}
