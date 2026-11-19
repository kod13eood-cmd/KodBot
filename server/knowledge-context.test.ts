import { describe, expect, it } from "vitest";

import { knowledgePrompt } from "./knowledge-context.ts";

describe("knowledgePrompt", () => {
  it("keeps the core and topic index while leaving full text to files", () => {
    const text = knowledgePrompt({
      global: {
        core: "Owner: Ada\nMission: ship local-first tools.",
        topics: [{ id: "1", title: "Project Atlas", body: "Long brief", updatedAt: 1, updatedBy: "user" }],
      },
      team: { core: "Team: design", topics: [] },
      teamName: "Design",
      snapshotDir: "/tmp/shared-knowledge",
    });
    expect(text).toContain("Owner: Ada");
    expect(text).toContain("Team: design");
    expect(text).toContain("[global] Project Atlas");
    expect(text).toContain("/tmp/shared-knowledge/INDEX.md");
    expect(text).not.toContain("Long brief");
    expect(text).toContain("never add secrets");
  });

  it("returns an empty string when there is nothing to say", () => {
    expect(knowledgePrompt({ global: { core: "", topics: [] } })).toBe("");
  });

  it("truncates a huge core instead of flooding the prompt", () => {
    const text = knowledgePrompt({ global: { core: "x".repeat(10_000), topics: [] } });
    expect(text.length).toBeLessThan(4_000);
    expect(text).toContain("truncated");
  });
});
