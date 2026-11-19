import { rmSync } from "node:fs";

import { beforeEach, describe, expect, it } from "vitest";

import { DATA_DIR } from "./config.ts";
import {
  KNOWLEDGE_FILE,
  emptyKnowledge,
  loadKnowledge,
  parseKnowledgeProposal,
  saveBook,
  saveKnowledge,
} from "./knowledge.ts";

describe("shared knowledge store", () => {
  beforeEach(() => {
    rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it("treats a missing file as an empty book", () => {
    expect(loadKnowledge()).toEqual(emptyKnowledge());
  });

  it("round-trips a global core and a team book, redacting secrets", () => {
    const saved = saveKnowledge({
      version: 1,
      global: { core: "Owner: Ada\nKey: sk-ant-abcdefghijklmnopqrstuvwxyz", topics: [] },
      teams: {
        "team-1": {
          core: "",
          topics: [{ id: "t1", title: "Project", body: "Ship it", updatedAt: 1, updatedBy: "user" }],
        },
      },
    });
    expect(saved.global.core).not.toContain("sk-ant-");
    const loaded = loadKnowledge();
    expect(loaded.teams["team-1"]?.topics[0]).toMatchObject({ id: "t1", title: "Project", body: "Ship it" });
    expect(KNOWLEDGE_FILE).toContain("knowledge.json");
  });

  it("replaces only the selected scope", () => {
    saveBook({ kind: "global" }, { core: "global", topics: [] }, "user");
    saveBook({ kind: "team", teamId: "team-1" }, { core: "team", topics: [] }, "user");
    saveBook({ kind: "global" }, { core: "new global", topics: [] }, "user");
    const data = loadKnowledge();
    expect(data.global.core).toBe("new global");
    expect(data.teams["team-1"]?.core).toBe("team");
  });
});

describe("parseKnowledgeProposal", () => {
  it("reads a fenced JSON proposal", () => {
    expect(
      parseKnowledgeProposal('Done.\n```knowledge\n{"title":"Owner","body":"Ada","scope":"global"}\n```'),
    ).toEqual({ title: "Owner", body: "Ada", scope: "global" });
  });

  it("reads the prose marker and rejects empty proposals", () => {
    expect(parseKnowledgeProposal("Knowledge proposal: Stack\nWe use TypeScript.")).toEqual({
      title: "Stack",
      body: "We use TypeScript.",
    });
    expect(parseKnowledgeProposal("Knowledge proposal:\nno title")).toBeNull();
  });
});
