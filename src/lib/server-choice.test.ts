import { describe, expect, it } from "vitest";

import { normalizeRemoteAddress, serverChoiceRequired } from "./server-choice";

describe("first-run server choice", () => {
  it("blocks only when the main process says no choice is saved", () => {
    expect(serverChoiceRequired({ configured: false })).toBe(true);
    expect(serverChoiceRequired({ configured: true })).toBe(false);
    expect(serverChoiceRequired({})).toBe(false);
    expect(serverChoiceRequired(null)).toBe(false);
  });

  it("normalises the address exactly like the main process", () => {
    expect(normalizeRemoteAddress("  https://kodbot.example.com/  ")).toBe(
      "https://kodbot.example.com",
    );
    expect(normalizeRemoteAddress("http://192.168.1.50:8799///")).toBe(
      "http://192.168.1.50:8799",
    );
  });
});
