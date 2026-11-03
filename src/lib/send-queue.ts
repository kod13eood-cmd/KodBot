/** Prompts typed while a bot or room is busy wait here — outside the
 * transcript — until the target is idle again. The queue lives at module
 * scope for two reasons: the composer unmounts when the user switches chats,
 * and the page bridge sends from outside the chat. Both must reach the same
 * backlog.
 *
 * Prompts leave one at a time. After a dispatch the queue waits until the
 * target is actually observed busy, otherwise a burst of state updates could
 * fire the whole backlog at a target that has not had a chance to start its
 * first turn.
 */

export interface QueuedReply {
  id: string;
  role: "user" | "bot";
  text: string;
  /** Display name of the quoted author ("Mochi" or "You"). */
  name: string;
}

export interface QueuedPrompt {
  id: number;
  text: string;
  /** The message this prompt answers, when the user picked one. */
  replyTo?: QueuedReply;
}

export interface PromptQueue {
  /** Prompts waiting for `key`, oldest first. Empty when nothing is queued. */
  prompts(key: string): readonly QueuedPrompt[];
  /** Keys that currently hold at least one prompt. */
  keys(): string[];
  enqueue(key: string, text: string, replyTo?: QueuedReply): void;
  /** Drop one prompt — the discard button on a queued card. */
  drop(key: string, id: number): void;
  /** The next prompt to send, or null when the target must wait. Consumes
   * the prompt: call it immediately before dispatching. */
  next(key: string, busy: boolean): QueuedPrompt | null;
  subscribe(listener: () => void): () => void;
}

const EMPTY: readonly QueuedPrompt[] = [];

export function queueKeyForBot(botId: string): string {
  return `bot:${botId}`;
}

export function queueKeyForGroup(groupId: string): string {
  return `group:${groupId}`;
}

/** `bot:<id>` / `group:<id>` back to the target it addresses. */
export function parseQueueKey(key: string): { botId?: string; groupId?: string } {
  if (key.startsWith("group:")) return { groupId: key.slice("group:".length) };
  if (key.startsWith("bot:")) return { botId: key.slice("bot:".length) };
  return {};
}

export function createPromptQueue(): PromptQueue {
  const queues = new Map<string, QueuedPrompt[]>();
  // Keys whose prompt was just dispatched: wait for busy to appear before
  // sending the next one.
  const awaitingBusy = new Set<string>();
  const listeners = new Set<() => void>();
  let sequence = 0;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    prompts(key) {
      return queues.get(key) ?? EMPTY;
    },
    keys() {
      return [...queues.keys()];
    },
    enqueue(key, text, replyTo) {
      if (!text.trim()) return;
      const list = queues.get(key) ?? [];
      queues.set(key, [...list, { id: ++sequence, text, ...(replyTo ? { replyTo } : {}) }]);
      notify();
    },
    drop(key, id) {
      const list = queues.get(key);
      if (!list) return;
      const nextList = list.filter((prompt) => prompt.id !== id);
      if (nextList.length) queues.set(key, nextList);
      else queues.delete(key);
      notify();
    },
    next(key, busy) {
      if (busy) {
        // A turn is running: the previous prompt landed, so the hold lifts
        // and the next idle transition may send.
        awaitingBusy.delete(key);
        return null;
      }
      if (awaitingBusy.has(key)) return null;
      const list = queues.get(key);
      if (!list?.length) return null;
      const [head, ...rest] = list;
      if (rest.length) queues.set(key, rest);
      else queues.delete(key);
      awaitingBusy.add(key);
      notify();
      return head!;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The app-wide queue. */
export const promptQueue = createPromptQueue();
