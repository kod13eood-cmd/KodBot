// Bot⇄bot comms visibility: channel creation, message mirroring, and
// per-thread chips. Extracted from /api/internal/ask-bot so delegations
// (delegate_bot) and any future peer flow reuse the same UX without a copy.

import { summarize } from "./notify.ts";
import type { BotRecord, GroupRecord, Message, Store } from "./store.ts";

/** What a peer-exchange helper needs from the outside world:
 * the store (for persisted messages + groups) and the SSE broadcasters
 * so chat clients see the change without waiting for a refresh. */
export interface CommsBus {
  store: Store;
  /** SSE broadcast (kind: "message" envelope). */
  broadcast: (payload: Record<string, unknown>) => void;
  /** SSE broadcast (kind: "group" envelope) for a single group. */
}

/** Find or create the bot⇄bot channel for the pair. The channel keeps
 * the pair's full exchange, lives in the sidebar like any room, and the
 * user can open it to chip in. */
export function getOrCreateChannel(store: Store, from: BotRecord, target: BotRecord): GroupRecord {
  return (
    store.dmGroup(from.id, target.id) ??
    store.createGroup(`${from.name} ⇄ ${target.name}`, [from.id, target.id], true)
  );
}

/** Mirror `from`'s outgoing message into the channel, drop chips into
 * both 1:1 threads linking to the channel, and bump the channel's unread
 * count. The chips are what make bot-to-bot turns observable — those
 * turns cost the user tokens, and a hidden exchange is exactly the kind
 * of mistake peer coordination is supposed to avoid. */
export function mirrorExchange(
  bus: CommsBus,
  from: BotRecord,
  target: BotRecord,
  message: string,
  channel: GroupRecord | undefined,
  sourceThreadId = from.threadId,
): void {
  const note = (threadId: string, m: Omit<Message, "id" | "at">) => {
    bus.store.appendMessage(threadId, m);
    return message;
  };
  if (channel) {
    note(channel.threadId, {
      role: "bot",
      kind: "text",
      text: message,
      from: { botId: from.id, name: from.name, color: from.color },
    });
  }
  note(sourceThreadId, {
    role: "bot",
    kind: "activity",
    tool: { name: `Messaged @${target.name}` },
    comm: channel
      ? { groupId: channel.id, withBotId: target.id, withName: target.name, withColor: target.color }
      : undefined,
  });
  note(target.threadId, {
    role: "bot",
    kind: "activity",
    tool: { name: `Message from @${from.name}` },
    comm: channel
      ? { groupId: channel.id, withBotId: from.id, withName: from.name, withColor: from.color }
      : undefined,
  });
  if (channel) {
    bus.store.patchGroup(channel.id, { unread: true });
  }
}

/** Mirror `target`'s reply into the channel so the channel stays the
 * single authoritative record of the exchange. The 1:1 threads already
 * carry their own chips from `mirrorExchange`. */
export function mirrorReply(
  bus: CommsBus,
  target: BotRecord,
  reply: string,
  channel: GroupRecord | undefined,
): void {
  if (!channel || !reply.trim()) return;
  bus.store.appendMessage(channel.threadId, {
    role: "bot",
    kind: "text",
    text: reply,
    from: { botId: target.id, name: target.name, color: target.color },
  });
  bus.store.patchGroup(channel.id, { unread: true });
}

/** Mirror a terminal activity note into the channel — for async handoffs
 * whose terminal state is not a reply (turn failed, was stopped, or never
 * started). Prior art (A2A, MCP Tasks) is unanimous that every terminal
 * state of an async handoff should be visible where the human is looking,
 * and the channel is that place. */
export function mirrorActivity(
  bus: CommsBus,
  from: BotRecord,
  channel: GroupRecord | undefined,
  name: string,
  ok: boolean,
): void {
  if (!channel) return;
  bus.store.appendMessage(channel.threadId, {
    role: "bot",
    kind: "activity",
    tool: { name, ok },
    from: { botId: from.id, name: from.name, color: from.color },
  });
  bus.store.patchGroup(channel.id, { unread: true });
}

/** The source-chat card for a finished handoff. Kept separate from the
 * store write so the wording and link shape can be tested without a fake
 * Store. */
export function buildDelegationTerminalNote(
  target: Pick<BotRecord, "id" | "name" | "color">,
  channel: Pick<GroupRecord, "id"> | undefined,
  ok: boolean,
  reply: string,
  failureName = "Delegated turn did not finish",
): Omit<Message, "id" | "at"> {
  if (!channel) {
    return {
      role: "bot",
      kind: "activity",
      tool: ok
        ? { name: `@${target.name} replied: ${reply.trim() ? summarize(reply, 140) : "completed"}` }
        : { name: `Delegated task failed — ${failureName}`, ok: false },
    };
  }
  return {
    role: "bot",
    kind: "activity",
    tool: ok
      ? { name: `@${target.name} replied: ${reply.trim() ? summarize(reply, 140) : "completed"}` }
      : { name: `Delegated task failed — ${failureName}`, ok: false },
    comm: { groupId: channel.id, withBotId: target.id, withName: target.name, withColor: target.color },
  };
}

/** Finish a delegated handoff. The shared channel keeps the full record;
 * the source chat gets a compact terminal card with a link to that channel,
 * because a fire-and-forget delegation otherwise leaves its result hidden in
 * an auto-created room. */
export function mirrorDelegationTerminal(
  bus: CommsBus,
  target: BotRecord,
  channel: GroupRecord | undefined,
  sourceThreadId: string | undefined,
  ok: boolean,
  reply: string,
  failureName = "Delegated turn did not finish",
): void {
  if (channel) {
    if (ok && reply.trim()) mirrorReply(bus, target, reply, channel);
    else if (ok) mirrorActivity(bus, target, channel, "Delegated turn completed", true);
    else mirrorActivity(bus, target, channel, failureName, false);
  }
  if (!sourceThreadId) return;
  bus.store.appendMessage(
    sourceThreadId,
    buildDelegationTerminalNote(target, channel, ok, reply, failureName),
  );
}
