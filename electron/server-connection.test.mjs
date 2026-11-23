import { describe, expect, it } from "vitest";

import { connectionChoiceSaved, connectionRecord } from "./server-connection.mjs";

describe("desktop first-run connection", () => {
  it("asks again for a local mode written before the onboarding marker", () => {
    expect(connectionChoiceSaved({ mode: "local" })).toBe(false);
  });

  it("accepts a marked local choice", () => {
    expect(connectionChoiceSaved({ mode: "local", onboarding: true })).toBe(true);
  });

  it("treats a remote address as an explicit answer", () => {
    expect(connectionChoiceSaved({ mode: "remote", url: "https://kodbot.example.com" })).toBe(true);
  });

  it("does not accept missing or malformed records", () => {
    expect(connectionChoiceSaved(null)).toBe(false);
    expect(connectionChoiceSaved({})).toBe(false);
    expect(connectionChoiceSaved({ mode: "other" })).toBe(false);
  });

  it("writes answers with the marker and a timestamp", () => {
    const now = new Date("2026-11-23T08:00:00.000Z");
    expect(connectionRecord({ mode: "local" }, now)).toEqual({
      mode: "local",
      onboarding: true,
      chosenAt: "2026-11-23T08:00:00.000Z",
    });
    expect(connectionRecord({ mode: "remote", url: "https://kodbot.example.com" }, now)).toEqual({
      mode: "remote",
      url: "https://kodbot.example.com",
      onboarding: true,
      chosenAt: "2026-11-23T08:00:00.000Z",
    });
  });
});
