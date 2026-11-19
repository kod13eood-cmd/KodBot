import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import { DATA_DIR } from "./config.ts";
import { redactSecretsInText } from "./redact.ts";

export const KNOWLEDGE_FILE = join(DATA_DIR, "knowledge.json");
export const KNOWLEDGE_CORE_MAX = 8_000;
export const KNOWLEDGE_TOPIC_MAX = 8_000;
export const KNOWLEDGE_TOPICS_MAX = 24;

export interface KnowledgeTopic {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  /** "user" for a person's edit, "bot:<id>" for an approved proposal. */
  updatedBy: string;
}

export interface KnowledgeBook {
  /** The compact layer shown to every turn: who the owner is, mission,
   * active projects, skills, and the rules that matter. */
  core: string;
  topics: KnowledgeTopic[];
}

export interface KnowledgeData {
  version: 1;
  global: KnowledgeBook;
  teams: Record<string, KnowledgeBook>;
}

const EMPTY_BOOK = (): KnowledgeBook => ({ core: "", topics: [] });

export function emptyKnowledge(): KnowledgeData {
  return { version: 1, global: EMPTY_BOOK(), teams: {} };
}

function normalizeBook(value: unknown): KnowledgeBook {
  if (!value || typeof value !== "object") return EMPTY_BOOK();
  const raw = value as { core?: unknown; topics?: unknown };
  const core = typeof raw.core === "string" ? cleanKnowledgeText(raw.core).slice(0, KNOWLEDGE_CORE_MAX) : "";
  const topics = Array.isArray(raw.topics)
    ? raw.topics
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => ({
          id: typeof entry.id === "string" && entry.id ? entry.id : randomUUID(),
          title: typeof entry.title === "string" ? cleanKnowledgeText(entry.title).slice(0, 160) : "",
          body: typeof entry.body === "string" ? cleanKnowledgeText(entry.body).slice(0, KNOWLEDGE_TOPIC_MAX) : "",
          updatedAt: typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now(),
          updatedBy: typeof entry.updatedBy === "string" ? entry.updatedBy.slice(0, 80) : "user",
        }))
        .filter((entry) => entry.title.trim() || entry.body.trim())
        .slice(0, KNOWLEDGE_TOPICS_MAX)
    : [];
  return { core, topics };
}

/** Read the shared knowledge. A missing or malformed file is an empty book,
 * never a failed turn; knowledge is context, not a hard dependency. */
export function loadKnowledge(): KnowledgeData {
  if (!existsSync(KNOWLEDGE_FILE)) return emptyKnowledge();
  try {
    const raw = JSON.parse(readFileSync(KNOWLEDGE_FILE, "utf8")) as {
      global?: unknown;
      teams?: unknown;
    };
    const teams: Record<string, KnowledgeBook> = {};
    if (raw.teams && typeof raw.teams === "object") {
      for (const [teamId, value] of Object.entries(raw.teams as Record<string, unknown>)) {
        if (!teamId) continue;
        teams[teamId] = normalizeBook(value);
      }
    }
    return { version: 1, global: normalizeBook(raw.global), teams };
  } catch {
    return emptyKnowledge();
  }
}

export function saveKnowledge(data: KnowledgeData): KnowledgeData {
  const clean: KnowledgeData = {
    version: 1,
    global: normalizeBook(data.global),
    teams: Object.fromEntries(Object.entries(data.teams).map(([id, book]) => [id, normalizeBook(book)])),
  };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileAtomic(KNOWLEDGE_FILE, `${JSON.stringify(clean, null, 2)}\n`, { mode: 0o600 });
  return clean;
}

/** Shared knowledge is injected into prompts, so it is scrubbed the same way
 * as bot-authored text. It is never the place for API keys or passwords. */
export function cleanKnowledgeText(text: string): string {
  return redactSecretsInText(text).trim();
}

export function saveBook(
  scope: { kind: "global" } | { kind: "team"; teamId: string },
  book: {
    core: string;
    topics: Array<{
      id?: string;
      title: string;
      body: string;
      updatedAt?: number;
      updatedBy?: string;
    }>;
  },
  updatedBy: string,
): KnowledgeData {
  const data = loadKnowledge();
  const now = Date.now();
  const next: KnowledgeBook = {
    core: cleanKnowledgeText(book.core).slice(0, KNOWLEDGE_CORE_MAX),
    topics: book.topics
      .map((topic) => ({
        id: topic.id || randomUUID(),
        title: cleanKnowledgeText(topic.title).slice(0, 160),
        body: cleanKnowledgeText(topic.body).slice(0, KNOWLEDGE_TOPIC_MAX),
        updatedAt: topic.updatedAt ?? now,
        updatedBy: topic.updatedBy ?? updatedBy,
      }))
      .filter((topic) => topic.title || topic.body)
      .slice(0, KNOWLEDGE_TOPICS_MAX),
  };
  if (scope.kind === "global") data.global = next;
  else data.teams[scope.teamId] = next;
  return saveKnowledge(data);
}

/** Pull one titled section (and its body) out of a bot's markdown proposal.
 * Accepts `Knowledge proposal: Title` or a `knowledge` fenced JSON block. */
export function parseKnowledgeProposal(text: string): { title: string; body: string; scope?: "global" | "team" } | null {
  const fenced = text.match(/```knowledge\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1]) as { title?: unknown; body?: unknown; scope?: unknown };
      const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 160) : "";
      const body = typeof parsed.body === "string" ? parsed.body.trim().slice(0, KNOWLEDGE_TOPIC_MAX) : "";
      if (title && body) {
        return {
          title,
          body,
          ...(parsed.scope === "global" || parsed.scope === "team" ? { scope: parsed.scope } : {}),
        };
      }
    } catch {
      /* fall through to the prose marker */
    }
  }
  const marker = text.match(/Knowledge proposal:\s*(.+)\r?\n([\s\S]+)/i);
  if (!marker) return null;
  const title = marker[1].trim().replace(/[#*_`]/g, "").slice(0, 160);
  const body = marker[2].trim();
  if (!title || !body) return null;
  return { title, body: body.slice(0, KNOWLEDGE_TOPIC_MAX) };
}
