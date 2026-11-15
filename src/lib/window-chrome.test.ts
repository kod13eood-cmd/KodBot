import { afterEach, describe, expect, it } from "vitest";

import { WINDOWS_TITLEBAR_INSET, windowsTitlebarInset } from "./window-chrome";

const original = (globalThis as { window?: unknown }).window;

function platform(value: string | undefined) {
  (globalThis as { window?: unknown }).window = value
    ? { ogb: { platform: value } }
    : {};
}

describe("windows title bar inset", () => {
  afterEach(() => {
    (globalThis as { window?: unknown }).window = original;
  });

  it("leaves room for the native caption buttons only on Windows", () => {
    platform("win32");
    expect(windowsTitlebarInset()).toBe(WINDOWS_TITLEBAR_INSET);
    platform("linux");
    expect(windowsTitlebarInset()).toBe(false);
    platform(undefined);
    expect(windowsTitlebarInset()).toBe(false);
  });
});
