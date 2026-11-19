import { describe, expect, it } from "vitest";

import { sameWarmSession, warmFingerprint } from "./warm.ts";

describe("warm ACP session", () => {
  const computer = { name: "computer", command: "node", args: ["proxy.js"], env: [{ name: "TOKEN", value: "one" }] };

  it("matches only when the folder, model, tools, and their env are the same", () => {
    const left = warmFingerprint("/work", "grok-4.6", [computer], "grok:0");
    expect(sameWarmSession(left, warmFingerprint("/work", "grok-4.6", [computer], "grok:0"))).toBe(true);
    expect(sameWarmSession(left, warmFingerprint("/other", "grok-4.6", [computer], "grok:0"))).toBe(false);
    expect(sameWarmSession(left, warmFingerprint("/work", "grok-4.5", [computer], "grok:0"))).toBe(false);
    expect(sameWarmSession(left, warmFingerprint("/work", "grok-4.6", [], "grok:0"))).toBe(false);
    expect(
      sameWarmSession(
        left,
        warmFingerprint("/work", "grok-4.6", [{ ...computer, env: [{ name: "TOKEN", value: "two" }] }], "grok:0"),
      ),
    ).toBe(false);
    expect(sameWarmSession(left, warmFingerprint("/work", "grok-4.6", [computer], "grok:1"))).toBe(false);
  });
});
