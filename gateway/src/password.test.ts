import { describe, expect, it } from "vitest";

import { hashPassword, passwordProblem, verifyPassword } from "./password.ts";

describe("gateway passwords", () => {
  it("hashes with a unique salt and verifies the original", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");
    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("correct horse battery staple", first)).resolves.toBe(true);
  });

  it("rejects a wrong password and a malformed hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
    await expect(verifyPassword("correct horse battery staple", "not-a-hash")).resolves.toBe(false);
  });

  it("enforces a minimum length", () => {
    expect(passwordProblem("short")).toMatch(/10/);
    expect(passwordProblem("long enough password")).toBeNull();
  });
});
