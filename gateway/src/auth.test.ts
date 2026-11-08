import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuthError, AuthService } from "./auth.ts";
import { loadGatewayConfig, type GatewayConfig } from "./config.ts";
import { GatewayStore } from "./store.ts";

let root = "";
let config: GatewayConfig;
let store: GatewayStore;
let auth: AuthService;
let now = 1_800_000_000_000;

function makeAuth(clock = () => now) {
  auth = new AuthService(store, config, clock);
  return auth;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kodbot-gateway-"));
  config = loadGatewayConfig({
    ...process.env,
    OC_GATEWAY_DATA_DIR: join(root, "control"),
    OC_GATEWAY_TENANTS_DIR: join(root, "tenants"),
    OC_GATEWAY_OWNER_DATA_DIR: join(root, "owner"),
    OC_GATEWAY_BOOTSTRAP: "1",
    OC_GATEWAY_PUBLIC_ORIGIN: "http://localhost:8780",
  });
  store = new GatewayStore(config.dataDir);
  makeAuth();
});

afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

describe("gateway auth", () => {
  it("creates the first account as owner and keeps the legacy data dir", async () => {
    const issued = await auth.register({
      email: "Owner@Example.com",
      password: "correct horse battery",
    });
    expect(issued.user.role).toBe("owner");
    expect(issued.user.email).toBe("owner@example.com");
    expect(issued.token.startsWith("kbs_")).toBe(true);
    expect(store.findUserByEmail("owner@example.com")?.dataDir).toBe(config.ownerDataDir);
  });

  it("requires an invite for every later account", async () => {
    const owner = await auth.register({ email: "owner@example.com", password: "correct horse battery" });
    await expect(
      auth.register({ email: "friend@example.com", password: "another good password" }),
    ).rejects.toMatchObject({ status: 403 });

    const invite = auth.createInvite({ email: "friend@example.com", createdBy: owner.user.id });
    const friend = await auth.register({
      email: "friend@example.com",
      password: "another good password",
      invite: invite.code,
    });
    expect(friend.user.role).toBe("member");
    expect(store.findUserByEmail(friend.user.email)?.dataDir.startsWith(join(root, "tenants"))).toBe(true);
    expect(store.findInviteByHash((await import("./tokens.ts")).hashToken(invite.code))?.usedBy).toBe(friend.user.id);
  });

  it("refuses an invite addressed to a different email and a reused invite", async () => {
    const owner = await auth.register({ email: "owner@example.com", password: "correct horse battery" });
    const invite = auth.createInvite({ email: "friend@example.com", createdBy: owner.user.id });
    await expect(
      auth.register({ email: "other@example.com", password: "another good password", invite: invite.code }),
    ).rejects.toMatchObject({ status: 403 });
    await auth.register({
      email: "friend@example.com",
      password: "another good password",
      invite: invite.code,
    });
    await expect(
      auth.register({ email: "third@example.com", password: "another good password", invite: invite.code }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("logs in, resolves a session, and rejects a wrong password", async () => {
    await auth.register({ email: "owner@example.com", password: "correct horse battery" });
    const login = await auth.login({ email: "owner@example.com", password: "correct horse battery", ip: "127.0.0.1" });
    expect(auth.session(login.token)?.user.email).toBe("owner@example.com");
    await expect(
      auth.login({ email: "owner@example.com", password: "wrong password", ip: "127.0.0.1" }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("expires a session and removes it", async () => {
    const owner = await auth.register({ email: "owner@example.com", password: "correct horse battery" });
    expect(auth.session(owner.token)).not.toBeNull();
    now += config.sessionTtlMs + 1;
    expect(auth.session(owner.token)).toBeNull();
    expect(store.findSessionByHash((await import("./tokens.ts")).hashToken(owner.token))).toBeNull();
  });

  it("opens a pairing window, issues a device, and revokes it", async () => {
    const owner = await auth.register({ email: "owner@example.com", password: "correct horse battery" });
    const pairing = auth.openPairing(owner.user.id);
    const device = auth.redeemPairing(pairing.token, "Pixel 9", "127.0.0.1");
    expect(device.token.startsWith("omb_")).toBe(true);
    expect(auth.device(device.token)?.user.id).toBe(owner.user.id);
    expect(auth.listDevices(owner.user.id)).toHaveLength(1);
    expect(auth.revokeDevice(owner.user.id, device.device.id)).toBe(true);
    expect(auth.device(device.token)).toBeNull();
  });

  it("accepts the six-digit fallback and refuses a used pairing", async () => {
    const owner = await auth.register({ email: "owner@example.com", password: "correct horse battery" });
    const pairing = auth.openPairing(owner.user.id);
    const device = auth.redeemPairing(pairing.code, "Phone", "127.0.0.1");
    expect(auth.device(device.token)).not.toBeNull();
    expect(() => auth.redeemPairing(pairing.code, "Again", "127.0.0.1")).toThrow(AuthError);
  });

  it("rate-limits repeated failed logins", async () => {
    await auth.register({ email: "owner@example.com", password: "correct horse battery" });
    for (let index = 0; index < 10; index += 1) {
      await expect(
        auth.login({ email: "owner@example.com", password: "wrong password", ip: "10.0.0.1" }),
      ).rejects.toBeInstanceOf(AuthError);
    }
    await expect(
      auth.login({ email: "owner@example.com", password: "correct horse battery", ip: "10.0.0.1" }),
    ).rejects.toMatchObject({ status: 429 });
  });
});
