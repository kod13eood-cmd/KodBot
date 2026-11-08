import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuthService } from "./auth.ts";
import { loadGatewayConfig, type GatewayConfig } from "./config.ts";
import type { HarnessManager } from "./harness.ts";
import { createGatewayServer } from "./server.ts";
import { GatewayStore } from "./store.ts";

let root = "";
let config: GatewayConfig;
let store: GatewayStore;
let auth: AuthService;
let gateway: Server;
let upstream: Server;
let base = "";
let upstreamPort = 0;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "kodbot-gateway-proxy-"));
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

  upstream = createServer((req, res) => {
    if (req.url === "/api/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      res.write("data: hello\n\n");
      setTimeout(() => res.end(), 30);
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      path: req.url,
      method: req.method,
      host: req.headers.host,
      cookie: req.headers.cookie ?? null,
      authorization: req.headers.authorization ?? null,
      origin: req.headers.origin ?? null,
    }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  if (!address || typeof address === "string") throw new Error("no upstream port");
  upstreamPort = address.port;

  const harnesses = {
    ensure: async () => ({ userId: "test", port: upstreamPort, child: null, startedAt: 0 }),
  } as unknown as HarnessManager;
  gateway = createGatewayServer({ config, store, auth, harnesses, serveStatic: false });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  const gatewayAddress = gateway.address();
  if (!gatewayAddress || typeof gatewayAddress === "string") throw new Error("no gateway port");
  base = `http://127.0.0.1:${gatewayAddress.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => gateway.close(() => resolve()));
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
  store.close();
  rmSync(root, { recursive: true, force: true });
});

async function ownerToken() {
  const issued = await auth.register({ email: "owner@example.com", password: "correct horse battery" });
  return issued.token;
}

describe("authenticated tenant proxy", () => {
  it("forwards a session request without leaking the gateway cookie or bearer", async () => {
    const token = await ownerToken();
    const response = await fetch(`${base}/api/bots`, {
      headers: { authorization: `Bearer ${token}`, cookie: "kodbot_session=should-not-leak", origin: "http://127.0.0.1:9999" },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.path).toBe("/api/bots");
    expect(body.cookie).toBeNull();
    expect(body.authorization).toBeNull();
    expect(body.origin).toBeNull();
    expect(body.host).toBe(`127.0.0.1:${upstreamPort}`);
  });

  it("streams SSE through the gateway", async () => {
    const token = await ownerToken();
    const response = await fetch(`${base}/api/events`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("data: hello");
  });

  it("lets a device reach an allowlisted route but not host settings", async () => {
    const owner = await auth.register({ email: "owner@example.com", password: "correct horse battery" });
    const pairing = auth.openPairing(owner.user.id);
    const device = auth.redeemPairing(pairing.token, "Phone");

    const fleet = await fetch(`${base}/api/bots`, {
      headers: { authorization: `Bearer ${device.token}` },
    });
    expect(fleet.status).toBe(200);

    const configWrite = await fetch(`${base}/api/config`, {
      method: "PUT",
      headers: { authorization: `Bearer ${device.token}`, "content-type": "application/json" },
      body: "{}",
    });
    expect(configWrite.status).toBe(403);

    const authRoute = await fetch(`${base}/api/auth/me`, {
      headers: { authorization: `Bearer ${device.token}` },
    });
    expect(authRoute.status).toBe(401);
  });

  it("refuses anonymous API calls even when a harness exists", async () => {
    const response = await fetch(`${base}/api/bots`);
    expect(response.status).toBe(401);
  });
});
