import { useEffect, useReducer } from "react";

import { track } from "@/lib/analytics";
import { parseQueueKey, promptQueue } from "@/lib/send-queue";
import { useStore } from "@/state/store";

/** Sends queued prompts, one per busy → idle transition, for every chat.
 *
 * The queue is client-side on purpose: a prompt typed while the bot is
 * working waits above the composer and enters the transcript only when its
 * turn actually starts. This component lives outside the chat so switching
 * bots or rooms does not strand a backlog; see lib/send-queue for the
 * one-at-a-time rule. */
export function SendQueueDrainer() {
  const { state, dispatch } = useStore();
  const [version, bump] = useReducer((count: number) => count + 1, 0);

  useEffect(() => promptQueue.subscribe(bump), []);

  useEffect(() => {
    for (const key of promptQueue.keys()) {
      const target = parseQueueKey(key);
      const bot = target.botId ? state.bots.find((candidate) => candidate.id === target.botId) : undefined;
      const group = target.groupId ? state.groups.find((candidate) => candidate.id === target.groupId) : undefined;
      // A queue for a chat this client has not hydrated yet (or that was
      // deleted) must not be consumed and lost.
      if (!bot && !group) continue;
      const busy = group ? Boolean(group.busyBotId) : Boolean(bot?.busy);
      const next = promptQueue.next(key, busy);
      if (!next) continue;
      if (group) {
        dispatch({ type: "sendGroup", groupId: group.id, text: next.text });
        track("message_sent", { room: true, queued: true });
      } else if (bot) {
        dispatch({ type: "send", botId: bot.id, text: next.text });
        track("message_sent", { driver: bot.modelSelection?.instanceId, queued: true });
      }
    }
  }, [state.bots, state.groups, dispatch, version]);

  return null;
}
