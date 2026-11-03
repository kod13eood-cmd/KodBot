import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText } from "./clipboard";

function fakeDocument(execResult = true) {
  const area = {
    value: "",
    setAttribute: vi.fn(),
    style: {} as Record<string, string>,
    focus: vi.fn(),
    select: vi.fn(),
    remove: vi.fn(),
  };
  return {
    activeElement: null,
    createElement: vi.fn(() => area),
    body: { appendChild: vi.fn() },
    execCommand: vi.fn(() => execResult),
    area,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("copyText", () => {
  it("uses the desktop main-process clipboard first, even over HTTP", async () => {
    const native = vi.fn(async () => true);
    const web = vi.fn(async () => {});
    vi.stubGlobal("window", { ogb: { clipboard: { writeText: native } } });
    vi.stubGlobal("navigator", { clipboard: { writeText: web } });
    vi.stubGlobal("document", fakeDocument());

    await expect(copyText("hello")).resolves.toBe(true);
    expect(native).toHaveBeenCalledWith("hello");
    expect(web).not.toHaveBeenCalled();
  });

  it("falls back to the Web Clipboard API outside the desktop app", async () => {
    const web = vi.fn(async () => {});
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { clipboard: { writeText: web } });
    vi.stubGlobal("document", fakeDocument());

    await expect(copyText("hello")).resolves.toBe(true);
    expect(web).toHaveBeenCalledWith("hello");
  });

  it("selects the text when both APIs are blocked", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
    });
    const doc = fakeDocument(true);
    vi.stubGlobal("document", doc);

    await expect(copyText("code")).resolves.toBe(true);
    expect(doc.execCommand).toHaveBeenCalledWith("copy");
    expect(doc.area.value).toBe("code");
  });

  it("reports failure instead of claiming a copy that did not happen", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {});
    const doc = fakeDocument(false);
    vi.stubGlobal("document", doc);

    await expect(copyText("code")).resolves.toBe(false);
  });
});
