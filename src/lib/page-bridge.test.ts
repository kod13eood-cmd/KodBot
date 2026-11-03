import { describe, expect, it, vi } from "vitest";

import {
  createPageBridgeHandler,
  PAGE_BRIDGE_MAX_CHARS,
  parsePageBridgeMessage,
  sanitizePageFilename,
  type PageBridgeSource,
} from "./page-bridge";

function setup() {
  // SAFETY: these test doubles are only compared by identity; no DOM methods run.
  const pageWindow = {} as PageBridgeSource;
  // SAFETY: same — a distinct identity that is not one of the page frames.
  const otherWindow = {} as PageBridgeSource;
  const onCopy = vi.fn();
  const onDownload = vi.fn();
  const onSend = vi.fn();
  const onClose = vi.fn();
  const handler = createPageBridgeHandler({
    frames: () => [{ contentWindow: pageWindow, botId: "bot-1" }, null],
    onCopy,
    onDownload,
    onSend,
    onClose,
  });
  return { pageWindow, otherWindow, onCopy, onDownload, onSend, onClose, handler };
}

describe("page bridge message guard", () => {
  it("accepts copy and download only from a page iframe", () => {
    const { pageWindow, onCopy, onDownload, handler } = setup();

    handler({ source: pageWindow, data: { type: "kodbot:copy", text: "typed answers" } });
    expect(onCopy).toHaveBeenCalledWith("typed answers");

    handler({
      source: pageWindow,
      data: { type: "kodbot:download", filename: "../../report.txt", text: "a,b\n1,2" },
    });
    expect(onDownload).toHaveBeenCalledWith("report.txt", "a,b\n1,2");
  });

  it("rejects a message whose source is not one of our page iframes", () => {
    const { otherWindow, onCopy, onDownload, handler } = setup();

    handler({ source: otherWindow, data: { type: "kodbot:copy", text: "nope" } });
    handler({ source: null, data: { type: "kodbot:download", filename: "a.txt", text: "nope" } });
    handler({ source: undefined, data: { type: "kodbot:copy", text: "nope" } });

    expect(onCopy).not.toHaveBeenCalled();
    expect(onDownload).not.toHaveBeenCalled();
  });

  it("sends page text to the bot that owns the iframe", () => {
    const { pageWindow, onSend, handler } = setup();

    handler({ source: pageWindow, data: { type: "kodbot:send", text: "1 Да\n2 Да" } });
    expect(onSend).toHaveBeenCalledWith("1 Да\n2 Да", "bot-1");
  });

  it("never sends when the iframe has no bot id", () => {
    const pageWindow = {} as PageBridgeSource;
    const onSend = vi.fn();
    const handler = createPageBridgeHandler({
      frames: () => [{ contentWindow: pageWindow }],
      onCopy: vi.fn(),
      onDownload: vi.fn(),
      onSend,
    });

    handler({ source: pageWindow, data: { type: "kodbot:send", text: "nope" } });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("lets a page close its viewer, and only from its own frame", () => {
    const { pageWindow, otherWindow, onClose, handler } = setup();

    handler({ source: pageWindow, data: { type: "kodbot:close" } });
    expect(onClose).toHaveBeenCalledWith("bot-1");

    onClose.mockClear();
    handler({ source: otherWindow, data: { type: "kodbot:close" } });
    handler({ source: null, data: { type: "kodbot:close" } });
    expect(onClose).not.toHaveBeenCalled();

    expect(parsePageBridgeMessage({ type: "kodbot:close" })).toEqual({ type: "kodbot:close" });
  });

  it("rejects oversized text and oversized downloads", () => {
    const { pageWindow, onCopy, onDownload, handler } = setup();
    const tooBig = "x".repeat(PAGE_BRIDGE_MAX_CHARS + 1);

    handler({ source: pageWindow, data: { type: "kodbot:copy", text: tooBig } });
    handler({
      source: pageWindow,
      data: { type: "kodbot:download", filename: "big.txt", text: tooBig },
    });

    expect(onCopy).not.toHaveBeenCalled();
    expect(onDownload).not.toHaveBeenCalled();
    expect(parsePageBridgeMessage({ type: "kodbot:copy", text: tooBig })).toBeNull();
    expect(parsePageBridgeMessage({ type: "kodbot:send", text: tooBig })).toBeNull();
  });

  it("rejects unknown types and malformed payloads", () => {
    const { pageWindow, onCopy, onDownload, handler } = setup();

    for (const data of [
      { type: "kodbot:paste", text: "x" },
      { type: "kodbot:copy" },
      { type: "kodbot:copy", text: 42 },
      { type: "kodbot:copy", text: "" },
      { type: "kodbot:download", filename: "a.txt" },
      { type: "kodbot:download", filename: "", text: "x" },
      { type: "kodbot:download", filename: 7, text: "x" },
      "kodbot:copy",
      null,
      undefined,
    ]) {
      handler({ source: pageWindow, data });
    }

    expect(onCopy).not.toHaveBeenCalled();
    expect(onDownload).not.toHaveBeenCalled();
  });
});

describe("page download filenames", () => {
  it("keeps a bare name and drops any path", () => {
    expect(sanitizePageFilename("report.txt")).toBe("report.txt");
    expect(sanitizePageFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizePageFilename("C:\\Users\\me\\answers.csv")).toBe("answers.csv");
  });

  it("removes dangerous or invisible characters and never returns empty", () => {
    expect(sanitizePageFilename("a\u0000b:c?.txt")).toBe("a-b-c-.txt");
    expect(sanitizePageFilename("   ")).toBe("download.txt");
    expect(sanitizePageFilename("...")).toBe("download.txt");
    expect(sanitizePageFilename("x".repeat(500)).length).toBe(120);
  });
});
