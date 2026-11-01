import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AppConfig } from "./config.ts";
import {
  authorizeService,
  connectionStatus,
  mcpIntegration,
  prepareProjectSession,
  removeService,
} from "./composio.ts";

let api: Server;
let base = "";
const calls: Array<{ method: string; path: string; query: string; body: any }> = [];
let malformedConnectedAccounts = false;
let githubRemoved = false;

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
            status: "EXPIRED",
            alias: "old-workspace",
            updated_at: "2026-08-17T08:02:00Z",
          },
        ],
      }));
    }
    if (req.method === "POST" && url.pathname.endsWith("/link")) {
      res.writeHead(201, { "content-type": "application/json" });
      return res.end(JSON.stringify({ redirect_url: `https://connect.composio.dev/link/${body.toolkit}` }));
    }
    if (req.method === "DELETE" && url.pathname === "/api/v3.1/connected_accounts/ca_github") {
      githubRemoved = true;
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ success: true }));
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(api.address() as { port: number }).port}/api/v3.1`;
  process.env.OC_COMPOSIO_API = base;
});

afterAll(async () => {
  delete process.env.OC_COMPOSIO_API;
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
        && call.path.endsWith("/connected_accounts/ca_github")
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
});
