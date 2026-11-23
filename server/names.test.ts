import { describe, expect, it } from "vitest";

import { BOT_NAME_POOLS, pickBotName } from "./names.ts";

describe("bot names", () => {
  it("keeps the English pool as the default for API callers", () => {
    const name = pickBotName([]);
    expect(BOT_NAME_POOLS.english).toContain(name);
  });

  it("uses Cyrillic Bulgarian names when asked", () => {
    const name = pickBotName([], "bulgarian");
    expect(BOT_NAME_POOLS.bulgarian).toContain(name);
    expect(name).toMatch(/^[А-Яа-яЁё-]+$/);
  });

  it("keeps both pools unique and on-script", () => {
    expect(new Set(BOT_NAME_POOLS.english).size).toBe(BOT_NAME_POOLS.english.length);
    expect(new Set(BOT_NAME_POOLS.bulgarian).size).toBe(BOT_NAME_POOLS.bulgarian.length);
    for (const name of BOT_NAME_POOLS.bulgarian) {
      expect(name).toMatch(/^[А-Яа-яЁё-]+$/);
    }
  });

  it("avoids names already in use", () => {
    const taken = BOT_NAME_POOLS.bulgarian.slice(0, -1);
    expect(pickBotName(taken, "bulgarian")).toBe(BOT_NAME_POOLS.bulgarian.at(-1));
  });

  it("numbers names once the pool is exhausted", () => {
    const taken = [...BOT_NAME_POOLS.bulgarian];
    const name = pickBotName(taken, "bulgarian");
    expect(name).toMatch(new RegExp(`^(${BOT_NAME_POOLS.bulgarian.join("|")}) 2$`));
  });
});
