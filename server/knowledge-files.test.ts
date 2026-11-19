import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { DATA_DIR } from "./config.ts";
import { syncKnowledgeSnapshot } from "./knowledge-files.ts";
import { workspaceDir } from "./workspace.ts";

describe("knowledge snapshot", () => {
  beforeEach(() => {
    rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it("writes a readable index, global book, team book, and topic files", () => {
    const dir = syncKnowledgeSnapshot(
      "knowledge-bot",
      {
        core: "Owner: Ada\nMission: ship.",
        topics: [{ id: "topic-1", title: "Atlas", body: "A long project brief.", updatedAt: 1, updatedBy: "user" }],
      },
      { core: "Team: design", topics: [] },
      "Design",
    );
    expect(dir).toBe(join(workspaceDir("knowledge-bot"), "shared-knowledge"));
    const index = readFileSync(join(dir, "INDEX.md"), "utf8");
    expect(index).toContain("Owner: Ada");
    expect(index).toContain("Team: design");
    expect(index).toContain("[global] Atlas");
    expect(index).toContain("read-only snapshot");
    expect(readFileSync(join(dir, "GLOBAL.md"), "utf8")).toContain("A long project brief.");
    expect(readFileSync(join(dir, "TEAM.md"), "utf8")).toContain("Team: design");
    expect(readFileSync(join(dir, "topics", "global-atlas-topic-1.md"), "utf8")).toContain("A long project brief.");
  });
});
