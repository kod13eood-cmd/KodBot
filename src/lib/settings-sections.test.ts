import { describe, expect, it } from "vitest";

import { canSeeSettingsSection } from "./settings-sections";

describe("canSeeSettingsSection", () => {
  it("shows Admin to the gateway owner only", () => {
    expect(canSeeSettingsSection("admin", { devMode: false, isOwner: true })).toBe(true);
    expect(canSeeSettingsSection("admin", { devMode: true, isOwner: false })).toBe(false);
    expect(canSeeSettingsSection("admin", { devMode: false, isOwner: false })).toBe(false);
  });

  it("keeps developer surfaces behind developer mode", () => {
    expect(canSeeSettingsSection("connections", { devMode: false, isOwner: true })).toBe(false);
    expect(canSeeSettingsSection("usage", { devMode: false, isOwner: true })).toBe(false);
    expect(canSeeSettingsSection("connections", { devMode: true, isOwner: false })).toBe(true);
  });

  it("always shows ordinary sections", () => {
    for (const id of ["general", "voice", "knowledge", "about"] as const) {
      expect(canSeeSettingsSection(id, { devMode: false, isOwner: false })).toBe(true);
    }
  });
});
