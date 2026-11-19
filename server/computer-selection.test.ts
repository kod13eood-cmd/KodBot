import { describe, expect, it } from "vitest";

import { computerScopeId, resolveComputerDestination } from "./computer-selection.ts";

describe("resolveComputerDestination", () => {
  it("treats a stored null as Auto, not as an unknown destination", () => {
    expect(resolveComputerDestination(undefined, null)).toBeUndefined();
    expect(resolveComputerDestination(undefined, undefined)).toBeUndefined();
  });

  it("keeps explicit destinations", () => {
    expect(resolveComputerDestination(undefined, "vm")).toBe("vm");
    expect(resolveComputerDestination(undefined, "local")).toBe("local");
    expect(resolveComputerDestination(undefined, "off")).toBe("off");
  });

  it("shares a cloud computer only when a team is named", () => {
    expect(computerScopeId("bot-1", true, "team-9")).toBe("team:team-9");
    expect(computerScopeId("bot-1", true, null)).toBe("bot-1");
    expect(computerScopeId("bot-1", false, "team-9")).toBe("bot-1");
  });

  it("lets a cloud routine override the bot's destination", () => {
    expect(resolveComputerDestination("cloud", "vm")).toBe("cloud");
    expect(resolveComputerDestination("crew", null)).toBeUndefined();
  });
});
