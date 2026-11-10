import { describe, expect, it } from "vitest";

import { recordingPaths, recordingSlug } from "./vm-recorder.ts";

describe("Local VM workflow recordings", () => {
  it("turns a user-facing name into a path-safe id", () => {
    expect(recordingSlug("Checkout flow / BG")).toBe("checkout-flow-bg");
    expect(recordingSlug("  ")).toBe("workflow");
    expect(recordingSlug("A".repeat(100)).length).toBeLessThanOrEqual(48);
  });

  it("keeps a durable guest path that maps to the host workspace", () => {
    const paths = recordingPaths("Login test", 1_700_000_000_000);
    expect(paths.id).toMatch(/^20231114T221320Z-login-test-[a-f0-9]{6}$/);
    expect(paths.guest_path).toBe(`/home/cua/workspace/recordings/${paths.id}`);
    expect(paths.host_path.endsWith(`/recordings/${paths.id}`)).toBe(true);
    expect(paths.host_path).not.toContain("/home/cua/workspace");
  });
});
