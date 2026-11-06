import { describe, expect, it } from "vitest";

import { parseSession, sanitizeAlias, sha256 } from "./index";

describe("connected-apps broker boundaries", () => {
  it("normalizes optional account aliases", () => {
    expect(sanitizeAlias("  work  ")).toBe("work");
    expect(sanitizeAlias(42)).toBe("");
    expect(sanitizeAlias("x".repeat(200))).toHaveLength(80);
  });

  it("accepts only HTTPS Composio MCP endpoints", () => {
    expect(parseSession({
      session_id: "session-1",
      mcp: { url: "https://mcp.composio.dev/session", headers: { "x-session": "one", host: "bad" } },
    })).toEqual({
      sessionId: "session-1",
      url: "https://mcp.composio.dev/session",
      headers: { "x-session": "one" },
    });
    expect(() => parseSession({ session_id: "session-1", mcp: { url: "https://attacker.example/mcp" } })).toThrow(/untrusted/i);
    expect(() => parseSession({ session_id: "session-1", mcp: { url: "http://mcp.composio.dev/session" } })).toThrow(/untrusted/i);
  });

  it("hashes installation tokens before storage", async () => {
    await expect(sha256("opencrew")).resolves.toBe(
      "0c705fb24dd0344ba2f348f253d45084edf8f768022782e58c7ccbb3da5ab61a",
    );
  });
});
