import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { translate, hasBulgarianTranslation } from "./i18n";

/** Literal keys used with t("…") across the renderer. Keys built at runtime
 * (section labels, effort levels) are covered by the dictionary itself. */
function literalTranslationKeys(): string[] {
  const keys = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith(".test.ts")) continue;
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/(?<![\w.])t\(\s*"((?:[^"\\]|\\.)*)"/g)) {
        keys.add(match[1]);
      }
    }
  };
  walk("src");
  return [...keys];
}

describe("translate", () => {
  it("keeps English as the source language", () => {
    expect(translate("Refresh", "en")).toBe("Refresh");
  });

  it("translates Bulgarian interface copy", () => {
    expect(translate("Refresh", "bg")).toBe("Обнови");
    expect(translate("Settings", "bg")).toBe("Настройки");
  });

  it("fills named placeholders", () => {
    expect(translate("Message {name}", "en", { name: "Scout" })).toBe("Message Scout");
    expect(translate("Message {name}", "bg", { name: "Scout" })).toBe("Съобщение до Scout");
  });

  it("falls back to the English source when a translation is missing", () => {
    expect(translate("A string that has no translation yet", "bg")).toBe(
      "A string that has no translation yet",
    );
  });

  it("has a Bulgarian entry for every literal t() key", () => {
    const missing = literalTranslationKeys().filter((key) => !hasBulgarianTranslation(key));
    expect(missing).toEqual([]);
  });
});
