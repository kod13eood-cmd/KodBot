import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuthService } from "./auth.ts";
import { loadGatewayConfig, type GatewayConfig } from "./config.ts";
import { createGatewayServer } from "./server.ts";
import { GatewayStore } from "./store.ts";

let root = "";
let config: GatewayConfig;
let store: GatewayStore;
let auth: AuthService;
let server: Server;
let base = "";

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "kodbot-gateway-http-"));
  config = loadGatewayConfig({
    ...process.env,
    OC_GATEWAY_DATA_DIR: join(root, "control"),
    OC_GATEWAY_TENANTS_DIR: join(root, "tenants"),
    OC_GATEWAY_OWNER_DATA_DIR: join(root, "owner"),
    OC_GATEWAY_BOOTSTRAP: "1",
    OC_GATEWAY_PUBLIC_ORIGIN: "http://127.0.0.1:0",
  });
  store = new GatewayStore(config.dataDir);
  auth = new AuthService(store, config);
  server = createGatewayServer({ config, store, auth, serveStatic: false });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  base = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  store.close();
  rmSync(root, { recursive: true, force: true });
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    redirect: "manual",
  });

describe("gateway HTTP auth", () => {
  it("serves health and the login page", async () => {
    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
    expect((await health.json()).app).toBe("kodbot-gateway");

    const page = await fetch(`${base}/login`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Create the owner account");
  });

  it("registers the bootstrap owner and resolves a bearer session", async () => {
    const response = await post("/api/auth/register", {
      email: "owner@example.com",
      password: "correct horse battery",
      confirm: "correct horse battery",
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.role).toBe("owner");
    expect(body.token.startsWith("kbs_")).toBe(true);

    const me = await fetch(`${base}/api/auth/me`, {
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(me.status).toBe(200);
    expect((await me.json()).user.email).toBe("owner@example.com");
  });

  it("sets an HttpOnly session cookie for form login", async () => {
    await post("/api/auth/register", {
      email: "owner@example.com",
      password: "correct horse battery",
      confirm: "correct horse battery",
    });
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "owner@example.com", password: "correct horse battery" }),
      redirect: "manual",
    });
    expect(login.status).toBe(303);
    const cookie = login.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("kodbot_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(login.headers.get("location")).toBe("/");
  });

  it("returns a session token to a mobile JSON login without setting a cookie", async () => {
    await post("/api/auth/register", {
      email: "owner@example.com",
      password: "correct horse battery",
      confirm: "correct horse battery",
    });
    const login = await post("/api/auth/token", {
      email: "owner@example.com",
      password: "correct horse battery",
    });
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toBeNull();
    const body = await login.json();
    expect(body.token.startsWith("kbs_")).toBe(true);
  });

  it("issues a pairing QR and redeems it for a device token", async () => {
    const owner = await post("/api/auth/register", {
      email: "owner@example.com",
      password: "correct horse battery",
      confirm: "correct horse battery",
    });
    const session = (await owner.json()).token as string;
    const pairing = await post("/api/device/pairing", {}, { authorization: `Bearer ${session}` });
    expect(pairing.status).toBe(200);
    const window = await pairing.json();
    expect(window.qr).toContain("kodbot://pair?");
    expect(window.token.startsWith("omb_pair_")).toBe(true);

    const redeemed = await post("/api/pair", { credential: window.token, deviceName: "Phone" });
    expect(redeemed.status).toBe(200);
    const device = await redeemed.json();
    expect(device.token.startsWith("omb_")).toBe(true);

    const devices = await fetch(`${base}/api/devices`, {
      headers: { authorization: `Bearer ${session}` },
    });
    expect(devices.status).toBe(200);
    expect((await devices.json()).devices).toHaveLength(1);
  });

  it("rejects cross-origin writes and unauthenticated API calls", async () => {
    const cross = await post(
      "/api/auth/login",
      { email: "owner@example.com", password: "whatever" },
      { origin: "https://evil.example" },
    );
    expect(cross.status).toBe(403);

    const unauth = await fetch(`${base}/api/bots`);
    expect(unauth.status).toBe(503);
  });

  it("logs out a bearer session", async () => {
    const owner = await post("/api/auth/register", {
      email: "owner@example.com",
      password: "correct horse battery",
      confirm: "correct horse battery",
    });
    const token = (await owner.json()).token as string;
    const logout = await post("/api/auth/logout", {}, { authorization: `Bearer ${token}` });
    expect(logout.status).toBe(200);
    const me = await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } });
    expect(me.status).toBe(401);
  });
});
