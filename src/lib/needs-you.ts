// Who is blocked on a human right now. The sidebar's unread dot says "there
// is news"; this says "a bot cannot continue without you", which is the one
// state worth interrupting for.
import { pendingRequests } from "./approvals";
import type { Message } from "@/state/store";

export type NeedsYouReason = "approval" | "question" | "waiting";

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
  kind: "bot" | "group";
  id: string;
  name: string;
  reason: NeedsYouReason;
  detail?: string;
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
