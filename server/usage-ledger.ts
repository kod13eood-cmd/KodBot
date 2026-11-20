import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR } from "./config.ts";

export const USAGE_LEDGER_FILE = join(DATA_DIR, "usage-ledger.jsonl");

export interface UsageRecord {
  at: number;
  botId: string;
  threadId?: string;
  input: number;
  output: number;
  costUsd: number | null;
}

export interface UsageTotals {
  tokens: number;
  costUsd: number;
  turns: number;
}

const ZERO: UsageTotals = { tokens: 0, costUsd: 0, turns: 0 };

function clean(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

export function recordUsage(record: Omit<UsageRecord, "at"> & { at?: number }): void {
  const entry: UsageRecord = {
    at: record.at ?? Date.now(),
    botId: record.botId,
    ...(record.threadId ? { threadId: record.threadId } : {}),
    input: clean(record.input),
    output: clean(record.output),
    costUsd:
      typeof record.costUsd === "number" && Number.isFinite(record.costUsd) && record.costUsd >= 0
        ? record.costUsd
        : null,
  };
  mkdirSync(DATA_DIR, { recursive: true });
  appendFileSync(USAGE_LEDGER_FILE, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
}

export function loadUsage(): UsageRecord[] {
  if (!existsSync(USAGE_LEDGER_FILE)) return [];
  try {
    return readFileSync(USAGE_LEDGER_FILE, "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const parsed = JSON.parse(line) as UsageRecord;
          if (!parsed || typeof parsed.at !== "number" || !parsed.botId) return [];
          return [{
            at: parsed.at,
            botId: parsed.botId,
            ...(parsed.threadId ? { threadId: parsed.threadId } : {}),
            input: clean(parsed.input),
            output: clean(parsed.output),
            costUsd:
              typeof parsed.costUsd === "number" && Number.isFinite(parsed.costUsd) && parsed.costUsd >= 0
                ? parsed.costUsd
                : null,
          }];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

export function dayStart(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function monthStart(now: number): number {
  const date = new Date(now);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function totals(records: UsageRecord[]): UsageTotals {
  return records.reduce<UsageTotals>(
    (sum, record) => ({
      tokens: sum.tokens + record.input + record.output,
      costUsd: sum.costUsd + (record.costUsd ?? 0),
      turns: sum.turns + 1,
    }),
    { ...ZERO },
  );
}

/** What this bot and the whole harness have spent in the current windows. */
export function usageSummary(botId: string, now = Date.now()): {
  botToday: UsageTotals;
  appMonth: UsageTotals;
} {
  const records = loadUsage();
  return {
    botToday: totals(records.filter((record) => record.botId === botId && record.at >= dayStart(now))),
    appMonth: totals(records.filter((record) => record.at >= monthStart(now))),
  };
}

export interface UsageCaps {
  dailyTokenCap?: number | null;
  dailyCostCapUsd?: number | null;
  monthlyTokenCap?: number | null;
  monthlyCostCapUsd?: number | null;
}

function fmtTokens(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n);
}

function fmtUsd(n: number): string {
  return `$${n >= 1 ? n.toFixed(2) : n.toFixed(3)}`;
}

/** A non-null string means the next turn must be refused. A cap of 0 or
 * undefined is "off", never "zero allowed" — an empty settings field must
 * not brick a bot. The running turn is never cut off. */
export function usageCapError(input: {
  botId: string;
  caps: UsageCaps;
  now?: number;
}): string | null {
  const { botToday, appMonth } = usageSummary(input.botId, input.now ?? Date.now());
  const tokenCap = input.caps.dailyTokenCap;
  if (typeof tokenCap === "number" && tokenCap > 0 && botToday.tokens >= tokenCap) {
    return `Daily token cap reached (${fmtTokens(botToday.tokens)} of ${fmtTokens(tokenCap)}). Raise it in Bot settings or wait until tomorrow.`;
  }
  const costCap = input.caps.dailyCostCapUsd;
  if (typeof costCap === "number" && costCap > 0 && botToday.costUsd >= costCap) {
    return `Daily cost cap reached (${fmtUsd(botToday.costUsd)} of ${fmtUsd(costCap)}). Raise it in Bot settings or wait until tomorrow.`;
  }
  const monthTokens = input.caps.monthlyTokenCap;
  if (typeof monthTokens === "number" && monthTokens > 0 && appMonth.tokens >= monthTokens) {
    return `Monthly app token cap reached (${fmtTokens(appMonth.tokens)} of ${fmtTokens(monthTokens)}). Raise it in Settings → General.`;
  }
  const monthCost = input.caps.monthlyCostCapUsd;
  if (typeof monthCost === "number" && monthCost > 0 && appMonth.costUsd >= monthCost) {
    return `Monthly app cost cap reached (${fmtUsd(appMonth.costUsd)} of ${fmtUsd(monthCost)}). Raise it in Settings → General.`;
  }
  return null;
}

/** Test helper: remove the ledger between cases, never called at runtime. */
export function _clearUsageLedger(): void {
  try {
    appendFileSync(USAGE_LEDGER_FILE, "");
  } catch {
    /* nothing to clear */
  }
}
