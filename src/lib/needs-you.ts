// Who is blocked on a human right now. The sidebar's unread dot says "there
// is news"; this says "a bot cannot continue without you", which is the one
// state worth interrupting for.
import { pendingRequests } from "./approvals";
import type { Message } from "@/state/store";

export type NeedsYouReason =
  | "approval"
  | "question"
  | "waiting"
  | "routine-failed"
  | "routine-missed";

export interface NeedsYouCandidate {
  kind: "bot" | "group";
  id: string;
  name: string;
  /** the visible branch for a bot; the room transcript for a group */
  messages: Message[];
  /** bots only: the harness sets "waiting-on-you" when a card reaches a human */
  activity?: string;
  hidden?: boolean;
}

export interface NeedsYouItem {
  kind: "bot" | "group" | "routine";
  id: string;
  name: string;
  reason: NeedsYouReason;
  detail?: string;
}

export interface RoutineFailureCandidate {
  id: string;
  botId: string;
  routineName: string;
  status: "failed" | "missed" | string;
  error?: string;
  seenAt?: number;
}

export interface RoutineFailureBot {
  id: string;
  name: string;
  hidden?: boolean;
}

/** Blocked chats, oldest request first, with a waiting bot counted once even
 * when its request lives in a room rather than its own thread. */
export function collectNeedsYou(
  bots: NeedsYouCandidate[],
  groups: NeedsYouCandidate[],
): NeedsYouItem[] {
  const items: NeedsYouItem[] = [];
  const waitingBots = new Set<string>();

  for (const group of groups) {
    const first = pendingRequests(group.messages)[0];
    if (!first) continue;
    const asker = first.message.from?.botId;
    if (asker) waitingBots.add(asker);
    items.push({
      kind: "group",
      id: group.id,
      name: group.name,
      reason: first.tool ? "approval" : "question",
      detail: first.detail,
    });
  }

  for (const bot of bots) {
    if (bot.hidden) continue;
    const first = pendingRequests(bot.messages)[0];
    if (first) {
      items.push({
        kind: "bot",
        id: bot.id,
        name: bot.name,
        reason: first.tool ? "approval" : "question",
        detail: first.detail,
      });
      continue;
    }
    // A card in a room already named the room; do not also list the member.
    if (bot.activity === "waiting-on-you" && !waitingBots.has(bot.id)) {
      items.push({ kind: "bot", id: bot.id, name: bot.name, reason: "waiting" });
    }
  }

  return items;
}

/** Unseen scheduled runs that ended badly. This is the in-app counterpart to
 * the routine-failed notification; it keeps a failure visible until the user
 * opens the run, instead of leaving it only inside Automations. */
export function collectRoutineFailures(
  runs: RoutineFailureCandidate[],
  bots: RoutineFailureBot[],
): NeedsYouItem[] {
  const byId = new Map(bots.filter((bot) => !bot.hidden).map((bot) => [bot.id, bot]));
  const items: NeedsYouItem[] = [];
  for (const run of runs) {
    if (run.seenAt != null) continue;
    if (run.status !== "failed" && run.status !== "missed") continue;
    const bot = byId.get(run.botId);
    if (!bot) continue;
    items.push({
      kind: "routine",
      id: run.id,
      name: bot.name,
      reason: run.status === "missed" ? "routine-missed" : "routine-failed",
      detail: run.error ? `${run.routineName} — ${run.error}` : run.routineName,
    });
  }
  return items;
}
