import type { RoutineRun } from "./routines";

export type JobKind = "turn" | "routine" | "webhook" | "delegation";
export type JobStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "missed"
  | "cancelled";

/** The read model shared by the Activity view. Routine jobs are projected
 * from the routine run receipts; delegation jobs come from the server's
 * DelegationJobStore; live turn jobs are derived from busy bots. */
export interface Job {
  id: string;
  kind: JobKind;
  title: string;
  botId: string;
  botName: string;
  sourceBotId?: string;
  sourceBotName?: string;
  sourceThreadId?: string;
  sourceTaskTitle?: string;
  threadId?: string;
  channelId?: string;
  routineId?: string;
  status: JobStatus;
  message?: string;
  reason?: string;
  result?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  scheduledFor?: number;
}

export interface RoutineJobBot {
  id: string;
  name: string;
}

export interface ActiveTurnBot {
  id: string;
  name: string;
  busy?: boolean;
  threadId: string;
  tasks?: Array<{ threadId: string; title: string; createdAt: number }>;
}

export interface ActiveTurnGroup {
  id: string;
  name: string;
  threadId: string;
  busyBotId?: string | null;
  createdAt: number;
}

export function routineRunToJob(run: RoutineRun, bots: RoutineJobBot[]): Job {
  const bot = bots.find((entry) => entry.id === run.botId);
  return {
    id: `routine:${run.id}`,
    kind: run.webhookId || run.triggerSource === "webhook" ? "webhook" : "routine",
    title: run.routineName,
    botId: run.botId,
    botName: bot?.name ?? "Unknown bot",
    routineId: run.routineId,
    status: run.status,
    ...(run.threadId ? { threadId: run.threadId } : {}),
    ...(run.prompt ? { message: run.prompt } : {}),
    ...(run.output ? { result: run.output } : {}),
    ...(run.error ? { error: run.error } : {}),
    createdAt: run.createdAt,
    ...(run.startedAt ? { startedAt: run.startedAt } : {}),
    ...(run.finishedAt ? { finishedAt: run.finishedAt } : {}),
    scheduledFor: run.scheduledFor,
  };
}

/** A busy bot with no routine/delegation job claiming its current thread. The
 * Activity view uses this to answer “who is working right now?” without
 * inventing a durable job record for every chat turn. */
export function activeTurnJobs(bots: ActiveTurnBot[]): Job[] {
  return bots
    .filter((bot) => bot.busy === true && bot.threadId)
    .map((bot) => {
      const task = bot.tasks?.find((entry) => entry.threadId === bot.threadId);
      return {
        id: `turn:${bot.id}:${bot.threadId}`,
        kind: "turn" as const,
        title: task?.title ?? bot.name,
        botId: bot.id,
        botName: bot.name,
        threadId: bot.threadId,
        status: "running" as const,
        createdAt: task?.createdAt ?? Date.now(),
        startedAt: task?.createdAt ?? Date.now(),
      };
    });
}

/** A room whose current member turn is running. The bot's own 1:1 thread is
 * not the transcript for this work, so Activity must link to the room. */
export function activeGroupTurnJobs(groups: ActiveTurnGroup[], bots: RoutineJobBot[]): Job[] {
  const names = new Map(bots.map((bot) => [bot.id, bot.name]));
  return groups.flatMap((group) => {
    if (!group.busyBotId) return [];
    return [{
      id: `turn:group:${group.id}:${group.busyBotId}`,
      kind: "turn" as const,
      title: group.name,
      botId: group.busyBotId,
      botName: names.get(group.busyBotId) ?? "Unknown bot",
      threadId: group.threadId,
      status: "running" as const,
      createdAt: group.createdAt,
      startedAt: group.createdAt,
    }];
  });
}

export function jobGroup(status: JobStatus): "attention" | "running" | "done" {
  if (status === "failed" || status === "missed" || status === "waiting") return "attention";
  if (status === "queued" || status === "running") return "running";
  return "done";
}

export function jobTimestamp(job: Job): number {
  return job.finishedAt ?? job.startedAt ?? job.createdAt;
}
