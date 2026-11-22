import { describe, expect, it } from "vitest";

import {
  browserEditionChoiceRequired,
  editionOf,
  isLoopbackHost,
} from "./edition";

describe("edition", () => {
  it("treats a signed-in gateway account as Business", () => {
    expect(editionOf({ id: "u1", role: "owner" })).toBe("business");
    expect(editionOf({ id: "u2", role: "member" })).toBe("business");
  });

  it("treats a local or personal harness with no account as Solo", () => {
    expect(editionOf(null)).toBe("solo");
    expect(editionOf(undefined)).toBe("solo");
  });

  it("recognises loopback hosts only", () => {
    for (const host of ["localhost", "LOCALHOST", "127.0.0.1", "::1", "[::1]"]) {
      expect(isLoopbackHost(host)).toBe(true);
    }
    for (const host of ["kodbot.example.com", "192.168.1.50", "paperclipi7.tail89d239.ts.net", "127.0.0.2"]) {
      expect(isLoopbackHost(host)).toBe(false);
    }
  });

  it("asks a first-run browser only on loopback, once, and without an account", () => {
    expect(
      browserEditionChoiceRequired({ hostname: "localhost", authUser: null, soloChosen: false }),
    ).toBe(true);
    expect(
      browserEditionChoiceRequired({ hostname: "localhost", authUser: { id: "u1" }, soloChosen: false }),
    ).toBe(false);
    expect(
      browserEditionChoiceRequired({ hostname: "localhost", authUser: null, soloChosen: true }),
    ).toBe(false);
    expect(
      browserEditionChoiceRequired({ hostname: "kodbot.example.com", authUser: null, soloChosen: false }),
    ).toBe(false);
  });
});
