import { describe, expect, it } from "vitest";

import { resolveApprovalTimeoutMs } from "./approval-timeout.ts";

describe("resolveApprovalTimeoutMs", () => {
  it("uses the historic default when no setting is present", () => {
    expect(resolveApprovalTimeoutMs(undefined)).toBe(15 * 60_000);
  });

  it("supports a live getter and the no-timer value", () => {
    let value = 5 * 60_000;
    expect(resolveApprovalTimeoutMs(() => value)).toBe(value);
    value = 0;
    expect(resolveApprovalTimeoutMs(() => value)).toBe(0);
  });
});
