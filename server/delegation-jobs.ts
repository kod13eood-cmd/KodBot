import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import { DATA_DIR } from "./config.ts";
import { summarize } from "./notify.ts";

export type DelegationJobStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

/** A bot-to-bot handoff persisted for the Activity view. Routine and webhook
 * jobs are projected from RoutineManager on the client; delegations have no
 * other durable record, so they get their own small file. */
export interface DelegationJob {
  id: string;
  kind: "delegation";
  title: string;
  botId: string;
  botName: string;
  sourceBotId: string;
  sourceBotName: string;
  sourceThreadId: string;
  sourceTaskTitle?: string;
  threadId?: string;
  channelId?: string;
  status: DelegationJobStatus;
  message: string;
  reason?: string;
  result?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface DelegationJobInput {
  /** The queue item's stable id; the job id is `delegation:<itemId>`. */
  itemId: string;
  sourceBotId: string;
  sourceBotName: string;
  sourceThreadId: string;
  sourceTaskTitle?: string;
  targetBotId: string;
  targetBotName: string;
  message: string;
  reason?: string;
}

interface DelegationJobFile {
  version: 1;
  jobs: DelegationJob[];
}

export interface DelegationJobStoreOptions {
  file?: string;
  now?: () => number;
  emit?: (payload: Record<string, unknown>) => void;
}

const MAX_JOBS = 500;

function limited(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function asJob(value: unknown): DelegationJob | null {
  if (!value || typeof value !== "object") return null;
  const job = value as Partial<DelegationJob>;
  if (
    typeof job.id !== "string" ||
    typeof job.botId !== "string" ||
    typeof job.botName !== "string" ||
    typeof job.sourceBotId !== "string" ||
    typeof job.sourceBotName !== "string" ||
    typeof job.sourceThreadId !== "string" ||
    typeof job.status !== "string" ||
    typeof job.createdAt !== "number"
  ) {
    return null;
  }
  return job as DelegationJob;
}

export class DelegationJobStore {
  private readonly file: string;
  private readonly now: () => number;
  private readonly emit?: (payload: Record<string, unknown>) => void;
  private jobs = new Map<string, DelegationJob>();

  constructor(options: DelegationJobStoreOptions = {}) {
    this.file = options.file ?? join(DATA_DIR, "delegation-jobs.json");
    this.now = options.now ?? Date.now;
    this.emit = options.emit;
    this.load();
  }

  list(): DelegationJob[] {
    return [...this.jobs.values()]
      .sort((a, b) => (b.finishedAt ?? b.startedAt ?? b.createdAt) - (a.finishedAt ?? a.startedAt ?? a.createdAt))
      .map((job) => ({ ...job }));
  }

  get(id: string): DelegationJob | null {
    const job = this.jobs.get(id);
    return job ? { ...job } : null;
  }

  create(input: DelegationJobInput): DelegationJob {
    const id = jobId(input.itemId);
    const existing = this.jobs.get(id);
    if (existing) return { ...existing };
    const message = summarize(input.message, 500);
    const job: DelegationJob = {
      id,
      kind: "delegation",
      title: `${input.targetBotName}: ${summarize(input.message, 80)}`,
      botId: input.targetBotId,
      botName: input.targetBotName,
      sourceBotId: input.sourceBotId,
      sourceBotName: input.sourceBotName,
      sourceThreadId: input.sourceThreadId,
      ...(input.sourceTaskTitle ? { sourceTaskTitle: input.sourceTaskTitle } : {}),
      status: "queued",
      message,
      ...(input.reason ? { reason: limited(input.reason, 500) } : {}),
      createdAt: this.now(),
    };
    this.jobs.set(id, job);
    this.trim();
    this.save();
    this.publish(job);
    return { ...job };
  }

  started(id: string, threadId?: string, channelId?: string): DelegationJob | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") return { ...job };
    job.status = "running";
    job.startedAt = this.now();
    if (threadId) job.threadId = threadId;
    if (channelId) job.channelId = channelId;
    this.save();
    this.publish(job);
    return { ...job };
  }

  finish(
    id: string,
    status: "completed" | "failed" | "cancelled",
    result?: string,
    error?: string,
  ): DelegationJob | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return { ...job };
    }
    job.status = status;
    job.finishedAt = this.now();
    if (result) job.result = limited(result, 2_000);
    if (error) job.error = limited(error, 500);
    this.save();
    this.publish(job);
    return { ...job };
  }

  private load(): void {
    try {
      const raw = JSON.parse(readFileSync(this.file, "utf8")) as Partial<DelegationJobFile>;
      const jobs = Array.isArray(raw.jobs) ? raw.jobs.map(asJob).filter((job): job is DelegationJob => job !== null) : [];
      let recovered = false;
      for (const job of jobs) {
        if (job.status === "running" || job.status === "waiting") {
          job.status = "failed";
          job.error = "KodBot restarted while this delegation was running";
          job.finishedAt = this.now();
          recovered = true;
        }
        this.jobs.set(job.id, job);
      }
      this.trim();
      if (recovered) this.save();
    } catch {
      this.jobs.clear();
    }
  }

  private trim(): void {
    const jobs = this.list();
    if (jobs.length <= MAX_JOBS) return;
    for (const job of jobs.slice(MAX_JOBS)) this.jobs.delete(job.id);
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const payload: DelegationJobFile = { version: 1, jobs: this.list() };
      writeFileAtomic(this.file, JSON.stringify(payload, null, 2), { mode: 0o600 });
    } catch (error) {
      console.error("delegation jobs: could not persist", error);
    }
  }

  private publish(job: DelegationJob): void {
    this.emit?.({ kind: "job", job: { ...job } });
  }
}

export function jobId(itemId: string): string {
  return `delegation:${itemId}`;
}
