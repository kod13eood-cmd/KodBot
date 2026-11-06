import { describe, expect, it } from "vitest";

import { connectedAppsSystemPrompt, type ConnectedAppsPromptContext } from "./connected-apps-prompt.ts";

const base: ConnectedAppsPromptContext = {
  mounted: false,
  configured: true,
  engineSupports: true,
  botEnabled: true,
};

describe("connected-apps system prompt", () => {
  it("teaches a mounted bot to discover and execute tools", () => {
    const prompt = connectedAppsSystemPrompt({ ...base, mounted: true });
    expect(prompt).toContain("COMPOSIO_SEARCH_TOOLS");
    expect(prompt).toContain("COMPOSIO_MULTI_EXECUTE_TOOL");
    expect(prompt).toContain("puzzle icon");
  });

  it("points at the connection settings when the harness is not configured", () => {
    const prompt = connectedAppsSystemPrompt({ ...base, configured: false });
    expect(prompt).toContain("Connected apps");
    expect(prompt).toContain("App Settings → Connections");
    expect(prompt).toContain("Do not say the app is unavailable");
  });

  it("explains when the selected engine cannot use connected apps", () => {
    const prompt = connectedAppsSystemPrompt({ ...base, engineSupports: false });
    expect(prompt).toContain("engine cannot mount connected apps");
    expect(prompt).toContain("Bot settings → Model");
  });

  it("names both places that turn access back on for a disabled bot", () => {
    const prompt = connectedAppsSystemPrompt({ ...base, botEnabled: false });
    expect(prompt).toContain("access is switched off");
    expect(prompt).toContain("gear icon next to this bot");
    expect(prompt).toContain("Connected apps");
    expect(prompt).toContain("Allow this bot to use connected apps");
    expect(prompt).toContain("puzzle icon in the sidebar");
    expect(prompt).toContain("Allow for all bots");
    expect(prompt).toContain("do not say the app is not connected");
  });

  it("keeps a fallback for any other missing mount", () => {
    const prompt = connectedAppsSystemPrompt(base);
    expect(prompt).toContain("not available to this bot");
    expect(prompt).toContain("Bot settings");
    expect(prompt).toContain("Connected apps panel");
  });
});
