import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AppConfig } from "./config.ts";
import {
  authorizeService,
  connectionStatus,
  listToolkits,
  mcpIntegration,
  prepareProjectSession,
  removeService,
} from "./composio.ts";

let api: Server;
let base = "";
const calls: Array<{ method: string; path: string; query: string; body: any }> = [];
let malformedConnectedAccounts = false;
let githubRemoved = false;
let linearRemoved = false;

beforeAll(async () => {
  api = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    calls.push({ method: req.method ?? "GET", path: url.pathname, query: url.search, body });

    if (req.headers["x-api-key"] !== "ak_test") {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "invalid project key" } }));
    }

    if (req.method === "POST" && url.pathname === "/api/v3.1/tool_router/session") {
      res.writeHead(201, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        session_id: "trs_test",
        mcp: { type: "http", url: "https://app.composio.dev/tool_router/v3/trs_test/mcp" },
        config: { user_id: body.user_id },
      }));
    }
    if (req.method === "GET" && url.pathname === "/api/v3.1/tool_router/session/trs_test") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        session_id: "trs_test",
        mcp: { type: "http", url: "https://app.composio.dev/tool_router/v3/trs_test/mcp" },
        config: { user_id: "opencrew_existing" },
      }));
    }
    if (req.method === "GET" && url.pathname.endsWith("/toolkits")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        items: [
          githubRemoved ? { slug: "github" } : { slug: "github", connected_account: { id: "ca_github", status: "ACTIVE" } },
          { slug: "gmail", is_no_auth: true },
          { slug: "slack" },
          // The Session exposes the expired account while the lifecycle
          // endpoint below carries the active sibling.
          { slug: "alpaca", connected_account: { id: "ca_alpaca_expired", status: "EXPIRED" } },
        ],
      }));
    }
    if (req.method === "GET" && url.pathname === "/api/v3.1/connected_accounts") {
      res.writeHead(200, { "content-type": "application/json" });
      if (malformedConnectedAccounts) return res.end(JSON.stringify({ items: {} }));
      return res.end(JSON.stringify({
        items: [
          {
            id: "ca_github_primary",
            toolkit: { slug: "github" },
            status: "ACTIVE",
            alias: "octocat",
            updated_at: "2026-08-17T08:00:00Z",
          },
          {
            id: "ca_notion_primary",
            toolkit: { slug: "notion" },
            status: "INITIATED",
            updated_at: "2026-08-17T08:01:00Z",
          },
          {
            id: "ca_linear_primary",
            toolkit: { slug: "linear" },
            status: linearRemoved ? "DELETED" : "EXPIRED",
            alias: "old-workspace",
            updated_at: "2026-08-17T08:02:00Z",
          },
          {
            id: "ca_alpaca_expired",
            toolkit: { slug: "alpaca" },
            status: "EXPIRED",
            updated_at: "2026-08-17T08:03:00Z",
          },
          {
            id: "ca_alpaca_active",
            toolkit: { slug: "alpaca" },
            status: "ACTIVE",
            alias: "kodbot-alpaca-test",
            updated_at: "2026-08-17T08:04:00Z",
          },
        ],
      }));
    }
    if (req.method === "POST" && url.pathname.endsWith("/link")) {
      res.writeHead(201, { "content-type": "application/json" });
      return res.end(JSON.stringify({ redirect_url: `https://connect.composio.dev/link/${body.toolkit}` }));
    }
    if (req.method === "DELETE" && url.pathname === "/api/v3.1/connected_accounts/ca_github_primary") {
      githubRemoved = true;
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ success: true }));
    }
    if (req.method === "DELETE" && url.pathname === "/api/v3.1/connected_accounts/ca_github") {
      githubRemoved = true;
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ success: true }));
    }
    if (req.method === "DELETE" && url.pathname === "/api/v3.1/connected_accounts/ca_linear_primary") {
      linearRemoved = true;
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ success: true }));
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(api.address() as { port: number }).port}/api/v3.1`;
  process.env.OC_COMPOSIO_API = base;
  process.env.OC_COMPOSIO_TOOLKITS_API = base;
});

afterAll(async () => {
  delete process.env.OC_COMPOSIO_API;
  delete process.env.OC_COMPOSIO_TOOLKITS_API;
  await new Promise<void>((resolve) => api.close(() => resolve()));
});

describe.sequential("Composio Sessions", () => {
  it("accepts only project API keys", async () => {
    await expect(prepareProjectSession("old_key")).rejects.toThrow(/start with ak_/i);
    await expect(prepareProjectSession("ak_wrong")).rejects.toThrow(/invalid project key/i);
  });

  it("creates one stable per-installation session and reuses it", async () => {
    const created = await prepareProjectSession("ak_test", { userId: "opencrew_existing" });
    expect(created).toEqual({
      apiKey: "ak_test",
      userId: "opencrew_existing",
      sessionId: "trs_test",
    });
    expect(calls.filter((call) => call.method === "POST" && call.path.endsWith("/session")).at(-1)?.body).toEqual({
      user_id: "opencrew_existing",
      manage_connections: {
        enable: true,
        enable_wait_for_connections: true,
        enable_connection_removal: true,
      },
    });

    const reused = await prepareProjectSession("ak_test", created);
    expect(reused).toEqual({
      apiKey: "ak_test",
      userId: "opencrew_existing",
      sessionId: "trs_test",
    });
  });

  it("keeps Google Search Console in the catalog when the API page omits it", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "opencrew_existing", sessionId: "trs_test" },
    };
    const { cards, source } = await listToolkits(cfg);
    expect(source).toBe("api");
    expect(cards.find((card) => card.slug === "google_search_console")).toMatchObject({
      label: "Google Search Console",
      domain: "search.google.com",
    });
  });

  it("forwards the connection name to Composio as the account alias", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "opencrew_existing", sessionId: "trs_test" },
    };
    await authorizeService(cfg, "notion", "Work Notion");
    const link = calls.filter((call) => call.method === "POST" && call.path.endsWith("/link")).at(-1);
    expect(link?.body).toMatchObject({ toolkit: "notion", alias: "Work Notion" });
  });

  it("mounts the Session MCP endpoint with the project key header", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "opencrew_existing", sessionId: "trs_test" },
    };
    const integration = await mcpIntegration(cfg, {
      harnessUrl: "http://127.0.0.1:8799",
      commsToken: "secret",
      botId: "bot-1",
      threadId: "thread-1",
    });
    expect(integration).toMatchObject({
      command: process.execPath,
      args: [expect.stringContaining("connector-proxy")],
      env: {
        OC_CONNECTOR_UPSTREAM_URL: "http://127.0.0.1:8799/api/internal/connectors/mcp",
        OC_CONNECTOR_UPSTREAM_HEADERS: JSON.stringify({ authorization: "Bearer secret" }),
        OC_HARNESS_URL: "http://127.0.0.1:8799",
        OC_COMMS_TOKEN: "secret",
        OC_BOT_ID: "bot-1",
        OC_THREAD_ID: "thread-1",
      },
    });
  });

  it("reports connection state, creates auth links and revokes disconnects", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "opencrew_existing", sessionId: "trs_test" },
    };
    await expect(connectionStatus(cfg, ["github", "gmail", "slack", "notion", "linear"])).resolves.toEqual({
      github: {
        connected: true,
        pending: false,
        status: "ACTIVE",
        accounts: [{ id: "ca_github_primary", status: "ACTIVE", alias: "octocat" }],
      },
      gmail: { connected: true, pending: false, status: "ACTIVE", accounts: [] },
      slack: { connected: false, pending: false, status: "not_connected", accounts: [] },
      notion: {
        connected: false,
        pending: true,
        status: "INITIATED",
        accounts: [{ id: "ca_notion_primary", status: "INITIATED", alias: undefined }],
      },
      linear: {
        connected: false,
        pending: false,
        status: "EXPIRED",
        accounts: [{ id: "ca_linear_primary", status: "EXPIRED", alias: "old-workspace" }],
      },
    });
    await expect(authorizeService(cfg, "github")).resolves.toEqual({
      url: "https://connect.composio.dev/link/github",
    });
    githubRemoved = false;
    await expect(removeService(cfg, "github")).resolves.toEqual({ removed: 1 });
    expect(calls.some(
      (call) => call.method === "DELETE"
        && call.path.endsWith("/connected_accounts/ca_github_primary")
        && call.query === "?revoke_on_delete=true",
    )).toBe(true);
  });

  it("falls back to session toolkit state when connected-account items is malformed", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "opencrew_existing", sessionId: "trs_test" },
    };
    malformedConnectedAccounts = true;
    githubRemoved = false;
    try {
      // The account-lifecycle read failed, so only the session toolkit state
      // remains — and the shape still carries an explicit empty account list.
      await expect(connectionStatus(cfg, ["github", "slack"])).resolves.toEqual({
        github: { connected: true, pending: false, status: "ACTIVE", accounts: [] },
        slack: { connected: false, pending: false, status: "not_connected", accounts: [] },
      });
    } finally {
      malformedConnectedAccounts = false;
    }
  });

  it("prefers an active account over an expired sibling", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "opencrew_existing", sessionId: "trs_test" },
    };
    await expect(connectionStatus(cfg, ["alpaca"])).resolves.toEqual({
      alpaca: {
        connected: true,
        pending: false,
        status: "ACTIVE",
        accounts: [
          { id: "ca_alpaca_expired", status: "EXPIRED", alias: undefined },
          { id: "ca_alpaca_active", status: "ACTIVE", alias: "kodbot-alpaca-test" },
        ],
      },
    });
  });

  it("removes expired accounts too when disconnecting a service", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "opencrew_existing", sessionId: "trs_test" },
    };
    calls.length = 0;
    linearRemoved = false;
    await expect(removeService(cfg, "linear")).resolves.toEqual({ removed: 1 });
    expect(linearRemoved).toBe(true);
    expect(calls.some(
      (call) => call.method === "DELETE"
        && call.path.endsWith("/connected_accounts/ca_linear_primary")
        && call.query === "?revoke_on_delete=true",
    )).toBe(true);
  });

  it("splits a large catalog status request into broker-sized chunks", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "opencrew_existing", sessionId: "trs_test" },
    };
    calls.length = 0;
    const slugs = Array.from({ length: 60 }, (_, index) => `toolkit_${index}`);
    const result = await connectionStatus(cfg, slugs);
    expect(Object.keys(result)).toHaveLength(60);
    const statusCalls = calls.filter(
      (call) => call.method === "GET" && call.path.endsWith("/toolkits") && call.query.includes("toolkits="),
    );
    expect(statusCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not mint another account link when the app is already connected", async () => {
    const cfg: AppConfig = {
      composio: { apiKey: "ak_test", userId: "opencrew_existing", sessionId: "trs_test" },
    };
    calls.length = 0;
    await expect(
      authorizeService(cfg, "github", undefined, { guardExisting: true }),
    ).resolves.toEqual({ alreadyConnected: true, status: "ACTIVE" });
    expect(calls.some((call) => call.method === "POST" && call.path.endsWith("/link"))).toBe(false);
  });
});
