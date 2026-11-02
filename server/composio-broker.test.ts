// Managed connected-apps account operations go through the broker's Session
// MCP endpoint because the Composio project key never reaches this machine.
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { accountIdentity, authorizeService, removeAccount } from "./composio.ts";

let api: Server;
let base = "";
const calls: Array<{ method: string; url: string; body: any; session?: string }> = [];
let removeCount = 1;
let removeStatus = 200;
let removeError = "The broker refused to revoke this connection.";
let identityEmail = "work@example.com";
let gmailAccounts = 1;

const sse = (value: unknown) =>
  `event: message\ndata: ${JSON.stringify(value)}\n\n`;

beforeAll(async () => {
  api = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    calls.push({
      method: req.method ?? "GET",
      url: req.url ?? "",
      body,
      session: req.headers["mcp-session-id"] as string | undefined,
    });

    if (req.method === "DELETE" && req.url?.startsWith("/v1/connectors/gmail/accounts/")) {
      res.writeHead(removeStatus, { "content-type": "application/json" });
      return res.end(JSON.stringify(removeStatus === 200 ? { removed: removeCount } : { error: removeError }));
    }
    if (req.method === "GET" && req.url?.startsWith("/v1/connectors?services=gmail")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        services: {
          gmail: {
            connected: gmailAccounts > 0,
            status: gmailAccounts > 0 ? "ACTIVE" : "not_connected",
            accounts: Array.from({ length: gmailAccounts }, (_, index) => ({
              id: `ca_${index}`,
              status: "ACTIVE",
            })),
          },
        },
      }));
    }
    if (req.method === "POST" && req.url === "/v1/connectors/gmail/authorize") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ url: "https://connect.composio.dev/link/test" }));
    }
    if (body?.method === "initialize") {
      res.writeHead(200, { "content-type": "text/event-stream", "mcp-session-id": "test-session" });
      return res.end(sse({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18" } }));
    }
    if (body?.method === "tools/call" && body.params?.name === "COMPOSIO_MULTI_EXECUTE_TOOL") {
      const text = JSON.stringify({
        successful: true,
        data: { results: [{ response_data: { emailAddress: identityEmail } }] },
      });
      res.writeHead(200, { "content-type": "text/event-stream" });
      return res.end(sse({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text }], isError: false } }));
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(api.address() as { port: number }).port}`;
  process.env.OC_COMPOSIO_BROKER_URL = base;
  process.env.OC_COMPOSIO_BROKER_TOKEN = "broker-test-token";
});

beforeEach(() => {
  calls.length = 0;
  removeCount = 1;
  removeStatus = 200;
  removeError = "The broker refused to revoke this connection.";
  identityEmail = "work@example.com";
  gmailAccounts = 1;
});

afterAll(async () => {
  delete process.env.OC_COMPOSIO_BROKER_URL;
  delete process.env.OC_COMPOSIO_BROKER_TOKEN;
  await new Promise<void>((resolve) => api.close(() => resolve()));
});

describe("managed connected apps", () => {
  it("removes one account through the broker's per-account route", async () => {
    await expect(removeAccount({}, "gmail", "ca_test")).resolves.toEqual({ removed: 1 });
    const call = calls.find((entry) => entry.method === "DELETE");
    expect(call?.url).toBe("/v1/connectors/gmail/accounts/ca_test");
    expect(call?.body).toBeNull();
  });

  it("treats an already-removed account as gone and surfaces real broker failures", async () => {
    removeCount = 0;
    await expect(removeAccount({}, "gmail", "ca_missing")).resolves.toEqual({ removed: 0 });
    removeStatus = 502;
    await expect(removeAccount({}, "gmail", "ca_missing")).rejects.toThrow(/refused to revoke/i);
  });

  it("adds a unique alias when the service already has an account", async () => {
    gmailAccounts = 1;
    await expect(authorizeService({}, "gmail")).resolves.toEqual({ url: "https://connect.composio.dev/link/test" });
    const call = calls.find((entry) => entry.method === "POST" && entry.url === "/v1/connectors/gmail/authorize");
    expect(call?.body?.alias).toMatch(/^kodbot-gmail-/);
  });

  it("does not send an alias for the first account", async () => {
    gmailAccounts = 0;
    await expect(authorizeService({}, "gmail")).resolves.toEqual({ url: "https://connect.composio.dev/link/test" });
    const call = calls.find((entry) => entry.method === "POST" && entry.url === "/v1/connectors/gmail/authorize");
    expect(call?.body).toBeNull();
  });

  it("resolves the signed-in address from the provider profile tool", async () => {
    await expect(accountIdentity({}, "gmail", "ca_test")).resolves.toEqual({ identity: "work@example.com" });
    const call = calls.find((entry) => entry.body?.params?.name === "COMPOSIO_MULTI_EXECUTE_TOOL");
    expect(call?.body?.params?.arguments).toMatchObject({
      tools: [{ tool_slug: "GMAIL_GET_PROFILE", account: "ca_test" }],
    });
  });

  it("returns a readable reason when the provider has no address", async () => {
    identityEmail = "";
    const result = await accountIdentity({}, "gmail", "ca_test");
    expect(result.identity).toBeNull();
    expect(result.reason).toMatch(/did not return an email/i);
  });
});
