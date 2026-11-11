import { describe, expect, it } from "vitest";

import { resolveComputerDestination } from "./computer-selection.ts";

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

  it("lets a cloud routine override the bot's destination", () => {
    expect(resolveComputerDestination("cloud", "vm")).toBe("cloud");
    expect(resolveComputerDestination("crew", null)).toBeUndefined();
  });
});
