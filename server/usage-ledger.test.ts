import { rmSync } from "node:fs";

import { beforeEach, describe, expect, it } from "vitest";

import { DATA_DIR } from "./config.ts";
import {
  USAGE_LEDGER_FILE,
  dayStart,
  loadUsage,
  monthStart,
  recordUsage,
  usageCapError,
  usageSummary,
} from "./usage-ledger.ts";

describe("usage ledger and hard caps", () => {
  const now = new Date(2026, 10, 20, 12, 0, 0).getTime();

  beforeEach(() => {
    rmSync(DATA_DIR, { recursive: true, force: true });
  });

  it("separates the bot's day from the app's month", () => {
    recordUsage({ at: dayStart(now) - 1, botId: "bot-a", input: 999, output: 0, costUsd: 9 });
    recordUsage({ at: now, botId: "bot-a", input: 600, output: 400, costUsd: 0.4 });
    recordUsage({ at: now, botId: "bot-b", input: 200, output: 100, costUsd: 0.2 });
    recordUsage({ at: monthStart(now) - 1, botId: "bot-a", input: 5000, output: 5000, costUsd: 50 });

    const summary = usageSummary("bot-a", now);
    expect(summary.botToday).toEqual({ tokens: 1000, costUsd: 0.4, turns: 1 });
    expect(summary.appMonth).toEqual({ tokens: 2299, costUsd: 9.6, turns: 3 });
    expect(USAGE_LEDGER_FILE).toContain("usage-ledger.jsonl");
  });

  it("blocks on a positive cap and treats zero/absent as off", () => {
    recordUsage({ at: now, botId: "bot-a", input: 900_000, output: 200_000, costUsd: 2.5 });
    expect(usageCapError({ botId: "bot-a", caps: { dailyTokenCap: 1_000_000 }, now })).toContain("Daily token cap");
    expect(usageCapError({ botId: "bot-a", caps: { dailyCostCapUsd: 2 }, now })).toContain("Daily cost cap");
    expect(usageCapError({ botId: "bot-a", caps: { monthlyTokenCap: 1_000_000 }, now })).toContain("Monthly app token cap");
    expect(usageCapError({ botId: "bot-a", caps: { monthlyCostCapUsd: 1 }, now })).toContain("Monthly app cost cap");
    expect(usageCapError({ botId: "bot-a", caps: { dailyTokenCap: 0, dailyCostCapUsd: 0 }, now })).toBeNull();
    expect(usageCapError({ botId: "bot-a", caps: {}, now })).toBeNull();
  });

  it("does not count another bot's spend against a per-bot cap", () => {
    recordUsage({ at: now, botId: "bot-b", input: 2_000_000, output: 0, costUsd: 10 });
    expect(usageCapError({ botId: "bot-a", caps: { dailyTokenCap: 1_000_000, dailyCostCapUsd: 1 }, now })).toBeNull();
  });

  it("keeps shared-conversation speaker attribution on disk", () => {
    recordUsage({
      at: now,
      botId: "bot-a",
      threadId: "shared-thread",
      speakerId: "user-1",
      speakerName: "Мария",
      sharedBotId: "shared-1",
      input: 120,
      output: 30,
      costUsd: 0.02,
    });
    expect(loadUsage()).toContainEqual({
      at: now,
      botId: "bot-a",
      threadId: "shared-thread",
      speakerId: "user-1",
      speakerName: "Мария",
      sharedBotId: "shared-1",
      input: 120,
      output: 30,
      costUsd: 0.02,
    });
  });
});
