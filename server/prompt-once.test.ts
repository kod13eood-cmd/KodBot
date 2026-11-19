import { describe, expect, it } from "vitest";

import { channelSystem, changingSystem, userPrompt } from "./prompt-once.ts";

const standing = "You are Ada. Write pages as HTML. Emit a products block when shopping.";

describe("userPrompt", () => {
  it("sends standing instructions once, on a new session", () => {
    expect(userPrompt(standing, "fix the login", false)).toBe(`${standing}\n\nfix the login`);
  });

  it("does not repeat standing instructions when the session resumes", () => {
    expect(userPrompt(standing, "now add a test", true)).toBe("now add a test");
    expect(userPrompt(standing, "now add a test", true)).not.toContain("products");
  });

  it("keeps memory and pages on a resumed turn without the standing block", () => {
    const update = "Your memory (MEMORY.md):\nprefers short answers\n\nExisting pages: Dashboard";
    const resumed = userPrompt(standing, "now add a test", true, update);
    expect(resumed).toBe(`${update}\n\nnow add a test`);
    expect(resumed).not.toContain("products");
    expect(userPrompt(standing, "fix the login", false, update)).toBe(`${standing}\n\n${update}\n\nfix the login`);
  });

  it("leaves the user text alone when there is no standing block", () => {
    expect(userPrompt(undefined, "hello", false)).toBe("hello");
    expect(userPrompt("   ", "hello", false)).toBe("hello");
  });
});

describe("channelSystem", () => {
  it("joins both layers for a real system channel, every call", () => {
    expect(channelSystem(standing, "memory")).toBe(`${standing}\n\nmemory`);
    expect(channelSystem(standing, "")).toBe(standing);
    expect(channelSystem(undefined, "memory")).toBe("memory");
    expect(channelSystem("  ", undefined)).toBeUndefined();
  });
});

describe("changingSystem", () => {
  it("drops empty pieces and keeps the rest in order", () => {
    expect(changingSystem(["Your memory", "", undefined, "Existing pages"])).toBe("Your memory\n\nExisting pages");
    expect(changingSystem(["", "   "])).toBeUndefined();
  });
});
