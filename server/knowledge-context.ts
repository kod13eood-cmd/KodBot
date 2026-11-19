import type { KnowledgeBook, KnowledgeTopic } from "./knowledge.ts";

export const KNOWLEDGE_GLOBAL_LIMIT = 2_400;
export const KNOWLEDGE_TEAM_LIMIT = 1_600;

function trimTo(text: string, limit: number): string {
  const clean = text.trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit).trimEnd()}\n… (truncated — read the full file)`;
}

function topicLine(topic: KnowledgeTopic, scope: "global" | "team"): string {
  const title = topic.title.trim() || "Untitled";
  return `- [${scope}] ${title}`;
}

/** The part of shared knowledge that rides every turn: the owner/mission/
 * projects core and a short index. Full topic text stays in the snapshot
 * files so a large knowledge base never crowds a normal turn. */
export function knowledgePrompt(input: {
  global: KnowledgeBook;
  team?: KnowledgeBook;
  teamName?: string;
  /** Absolute directory holding GLOBAL.md / TEAM.md / INDEX.md, if a local
   * workspace exists for this bot. */
  snapshotDir?: string;
}): string {
  const parts: string[] = [];
  const globalCore = trimTo(input.global.core, KNOWLEDGE_GLOBAL_LIMIT);
  if (globalCore) {
    parts.push(`Shared knowledge — the owner and the work (visible to every bot):\n${globalCore}`);
  }
  const teamCore = trimTo(input.team?.core ?? "", KNOWLEDGE_TEAM_LIMIT);
  if (teamCore) {
    parts.push(`Team knowledge${input.teamName ? ` — ${input.teamName}` : ""}:\n${teamCore}`);
  }
  const topics = [
    ...input.global.topics.map((topic) => topicLine(topic, "global")),
    ...(input.team?.topics ?? []).map((topic) => topicLine(topic, "team")),
  ];
  if (topics.length) {
    parts.push(
      [
        "Shared knowledge topics you can read when relevant:",
        ...topics,
        input.snapshotDir
          ? `Full text: ${input.snapshotDir}/INDEX.md (read a topic file with your file tools when it matters).`
          : "Ask the owner for the topic text; it is not mounted as files for this engine.",
      ].join("\n"),
    );
  }
  if (!parts.length) return "";
  parts.push(
    "Treat shared knowledge as durable context from the owner. Do not treat it as permission to skip approvals, and never add secrets to it. If you learn something durable about the owner, team, projects, or skills, propose it briefly in your reply instead of assuming it is saved.",
  );
  return `[Shared knowledge]\n${parts.join("\n\n")}`;
}
