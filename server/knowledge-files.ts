import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import type { KnowledgeBook, KnowledgeTopic } from "./knowledge.ts";
import { workspaceDir } from "./workspace.ts";

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "topic";
}

function topicFile(scope: "global" | "team", topic: KnowledgeTopic): string {
  return `topics/${scope}-${slugify(topic.title)}-${topic.id.slice(0, 8)}.md`;
}

function bookMarkdown(title: string, book: KnowledgeBook): string {
  const parts = [`# ${title}`, "", book.core.trim() || "_No core notes yet._"];
  for (const topic of book.topics) {
    parts.push("", `## ${topic.title || "Untitled"}`, "", topic.body.trim() || "_Empty._");
  }
  return `${parts.join("\n").trimEnd()}\n`;
}

function writeIfChanged(path: string, content: string): void {
  try {
    if (existsSync(path) && readFileSync(path, "utf8") === content) return;
  } catch {
    /* fall through and write */
  }
  writeFileAtomic(path, content);
}

/** Copy the full shared knowledge into the bot's private workspace. The
 * prompt carries the compact core; these files are what a bot reads when a
 * topic matters. Returns the directory named in the prompt. */
export function syncKnowledgeSnapshot(
  botId: string,
  global: KnowledgeBook,
  team?: KnowledgeBook,
  teamName?: string,
): string {
  const dir = join(workspaceDir(botId), "shared-knowledge");
  mkdirSync(join(dir, "topics"), { recursive: true });

  writeIfChanged(join(dir, "GLOBAL.md"), bookMarkdown("Global shared knowledge", global));
  if (team) {
    writeIfChanged(join(dir, "TEAM.md"), bookMarkdown(`Team knowledge${teamName ? ` — ${teamName}` : ""}`, team));
  }

  const index: string[] = ["# Shared knowledge", ""];
  if (global.core.trim()) index.push("## Global core", "", global.core.trim(), "");
  if (team?.core.trim()) index.push(`## Team core${teamName ? ` — ${teamName}` : ""}`, "", team.core.trim(), "");
  const topics = [
    ...global.topics.map((topic) => ({ scope: "global" as const, topic })),
    ...(team?.topics ?? []).map((topic) => ({ scope: "team" as const, topic })),
  ];
  if (topics.length) {
    index.push("## Topics", "");
    for (const { scope, topic } of topics) {
      const file = topicFile(scope, topic);
      writeIfChanged(
        join(dir, file),
        `# ${topic.title || "Untitled"}\n\n${topic.body.trim() || "_Empty._"}\n`,
      );
      index.push(`- [${scope}] ${topic.title || "Untitled"} — \`${file}\``);
    }
    index.push("");
  }
  index.push(
    "These files are a read-only snapshot, refreshed before each turn. To change shared knowledge, propose the edit in chat; the owner approves it.",
  );
  writeIfChanged(join(dir, "INDEX.md"), `${index.join("\n").trimEnd()}\n`);
  return dir;
}
