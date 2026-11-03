// Pages are plain self-contained HTML files in the bot's workspace. These
// tests pin the filesystem contract the API and the Pages card rely on.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  changedPages,
  deletePage,
  listPages,
  PAGE_MAX_BYTES,
  pageExcerpt,
  pageSnapshot,
  readPage,
  writePage,
  pagesSystemPrompt,
} from "./pages.ts";
import { workspaceDir } from "./workspace.ts";

const BOT = "bot-pages-test";

describe("pages", () => {
  beforeEach(() => {
    rmSync(workspaceDir(BOT), { recursive: true, force: true });
  });

  it("writes, lists, reads and deletes a page", () => {
    expect(listPages(BOT)).toEqual([]);
    const saved = writePage(
      BOT,
      "orders.html",
      "<!doctype html><html><head><title>Open orders</title></head><body><h1>Orders</h1></body></html>",
    );
    expect(saved).toMatchObject({ name: "orders.html", title: "Open orders" });
    expect(saved.bytes).toBeGreaterThan(0);
    expect(listPages(BOT).map((page) => page.name)).toEqual(["orders.html"]);
    expect(readPage(BOT, "orders.html")?.html).toContain("<h1>Orders</h1>");
    expect(deletePage(BOT, "orders.html")).toBe(true);
    expect(readPage(BOT, "orders.html")).toBeNull();
    expect(existsSync(join(workspaceDir(BOT), "pages"))).toBe(true);
  });

  it("turns a page into bounded text for the conversation transcript", () => {
    expect(pageExcerpt("<html><style>.x{}</style><script>alert(1)</script><h1>Orders</h1><p>Two open</p></html>")).toBe(
      "Orders Two open",
    );
    expect(pageExcerpt("<p>" + "x".repeat(5000) + "</p>", 20)).toHaveLength(20);
  });

  it("falls back to a readable title when the HTML has none", () => {
    expect(writePage(BOT, "weekly_report.html", "<p>plain</p>").title).toBe("weekly report");
  });

  it("refuses unsafe names and oversized documents", () => {
    for (const name of ["../secret.html", "a/b.html", "notes.txt", ".hidden.html", ""]) {
      expect(() => writePage(BOT, name, "<p>x</p>"), name).toThrow(/safe \.html filename/);
    }
    expect(readPage(BOT, "../secret.html")).toBeNull();
    expect(deletePage(BOT, "../secret.html")).toBe(false);
    expect(() => writePage(BOT, "big.html", "x".repeat(PAGE_MAX_BYTES + 1))).toThrow(/too large/);
  });

  it("finds only the pages a turn created or rewrote", () => {
    const pages = [
      { name: "old.html", title: "Old", bytes: 10, updatedAt: 100 },
      { name: "new.html", title: "New", bytes: 20, updatedAt: 300 },
      { name: "edited.html", title: "Edited", bytes: 30, updatedAt: 400 },
    ];
    const before = pageSnapshot(pages.slice(0, 1));
    expect(changedPages(before, pages).map((page) => page.name)).toEqual(["new.html", "edited.html"]);
    expect(changedPages(before, pages.slice(0, 1))).toEqual([]);
  });

  it("tells the bot where pages live without leaking secrets", () => {
    const prompt = pagesSystemPrompt(BOT);
    expect(prompt).toContain(JSON.stringify(join(workspaceDir(BOT), "pages")));
    expect(prompt).toContain("never put API keys");
    expect(prompt).not.toContain("Existing pages");
  });

  it("names the pages that already exist so a new session can reuse them", () => {
    const prompt = pagesSystemPrompt(BOT);
    expect(prompt).not.toContain("Existing pages");
    writePage(BOT, "orders.html", "<title>Open orders</title><p>x</p>");
    expect(pagesSystemPrompt(BOT)).toContain('"Open orders" (orders.html');
  });
});
