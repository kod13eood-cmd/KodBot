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

  it("serves the login page in Bulgarian and remembers the choice", async () => {
    const page = await fetch(`${base}/login?lang=bg`);
    expect(page.status).toBe(200);
    expect(page.headers.get("set-cookie")).toContain("kodbot_lang=bg");
    const html = await page.text();
    expect(html).toContain('lang="bg"');
    expect(html).toContain("Създай акаунта на собственика");
    expect(html).toContain("Български");

    const remembered = await fetch(`${base}/login`, {
      headers: { cookie: "kodbot_lang=bg" },
    });
    expect(await remembered.text()).toContain("Създай акаунта на собственика");

    const fromBrowser = await fetch(`${base}/login`, {
      headers: { "accept-language": "bg-BG,bg;q=0.9,en;q=0.8" },
    });
    expect(await fromBrowser.text()).toContain("Създай акаунта на собственика");
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

  it("returns a failed browser form login to the page with an error", async () => {
    await post("/api/auth/register", {
      email: "owner@example.com",
      password: "correct horse battery",
      confirm: "correct horse battery",
    });
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "text/html,application/xhtml+xml",
      },
      body: new URLSearchParams({ email: "owner@example.com", password: "wrong password" }),
      redirect: "manual",
    });
    expect(login.status).toBe(303);
    const location = login.headers.get("location") ?? "";
    const target = new URL(location, base);
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("error")).toBe("Email or password is wrong.");
    expect(target.searchParams.get("mode")).toBe("login");

    const page = await fetch(`${base}${location}`);
    expect(await page.text()).toContain("Email or password is wrong.");
  });

  it("changes the signed-in account password and revokes old sessions", async () => {
    const owner = await post("/api/auth/register", {
      email: "owner@example.com",
      password: "correct horse battery",
      confirm: "correct horse battery",
    });
    const token = (await owner.json()).token as string;

    const wrong = await post(
      "/api/auth/password",
      { currentPassword: "not my password", newPassword: "new horse battery" },
      { authorization: `Bearer ${token}` },
    );
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error).toBe("Current password is wrong.");

    const changed = await post(
      "/api/auth/password",
      { currentPassword: "correct horse battery", newPassword: "new horse battery" },
      { authorization: `Bearer ${token}` },
    );
    expect(changed.status).toBe(200);
    expect((await changed.json()).signedOut).toBe(true);

    expect(
      (await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } })).status,
    ).toBe(401);
    expect(
      (await post("/api/auth/login", { email: "owner@example.com", password: "correct horse battery" })).status,
    ).toBe(401);
    expect(
      (await post("/api/auth/login", { email: "owner@example.com", password: "new horse battery" })).status,
    ).toBe(200);
  });

  it("lets the owner manage users, invites, passwords, and disabled accounts", async () => {
    const owner = await post("/api/auth/register", {
      email: "owner@example.com",
      password: "correct horse battery",
      confirm: "correct horse battery",
    });
    const ownerToken = (await owner.json()).token as string;
    const ownerHeaders = { authorization: `Bearer ${ownerToken}` };

    const bgLogin = await fetch(`${base}/login?lang=bg`);
    expect(await bgLogin.text()).toContain("Забравена парола?");

    const invite = await post("/api/admin/invites", { email: "member@example.com", days: 7 }, ownerHeaders);
    expect(invite.status).toBe(201);
    const inviteBody = await invite.json();
    expect(inviteBody.code).toMatch(/^kb_/);
    expect(inviteBody.email).toBe("member@example.com");

    const member = await post("/api/auth/register", {
      email: "member@example.com",
      password: "member password",
      confirm: "member password",
      invite: inviteBody.code,
    });
    expect(member.status).toBe(201);
    const memberBody = await member.json();
    const memberHeaders = { authorization: `Bearer ${memberBody.token}` };
    expect(memberBody.user.role).toBe("member");

    const users = await fetch(`${base}/api/admin/users`, { headers: ownerHeaders });
    expect(users.status).toBe(200);
    expect((await users.json()).users).toHaveLength(2);
    expect((await fetch(`${base}/api/admin/users`, { headers: memberHeaders })).status).toBe(403);

    const reset = await post(`/api/admin/users/${memberBody.user.id}/password`, {}, ownerHeaders);
    expect(reset.status).toBe(200);
    const resetBody = await reset.json();
    expect(resetBody.password.length).toBeGreaterThanOrEqual(10);
    const oldLogin = await post("/api/auth/login", { email: "member@example.com", password: "member password" });
    expect(oldLogin.status).toBe(401);
    const newLogin = await post("/api/auth/login", { email: "member@example.com", password: resetBody.password });
    expect(newLogin.status).toBe(200);

    const disable = await post(`/api/admin/users/${memberBody.user.id}/disabled`, { disabled: true }, ownerHeaders);
    expect(disable.status).toBe(200);
    expect((await post("/api/auth/login", { email: "member@example.com", password: resetBody.password })).status).toBe(401);
    await post(`/api/admin/users/${memberBody.user.id}/disabled`, { disabled: false }, ownerHeaders);
    expect((await post("/api/auth/login", { email: "member@example.com", password: resetBody.password })).status).toBe(200);

    const pending = await fetch(`${base}/api/admin/invites`, { headers: ownerHeaders });
    expect((await pending.json()).invites).toHaveLength(1);
    const second = await post("/api/admin/invites", { days: 3 }, ownerHeaders);
    const secondCode = (await second.json()).code as string;
    expect(secondCode).toMatch(/^kb_/);
    const list = await fetch(`${base}/api/admin/invites`, { headers: ownerHeaders });
    const invites = (await list.json()).invites;
    const unused = invites.find((entry: any) => !entry.usedAt);
    expect(unused).toBeTruthy();
    expect((await fetch(`${base}/api/admin/invites/${unused.id}`, { method: "DELETE", headers: ownerHeaders })).status).toBe(200);
  });

  it("publishes shared bot templates to members and keeps management owner-only", async () => {
    const owner = await post("/api/auth/register", {
      email: "owner@example.com",
      password: "correct horse battery",
      confirm: "correct horse battery",
    });
    const ownerHeaders = { authorization: `Bearer ${(await owner.json()).token as string}` };
    const publish = await post(
      "/api/admin/shared-bots",
      {
        name: "Scout",
        title: "Researcher",
        description: "Finds sources and summarizes them.",
        memory: "Prefer primary sources. Client work stays in team books.",
      },
      ownerHeaders,
    );
    expect(publish.status).toBe(201);
    const sharedId = (await publish.json()).bot.id as string;

    const invite = await post("/api/admin/invites", { email: "member@example.com" }, ownerHeaders);
    const code = (await invite.json()).code as string;
    const member = await post("/api/auth/register", {
      email: "member@example.com",
      password: "member password",
      confirm: "member password",
      invite: code,
    });
    const memberHeaders = { authorization: `Bearer ${(await member.json()).token as string}` };

    const list = await fetch(`${base}/api/shared-bots`, { headers: memberHeaders });
    expect(list.status).toBe(200);
    const summaries = (await list.json()).bots;
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ id: sharedId, name: "Scout", title: "Researcher" });
    expect("memory" in summaries[0]).toBe(false);

    const detail = await fetch(`${base}/api/shared-bots/${sharedId}`, { headers: memberHeaders });
    expect(detail.status).toBe(200);
    expect((await detail.json()).bot.memory).toContain("Prefer primary sources");

    expect((await fetch(`${base}/api/shared-bots`)).status).toBe(401);
    expect((await post("/api/admin/shared-bots", { name: "Nope" }, memberHeaders)).status).toBe(403);
    expect(
      (await fetch(`${base}/api/admin/shared-bots/${sharedId}`, { method: "DELETE", headers: memberHeaders })).status,
    ).toBe(403);

    expect(
      (await fetch(`${base}/api/admin/shared-bots/${sharedId}`, { method: "DELETE", headers: ownerHeaders })).status,
    ).toBe(200);
    expect((await fetch(`${base}/api/shared-bots/${sharedId}`, { headers: memberHeaders })).status).toBe(404);
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
