import { z } from "zod";

/** Parent-side half of the bot-page bridge.
 *
 * Pages run in a sandboxed iframe (`allow-scripts`, no same-origin), so they
 * cannot touch the Clipboard API, localStorage, or trigger a download. A page
 * that needs one of those asks the app with a `postMessage`; this module
 * validates that request and the PageBridge component performs it at the
 * top level, where the user's click permission applies.
 *
 * The guards are deliberately strict: only a window that belongs to one of
 * our own page iframes may ask, only two message types exist, and text is
 * capped so a page cannot exhaust memory on the app side.
 */

export const PAGE_BRIDGE_MAX_CHARS = 1024 * 1024;
const MAX_FILENAME_CHARS = 120;

export type PageBridgeRequest =
  | { type: "kodbot:copy"; text: string }
  | { type: "kodbot:download"; filename: string; text: string };

/** The only windows a page request may come from: a real framed document. */
export type PageBridgeSource = MessageEventSource | null | undefined;

interface PageFrame {
  contentWindow: PageBridgeSource;
}

const bridgeRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("kodbot:copy"),
    text: z.string().min(1).max(PAGE_BRIDGE_MAX_CHARS),
  }),
  z.object({
    type: z.literal("kodbot:download"),
    filename: z.string().trim().min(1),
    text: z.string().max(PAGE_BRIDGE_MAX_CHARS),
  }),
]);

function isUnsafeFilenameChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code < 0x20 || code === 0x7f || '<>:"|?*'.includes(char);
}

/** Strip path separators and characters a filesystem dislikes, then cap the
 * result. A page may suggest a name but never a path. */
export function sanitizePageFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = Array.from(base)
    .map((char) => (isUnsafeFilenameChar(char) ? "-" : char))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, MAX_FILENAME_CHARS)
    .trim();
  return cleaned || "download.txt";
}

/** Returns a validated request, or null when the payload is not exactly one
 * of the two shapes a page is allowed to send. */
export function parsePageBridgeMessage(data: MessageEvent["data"]): PageBridgeRequest | null {
  const parsed = bridgeRequestSchema.safeParse(data);
  if (!parsed.success) return null;
  if (parsed.data.type === "kodbot:copy") return parsed.data;
  return { ...parsed.data, filename: sanitizePageFilename(parsed.data.filename) };
}

/** True only when `source` is the contentWindow of one of the page iframes.
 * Everything else — the app itself, another frame, an opener — is ignored. */
export function isPageFrameSource(
  source: PageBridgeSource,
  frames: Iterable<PageFrame | null | undefined>,
): boolean {
  if (!source) return false;
  for (const frame of frames) {
    if (frame && frame.contentWindow === source) return true;
  }
  return false;
}

export interface PageBridgeHandlers {
  frames: () => Iterable<PageFrame | null | undefined>;
  onCopy: (text: string) => void;
  onDownload: (filename: string, text: string) => void;
}

/** The message guard as a pure function, so tests can exercise rejection
 * without a DOM. `installPageBridge` is the thin browser wrapper. */
export function createPageBridgeHandler(handlers: PageBridgeHandlers) {
  return (event: { source: PageBridgeSource; data: MessageEvent["data"] }): void => {
    if (!isPageFrameSource(event.source, handlers.frames())) return;
    const request = parsePageBridgeMessage(event.data);
    if (!request) return;
    if (request.type === "kodbot:copy") handlers.onCopy(request.text);
    else handlers.onDownload(request.filename, request.text);
  };
}

/** Accepts bridge messages from any page iframe currently in the document.
 * Call once at app level; page iframes opt in with `data-kodbot-page`. */
export function installPageBridge(
  handlers: Pick<PageBridgeHandlers, "onCopy" | "onDownload">,
  doc: Document,
  win: Window,
): () => void {
  const handler = createPageBridgeHandler({
    ...handlers,
    frames: () =>
      Array.from(doc.querySelectorAll<HTMLIFrameElement>("iframe[data-kodbot-page]")),
  });
  const listener = (event: MessageEvent) => handler(event);
  win.addEventListener("message", listener);
  return () => win.removeEventListener("message", listener);
}

/** Parent-side download. The Blob URL lives only for this click. */
export function downloadPageText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizePageFilename(filename);
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
