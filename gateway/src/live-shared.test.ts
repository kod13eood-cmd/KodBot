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
let fakeHarness: Server;
let base = "";
let token = "";
const fakeCalls: Array<{ method: string; path: string; body: any }> = [];

function readBody(req: import("node:http").IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const post = (path: string, body: unknown, bearer?: string) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });

beforeEach(async () => {
  fakeCalls.length = 0;
  root = mkdtempSync(join(tmpdir(), "kodbot-shared-live-"));
  fakeHarness = createServer(async (req, res) => {
    const body = req.method === "GET" || req.method === "DELETE" ? {} : await readBody(req);
    fakeCalls.push({ method: req.method ?? "GET", path: req.url ?? "/", body });
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(value));
    };
    if (req.method === "POST" && req.url === "/api/bots") {
      return json(201, { bot: { id: "shared-bot-1", threadId: "shared-thread-1", name: "Shared" } });
    }
    if (req.method === "PATCH" && req.url === "/api/bots/shared-bot-1") return json(200, { bot: {} });
    if (req.method === "PUT" && req.url === "/api/bots/shared-bot-1/memory") return json(200, { ok: true });
    if (req.method === "GET" && req.url?.startsWith("/api/threads/shared-thread-1/messages")) {
      return json(200, {
        messages: [{ id: "m1", role: "bot", kind: "text", text: "Hello from the shared bot", at: 1 }],
      });
    }
    if (req.method === "POST" && req.url === "/api/bots/shared-bot-1/shared-messages") return json(202, { ok: true });
    if (req.method === "GET" && req.url?.startsWith("/api/shared-usage")) {
      return json(200, { members: [{ id: "u1", name: "owner@example.com", input: 10, output: 5, costUsd: 0.01, turns: 1 }] });
    }
    if (req.method === "DELETE" && req.url === "/api/bots/shared-bot-1") return json(200, { ok: true });
    return json(404, { error: "no fake route" });
  });
  await new Promise<void>((resolve) => fakeHarness.listen(0, "127.0.0.1", resolve));
  const address = fakeHarness.address();
  if (!address || typeof address === "string") throw new Error("no fake port");

  config = loadGatewayConfig({
    ...process.env,
    OC_GATEWAY_DATA_DIR: join(root, "control"),
    OC_GATEWAY_TENANTS_DIR: join(root, "tenants"),
    OC_GATEWAY_OWNER_DATA_DIR: join(root, "owner"),
    OC_GATEWAY_SHARED_DATA_DIR: join(root, "shared"),
    OC_ORG_OPENCODE_API_KEY: "org-test-key",
    OC_GATEWAY_BOOTSTRAP: "1",
    OC_GATEWAY_PUBLIC_ORIGIN: "http://127.0.0.1:0",
  });
  store = new GatewayStore(config.dataDir);
  auth = new AuthService(store, config);
  const harnesses = {
    ensureShared: async () => ({ port: address.port }),
    ensure: async () => ({ port: address.port }),
  } as unknown as HarnessManager;
  gateway = createGatewayServer({ config, store, auth, harnesses, serveStatic: false });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  const gatewayAddress = gateway.address();
  if (!gatewayAddress || typeof gatewayAddress === "string") throw new Error("no gateway port");
  base = `http://127.0.0.1:${gatewayAddress.port}`;

  const owner = await post("/api/auth/register", {
    email: "owner@example.com",
    password: "correct horse battery",
    confirm: "correct horse battery",
  });
  token = (await owner.json()).token;
});

afterEach(async () => {
  await new Promise<void>((resolve) => gateway.close(() => resolve()));
  await new Promise<void>((resolve) => fakeHarness.close(() => resolve()));
  store.close();
  rmSync(root, { recursive: true, force: true });
});

describe("live shared conversations", () => {
  it("reads the organization key and shared data directory from env", () => {
    const loaded = loadGatewayConfig({
      ...process.env,
      OC_GATEWAY_SHARED_DATA_DIR: join(root, "shared-custom"),
      OC_ORG_OPENCODE_API_KEY: "org-secret",
    });
    expect(loaded.sharedDataDir).toBe(join(root, "shared-custom"));
    expect(loaded.orgOpenCodeKey).toBe("org-secret");
  });

  it("publishes a live bot on the shared harness and proxies the conversation", async () => {
    const published = await post(
      "/api/admin/shared-bots",
      { name: "Ops", title: "Operations", description: "Team desk", memory: "Be useful.", live: true },
      token,
    );
    expect(published.status).toBe(201);
    const created = await published.json();
    expect(created.bot.live).toBe(true);
    expect(fakeCalls.find((call) => call.method === "POST" && call.path === "/api/bots")?.body).toEqual({
      seedMessages: false,
    });
    expect(fakeCalls.find((call) => call.method === "PATCH")?.body).toMatchObject({ name: "Ops", title: "Operations" });
    expect(fakeCalls.find((call) => call.method === "PUT")?.body).toEqual({ text: "Be useful." });

    const list = await fetch(`${base}/api/shared-bots`, { headers: { authorization: `Bearer ${token}` } });
    expect((await list.json()).bots[0]).toMatchObject({ name: "Ops", live: true });

    const messages = await fetch(`${base}/api/shared-bots/${created.bot.id}/messages`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(messages.status).toBe(200);
    expect((await messages.json()).messages[0].text).toContain("shared bot");

    const sent = await post(`/api/shared-bots/${created.bot.id}/messages`, { text: "status?" }, token);
    expect(sent.status).toBe(202);
    expect(fakeCalls.find((call) => call.method === "POST" && call.path.endsWith("/shared-messages"))?.body).toMatchObject({
      text: "status?",
      speakerName: "owner@example.com",
      sharedBotId: created.bot.id,
    });

    const usage = await fetch(`${base}/api/shared-bots/${created.bot.id}/usage`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(usage.status).toBe(200);
    expect((await usage.json()).members[0]).toMatchObject({ input: 10, output: 5 });

    const settings = await fetch(`${base}/api/admin/shared-bots/settings`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await settings.json()).toEqual({ orgKeyConfigured: true });
  });

  it("lets members read and post but keeps usage owner-only", async () => {
    const invite = await post("/api/admin/invites", { email: "member@example.com" }, token);
    const code = (await invite.json()).code;
    const member = await post("/api/auth/register", {
      email: "member@example.com",
      password: "correct horse battery",
      confirm: "correct horse battery",
      invite: code,
    });
    const memberToken = (await member.json()).token;
    const published = await post("/api/admin/shared-bots", { name: "Ops", live: true }, token);
    const id = (await published.json()).bot.id;

    const list = await fetch(`${base}/api/shared-bots`, { headers: { authorization: `Bearer ${memberToken}` } });
    expect(list.status).toBe(200);
    const messages = await fetch(`${base}/api/shared-bots/${id}/messages`, {
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(messages.status).toBe(200);
    expect((await post(`/api/shared-bots/${id}/messages`, { text: "hello" }, memberToken)).status).toBe(202);
    expect(fakeCalls.find((call) => call.method === "POST" && call.path.endsWith("/shared-messages"))?.body.speakerName).toBe(
      "member@example.com",
    );
    expect(
      (await fetch(`${base}/api/shared-bots/${id}/usage`, { headers: { authorization: `Bearer ${memberToken}` } })).status,
    ).toBe(403);
  });
});
