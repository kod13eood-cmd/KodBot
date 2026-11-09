/** A notification click names the bot and, when the alert came from a task or
 * a room, the exact thread. Resolve it against the fleet on screen before
 * asking the UI to switch chats. */
export interface NotificationTarget {
  botId?: string;
  threadId?: string;
}

interface BotLike {
  id: string;
  threadId: string;
  tasks?: Array<{ threadId: string }>;
}

interface GroupLike {
  id: string;
  threadId: string;
}

export type ResolvedNotification =
  | { kind: "group"; id: string }
  | { kind: "bot"; id: string; taskThreadId?: string };

export function resolveNotificationTarget(
  target: NotificationTarget,
  bots: BotLike[],
  groups: GroupLike[],
): ResolvedNotification | null {
  const threadId = target.threadId?.trim() || undefined;
  const room = threadId ? groups.find((group) => group.threadId === threadId) : undefined;
  if (room) return { kind: "group", id: room.id };

  const bot =
    (target.botId ? bots.find((candidate) => candidate.id === target.botId) : undefined) ??
    (threadId ? bots.find((candidate) => candidate.threadId === threadId) : undefined) ??
    (threadId ? bots.find((candidate) => candidate.tasks?.some((task) => task.threadId === threadId)) : undefined);
  if (!bot) return null;

  const task = threadId ? bot.tasks?.find((candidate) => candidate.threadId === threadId) : undefined;
  return {
    kind: "bot",
    id: bot.id,
    ...(task && task.threadId !== bot.threadId ? { taskThreadId: task.threadId } : {}),
  };
}

/** The WebView hands a notification to the page as a URL when it may still
 * be starting up. Read it once, then remove it so a refresh stays put. */
export function notificationTargetFromUrl(search: string): NotificationTarget | null {
  const params = new URLSearchParams(search);
  const botId = params.get("bot")?.trim() || undefined;
  const threadId = params.get("thread")?.trim() || undefined;
  return botId || threadId ? { botId, threadId } : null;
}

/** Strip only the deep-link keys: gateway/admin query parameters stay put. */
export function withoutNotificationParams(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("bot");
  params.delete("thread");
  const value = params.toString();
  return value ? `?${value}` : "";
}
