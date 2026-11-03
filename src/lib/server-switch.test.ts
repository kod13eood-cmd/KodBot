import { describe, expect, it } from "vitest";

import { normalizeServerUrl, remoteSwitchAvailable } from "./server-switch";

const healthyRemote = {
  mode: "remote" as const,
  active: "remote" as const,
  url: "http://paperclipi7.tail89d239.ts.net:8799",
};

describe("server switching", () => {
  it("normalizes what the main process will store", () => {
    expect(normalizeServerUrl("  http://host:8799/  ")).toBe("http://host:8799");
    expect(normalizeServerUrl("http://host:8799///")).toBe("http://host:8799");
  });

  it("allows the first remote connection from local mode", () => {
    expect(remoteSwitchAvailable("http://host:8799", { mode: "local" })).toBe(true);
    expect(remoteSwitchAvailable("http://host:8799", null)).toBe(true);
  });

  it("allows switching to a different remote address", () => {
    expect(remoteSwitchAvailable("http://other:8799", healthyRemote)).toBe(true);
    expect(remoteSwitchAvailable("http://other:8799/", healthyRemote)).toBe(true);
  });

  it("stays disabled for the address already in use, ignoring a trailing slash", () => {
    expect(remoteSwitchAvailable(healthyRemote.url, healthyRemote)).toBe(false);
    expect(remoteSwitchAvailable(`${healthyRemote.url}/`, healthyRemote)).toBe(false);
  });

  it("allows retrying after the saved server stopped answering", () => {
    expect(remoteSwitchAvailable(healthyRemote.url, { ...healthyRemote, fallback: true, active: "local" })).toBe(true);
  });

  it("never enables an empty address", () => {
    expect(remoteSwitchAvailable("   ", healthyRemote)).toBe(false);
  });
});
