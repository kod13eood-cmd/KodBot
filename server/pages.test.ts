// Pages are plain self-contained HTML files in the bot's workspace. These
// tests pin the filesystem contract the API and the Pages card rely on.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  deletePage,
  listPages,
  PAGE_MAX_BYTES,
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

  it("tells the bot where pages live without leaking secrets", () => {
    const prompt = pagesSystemPrompt(BOT);
    expect(prompt).toContain(JSON.stringify(join(workspaceDir(BOT), "pages")));
    expect(prompt).toContain("never put API keys");
  });
});
