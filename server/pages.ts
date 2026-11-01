import { closeSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ensureWorkspace, workspaceDir } from "./workspace.ts";

/** Pages are self-contained HTML documents the bot writes into ./pages/.
 * They are deliberately plain files: any engine already knows how to write
 * one, and the user can still open, copy, or delete them without KodBot. */
export const PAGE_NAME = /^[a-z0-9][a-z0-9._-]{0,80}\.html$/i;
export const PAGE_MAX_BYTES = 2 * 1024 * 1024;

export interface PageSummary {
  name: string;
  title: string;
  bytes: number;
  updatedAt: number;
}

function pageDir(botId: string): string {
  ensureWorkspace(botId);
  return join(workspaceDir(botId), "pages");
}

/** Listing needs only the title, not a 2 MB dashboard per row. Read a bounded
 * head so a workspace full of pages cannot make the list route proportionally
 * expensive. */
function readHead(path: string, maxBytes = 8192): string {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytes = readSync(fd, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytes).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function titleOf(html: string, name: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const text = (title || heading || name.replace(/\.html$/i, "").replace(/[-_]+/g, " "))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 120) || name;
}

export function listPages(botId: string): PageSummary[] {
  const dir = pageDir(botId);
  try {
    return readdirSync(dir)
      .filter((name) => PAGE_NAME.test(name))
      // A page deleted between readdir and stat must not blank the whole list.
      .flatMap((name) => {
        try {
          const path = join(dir, name);
          const stat = statSync(path);
          if (!stat.isFile()) return [];
          return [{ name, title: titleOf(readHead(path), name), bytes: stat.size, updatedAt: stat.mtimeMs }];
        } catch {
          return [];
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 100);
  } catch {
    return [];
  }
}

export function readPage(botId: string, name: string): { name: string; html: string; updatedAt: number } | null {
  if (!PAGE_NAME.test(name)) return null;
  try {
    const path = join(pageDir(botId), name);
    return { name, html: readFileSync(path, "utf8"), updatedAt: statSync(path).mtimeMs };
  } catch {
    return null;
  }
}

export function writePage(botId: string, name: string, html: string): PageSummary {
  if (!PAGE_NAME.test(name)) throw Object.assign(new Error("page name must be a safe .html filename"), { status: 400 });
  if (Buffer.byteLength(html, "utf8") > PAGE_MAX_BYTES) {
    throw Object.assign(new Error("page is too large (max 2 MB)"), { status: 413 });
  }
  const dir = pageDir(botId);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, name);
  writeFileSync(path, html, { mode: 0o600 });
  const stat = statSync(path);
  return { name, title: titleOf(html, name), bytes: stat.size, updatedAt: stat.mtimeMs };
}

export function deletePage(botId: string, name: string): boolean {
  if (!PAGE_NAME.test(name)) return false;
  try {
    unlinkSync(join(pageDir(botId), name));
    return true;
  } catch {
    return false;
  }
}

/** The prompt block that tells an agent pages exist and where to write them.
 * The path is quoted because workspace paths can contain spaces. */
export function pagesSystemPrompt(botId: string): string {
  const dir = join(pageDir(botId));
  return ` You can build private web pages for the user. Write complete self-contained HTML files into ${JSON.stringify(
    dir,
  )}; they appear in this bot's Pages tab and the user can open or share them. Use a page instead of a wall of chat when a dashboard, checklist, report, or visual comparison would be clearer. Keep CSS and JavaScript inline and never put API keys or other secrets in a page. Tell the user the page title when you finish.`;
}
