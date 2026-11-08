import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { DATA_DIR } from "./config.ts";
import type { RuntimeEvent } from "./contracts.ts";

export type RoutineSchedule =
  | { type: "once"; at: number }
  | { type: "daily"; time: string; weekdays: number[] }
  | {
      type: "interval";
      /** minutes between runs, 5…1440 */
      everyMinutes: number;
      /** optional wall-clock window; both absent = all day */
      startTime?: string;
      endTime?: string;
      weekdays: number[];
    };

/** `cloud` runs the agent itself inside the bot's Box VM. `crew` keeps
 * using the provider selected on the CREW and only borrows its configured
 * computer tools, if any. */
export type RoutineRunOn = "crew" | "cloud";

export type RoutineRunTrigger = "schedule" | "manual" | "webhook";

export type RoutineRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "missed";

export interface Routine {
  id: string;
  name: string;
  prompt: string;
  botId: string;
  runOn: RoutineRunOn;
  enabled: boolean;
  schedule: RoutineSchedule;
  durationMinutes: number;
  nextRunAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface RoutineRun {
  id: string;
  routineId: string;
  routineName: string;
  /** Snapshot the work so an edited/deleted definition cannot rewrite history. */
  prompt?: string;
  durationMinutes?: number;
  botId: string;
  runOn: RoutineRunOn;
  scheduledFor: number;
  status: RoutineRunStatus;
  manual: boolean;
  /** Why this receipt exists. Kept optional so version-1 files migrate in place. */
  triggerSource?: RoutineRunTrigger;
  webhookId?: string;
  deliveryId?: string;
  threadId?: string;
  startedAt?: number;
  finishedAt?: number;
  output?: string;
  error?: string;
  cost?: number | null;
  denials?: string[];
  createdAt: number;
  seenAt?: number;
  /** When a terminal failure was pushed to the notification path. */
  notifiedAt?: number;
}

export interface RoutineInput {
  name: string;
  prompt: string;
  botId: string;
  runOn?: RoutineRunOn;
  enabled?: boolean;
  schedule: RoutineSchedule;
  durationMinutes?: number;
}

interface RoutineFile {
  version: 1;
  routines: Routine[];
  runs: RoutineRun[];
}

export interface RoutineManagerOptions {
  file?: string;
  now?: () => number;
  /** Keyed frames only: every payload on this bus is `{ kind, … }`, which
   * is what lets the server number and replay them. */
  emit?: (payload: Record<string, unknown>) => void;
  botState: (botId: string) => "ready" | "busy" | "missing";
  createTask: (botId: string, title: string, activate?: boolean) => { threadId: string } | null;
  startTurn: (
    botId: string,
    threadId: string,
    prompt: string,
    runOn: RoutineRunOn,
    triggerSource: RoutineRunTrigger,
    onDispatchError: (message: string) => void,
  ) => Promise<void>;
  interruptTurn?: (botId: string, threadId: string, runOn: RoutineRunOn) => Promise<void>;
  /** Called once when a run ends in a state a human should hear about.
   * Failures and misses are reported; cancellations and successes are not. */
  onRunTerminal?: (run: RoutineRun) => void;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const CATCH_UP_MS = 12 * 60 * 60_000;
const MAX_RUNS = 2_000;

function cleanDays(days: unknown): number[] {
  if (!Array.isArray(days)) return ALL_DAYS;
  const out = [...new Set(days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return out.length ? out : ALL_DAYS;
}

/** `HH:MM` → minutes from midnight. */
function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanSchedule(schedule: RoutineSchedule): RoutineSchedule {
  if (schedule?.type === "once") {
    const at = Number(schedule.at);
    if (!Number.isFinite(at)) throw new Error("Choose a valid date and time");
    return { type: "once", at };
  }
  if (schedule?.type === "daily") {
    const time = String(schedule.time ?? "");
    if (!TIME_PATTERN.test(time)) throw new Error("Time must use HH:MM");
    return { type: "daily", time, weekdays: cleanDays(schedule.weekdays) };
  }
  if (schedule?.type === "interval") {
    const everyMinutes = Math.round(Number(schedule.everyMinutes));
    if (!Number.isFinite(everyMinutes) || everyMinutes < 5 || everyMinutes > 24 * 60) {
      throw new Error("The interval must be between 5 minutes and 24 hours");
    }
    const startTime = schedule.startTime == null ? undefined : String(schedule.startTime);
    const endTime = schedule.endTime == null ? undefined : String(schedule.endTime);
    if ((startTime === undefined) !== (endTime === undefined)) {
      throw new Error("Choose both a start and an end time, or leave the window off");
    }
    if (startTime && endTime) {
      if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) throw new Error("Times must use HH:MM");
      if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        throw new Error("The window must end after it starts");
      }
    }
    return {
      type: "interval",
      everyMinutes,
      ...(startTime && endTime ? { startTime, endTime } : {}),
      weekdays: cleanDays(schedule.weekdays),
    };
  }
  throw new Error("Choose a supported schedule");
}

/** The first slot strictly after `after`, inside the day's window and the
 * selected weekdays. Slots are anchored at the window start, so 09:00–18:00
 * every 15 minutes is 09:00, 09:15 … 17:45 — not a rolling timer that drifts
 * with the process. */
function nextIntervalOccurrence(
  schedule: Extract<RoutineSchedule, { type: "interval" }>,
  after: number,
): number | null {
  const every = schedule.everyMinutes * 60_000;
  const startMinutes = schedule.startTime ? timeToMinutes(schedule.startTime) : 0;
  const endMinutes = schedule.endTime ? timeToMinutes(schedule.endTime) : 24 * 60;
  const weekdays = new Set(cleanDays(schedule.weekdays));
  if (endMinutes <= startMinutes) return null;
  for (let offset = 0; offset <= 8; offset++) {
    const day = new Date(after);
    day.setDate(day.getDate() + offset);
    day.setHours(0, 0, 0, 0);
    if (!weekdays.has(day.getDay())) continue;
    const start = day.getTime() + startMinutes * 60_000;
    const end = day.getTime() + endMinutes * 60_000;
    let slot = start;
    if (slot <= after) slot = start + (Math.floor((after - start) / every) + 1) * every;
    if (slot < end) return slot;
  }
  return null;
}

/** Next wall-clock occurrence in this computer's timezone, strictly after `after`. */
export function nextOccurrence(schedule: RoutineSchedule, after: number): number | null {
  if (schedule.type === "once") return schedule.at > after ? schedule.at : null;
  if (schedule.type === "interval") return nextIntervalOccurrence(schedule, after);
  const [hour, minute] = schedule.time.split(":").map(Number);
  const weekdays = new Set(cleanDays(schedule.weekdays));
  for (let offset = 0; offset <= 8; offset++) {
    const d = new Date(after);
    d.setDate(d.getDate() + offset);
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() > after && weekdays.has(d.getDay())) return d.getTime();
  }
  return null;
}

function sanitizeInput(input: RoutineInput): Omit<Routine, "id" | "createdAt" | "updatedAt" | "nextRunAt"> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  const prompt = String(input.prompt ?? "").trim().slice(0, 20_000);
  const botId = String(input.botId ?? "").trim();
  if (!name) throw new Error("Give the routine a name");
  if (!prompt) throw new Error("Tell the bot what to do");
  if (!botId) throw new Error("Choose a bot");
  const runOn = input.runOn ?? "crew";
  if (runOn !== "crew" && runOn !== "cloud") throw new Error("Choose where this routine runs");
  return {
    name,
    prompt,
    botId,
    runOn,
    enabled: input.enabled !== false,
    schedule: cleanSchedule(input.schedule),
    durationMinutes: Math.min(240, Math.max(15, Math.round(Number(input.durationMinutes) || 30))),
  };
}

export class RoutineManager {
  private readonly file: string;
  private readonly now: () => number;
  private readonly options: RoutineManagerOptions;
  private routines: Routine[] = [];
  private runs: RoutineRun[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(options: RoutineManagerOptions) {
    this.options = options;
    this.file = options.file ?? join(DATA_DIR, "routines.json");
    this.now = options.now ?? Date.now;
    try {
      const disk = JSON.parse(readFileSync(this.file, "utf8")) as Partial<RoutineFile>;
      this.routines = Array.isArray(disk.routines)
        ? disk.routines.map((routine) => ({ ...routine, runOn: routine.runOn ?? "crew" }))
        : [];
      this.runs = Array.isArray(disk.runs)
        ? disk.runs.map((run) => ({ ...run, runOn: run.runOn ?? "crew" }))
        : [];
    } catch {
      this.routines = [];
      this.runs = [];
    }
    // A local process cannot still own these turns after a full restart.
    const recoveredRuns: RoutineRun[] = [];
    for (const run of this.runs) {
      if (run.status === "running" || run.status === "waiting") {
        run.status = "failed";
        run.error = "KodBot restarted while this routine was running";
        run.finishedAt = this.now();
        recoveredRuns.push(run);
      }
    }
    if (recoveredRuns.length) this.save();
    for (const run of recoveredRuns) this.notifyTerminal(run);
  }

  listRoutines(): Routine[] {
    return this.routines.map((r) => ({ ...r, schedule: { ...r.schedule } }));
  }

  listRuns(from?: number, to?: number): RoutineRun[] {
    return this.runs
      .filter((r) => (from == null || r.scheduledFor >= from) && (to == null || r.scheduledFor <= to))
      .sort((a, b) => b.scheduledFor - a.scheduledFor)
      .map((r) => ({ ...r }));
  }

  activeRunForBot(botId: string): RoutineRun | null {
    const run = this.runs.find(
      (candidate) => candidate.botId === botId && ["running", "waiting"].includes(candidate.status),
    );
    return run ? { ...run } : null;
  }

  isActiveThread(threadId: string): boolean {
    return this.runs.some(
      (run) => run.threadId === threadId && ["running", "waiting"].includes(run.status),
    );
  }

  create(input: RoutineInput): Routine {
    const clean = sanitizeInput(input);
    if (this.options.botState(clean.botId) === "missing") throw new Error("That bot no longer exists");
    const at = this.now();
    const routine: Routine = {
      id: randomUUID(),
      ...clean,
      nextRunAt: clean.enabled ? this.initialOccurrence(clean.schedule, at) : null,
      createdAt: at,
      updatedAt: at,
    };
    this.routines.unshift(routine);
    this.save();
    this.emitRoutine(routine);
    return { ...routine, schedule: { ...routine.schedule } };
  }

  update(id: string, patch: Partial<RoutineInput>): Routine | null {
    const routine = this.routines.find((r) => r.id === id);
    if (!routine) return null;
    const clean = sanitizeInput({
      name: patch.name ?? routine.name,
      prompt: patch.prompt ?? routine.prompt,
      botId: patch.botId ?? routine.botId,
      runOn: patch.runOn ?? routine.runOn,
      enabled: patch.enabled ?? routine.enabled,
      schedule: patch.schedule ?? routine.schedule,
      durationMinutes: patch.durationMinutes ?? routine.durationMinutes,
    });
    if (this.options.botState(clean.botId) === "missing") throw new Error("That bot no longer exists");
    Object.assign(routine, clean, {
      nextRunAt: clean.enabled ? this.initialOccurrence(clean.schedule, this.now()) : null,
      updatedAt: this.now(),
    });
    if (patch.enabled === false) {
      for (const run of this.runs) {
        if (run.routineId !== routine.id || run.status !== "queued") continue;
        run.status = "cancelled";
        run.finishedAt = this.now();
        run.error = "The routine was paused before this run started";
        this.emitRun(run);
      }
    }
    this.save();
    this.emitRoutine(routine);
    return { ...routine, schedule: { ...routine.schedule } };
  }

  remove(id: string): boolean {
    const at = this.routines.findIndex((r) => r.id === id);
    if (at === -1) return false;
    this.routines.splice(at, 1);
    for (const run of this.runs) {
      if (run.routineId === id && run.status === "queued") {
        run.status = "cancelled";
        run.finishedAt = this.now();
        this.emitRun(run);
      }
    }
    this.save();
    this.options.emit?.({ kind: "routine.deleted", routineId: id });
    return true;
  }

  disableForBot(botId: string) {
    let changed = false;
    for (const routine of this.routines) {
      if (routine.botId !== botId || !routine.enabled) continue;
      routine.enabled = false;
      routine.nextRunAt = null;
      routine.updatedAt = this.now();
      this.emitRoutine(routine);
      changed = true;
    }
    for (const run of this.runs) {
      if (run.botId !== botId || !["queued", "running", "waiting"].includes(run.status)) continue;
      run.status = "cancelled";
      run.finishedAt = this.now();
      run.error = "The assigned bot was deleted";
      this.emitRun(run);
      if (run.threadId) void this.options.interruptTurn?.(run.botId, run.threadId, run.runOn ?? "crew").catch(() => {});
      changed = true;
    }
    if (changed) this.save();
  }

  runNow(id: string): RoutineRun | null {
    const routine = this.routines.find((r) => r.id === id);
    if (!routine) return null;
    const run = this.newRun(routine, this.now(), true);
    this.save();
    this.emitRun(run);
    queueMicrotask(() => void this.tick());
    return { ...run };
  }

  /** Queue an event-driven job without inventing a calendar schedule. Webhook
   * definitions live in their own store; the execution receipt deliberately
   * reuses this manager so busy-bot ordering, task creation and VM routing stay
   * identical for every unattended job. */
  enqueueWebhook(input: {
    webhookId: string;
    webhookName: string;
    prompt: string;
    botId: string;
    runOn: RoutineRunOn;
    deliveryId: string;
    receivedAt: number;
  }): RoutineRun {
    if (this.options.botState(input.botId) === "missing") {
      throw Object.assign(new Error("The assigned CREW no longer exists"), { status: 410 });
    }
    const run: RoutineRun = {
      id: randomUUID(),
      routineId: input.webhookId,
      routineName: input.webhookName,
      prompt: input.prompt,
      botId: input.botId,
      runOn: input.runOn,
      scheduledFor: input.receivedAt,
      status: "queued",
      manual: false,
      triggerSource: "webhook",
      webhookId: input.webhookId,
      deliveryId: input.deliveryId,
      createdAt: this.now(),
    };
    this.runs.push(run);
    if (this.runs.length > MAX_RUNS) this.runs.splice(0, this.runs.length - MAX_RUNS);
    this.save();
    this.emitRun(run);
    queueMicrotask(() => void this.tick());
    return { ...run };
  }

  activeWebhookRunCount(webhookId: string): number {
    return this.runs.filter(
      (run) => run.webhookId === webhookId && ["queued", "running", "waiting"].includes(run.status),
    ).length;
  }

  cancelQueuedWebhook(webhookId: string, message: string): void {
    let changed = false;
    for (const run of this.runs) {
      if (run.webhookId !== webhookId || run.status !== "queued") continue;
      run.status = "cancelled";
      run.finishedAt = this.now();
      run.error = message.slice(0, 500);
      this.emitRun(run);
      changed = true;
    }
    if (changed) this.save();
  }

  async cancelRun(id: string): Promise<RoutineRun | null> {
    const run = this.runs.find((r) => r.id === id);
    if (!run || !["queued", "running", "waiting"].includes(run.status)) return null;
    run.status = "cancelled";
    run.finishedAt = this.now();
    this.save();
    this.emitRun(run);
    if (run.threadId) await this.options.interruptTurn?.(run.botId, run.threadId, run.runOn ?? "crew").catch(() => {});
    queueMicrotask(() => void this.tick());
    return { ...run };
  }

  markSeen(id: string): RoutineRun | null {
    const run = this.runs.find((r) => r.id === id);
    if (!run) return null;
    if (!run.seenAt) {
      run.seenAt = this.now();
      this.save();
      this.emitRun(run);
    }
    return { ...run };
  }

  start() {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 10_000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = this.now();
      let changed = false;
      for (const routine of this.routines) {
        if (!routine.enabled || routine.nextRunAt == null || routine.nextRunAt > now) continue;
        const scheduledFor = routine.nextRunAt;
        // An interval can come due again before a slow turn ends. Never stack
        // unattended runs for the same routine: advance to the next future
        // slot and let the current run finish.
        const active = this.runs.some(
          (run) =>
            run.routineId === routine.id &&
            ["queued", "running", "waiting"].includes(run.status),
        );
        if (active) {
          routine.nextRunAt = nextOccurrence(routine.schedule, Math.max(now, scheduledFor));
          routine.updatedAt = now;
          this.emitRoutine(routine);
          changed = true;
          continue;
        }
        const late = now - scheduledFor;
        if (late > CATCH_UP_MS) {
          const missed = this.newRun(routine, scheduledFor, false);
          missed.status = "missed";
          missed.finishedAt = now;
          missed.error = "This computer was offline for more than 12 hours after the scheduled time";
          this.save();
          this.emitRun(missed);
          this.notifyTerminal(missed);
        } else {
          const run = this.newRun(routine, scheduledFor, false);
          this.emitRun(run);
        }
        routine.nextRunAt =
          routine.schedule.type === "once" ? null : nextOccurrence(routine.schedule, Math.max(now, scheduledFor));
        if (routine.schedule.type === "once") routine.enabled = false;
        routine.updatedAt = now;
        this.emitRoutine(routine);
        changed = true;
      }
      if (changed) this.save();

      for (const run of [...this.runs].reverse()) {
        if (run.status !== "queued") continue;
        const state = this.options.botState(run.botId);
        if (state === "busy") continue;
        if (state === "missing") {
          run.status = "failed";
          run.error = "The assigned bot no longer exists";
          run.finishedAt = this.now();
          this.save();
          this.emitRun(run);
          this.notifyTerminal(run);
          continue;
        }
        // A webhook is an incoming message, so make its task the bot's live
        // chat immediately. Scheduled work remains detached and unobtrusive.
        const task = this.options.createTask(run.botId, run.routineName, run.triggerSource === "webhook");
        if (!task) {
          run.status = "failed";
          run.error = "Could not create a task for this run";
          run.finishedAt = this.now();
          this.save();
          this.emitRun(run);
          this.notifyTerminal(run);
          continue;
        }
        run.threadId = task.threadId;
        run.startedAt = this.now();
        run.status = "running";
        this.save();
        this.emitRun(run);
        try {
          const prompt = run.prompt ?? this.routines.find((r) => r.id === run.routineId)?.prompt;
          if (!prompt) {
            this.failThread(task.threadId, "The routine was deleted before it could start");
            continue;
          }
          const triggerSource = run.triggerSource ?? (run.manual ? "manual" : "schedule");
          await this.options.startTurn(
            run.botId,
            task.threadId,
            prompt,
            run.runOn ?? "crew",
            triggerSource,
            (message) => this.failThread(task.threadId, message),
          );
        } catch (error) {
          this.failThread(task.threadId, error instanceof Error ? error.message : String(error));
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  handleRuntimeEvent(event: RuntimeEvent) {
    const run = this.runs.find((r) => r.threadId === event.threadId && ["running", "waiting"].includes(r.status));
    if (!run) return;
    if (event.type === "request.opened") {
      run.status = "waiting";
    } else if (event.type === "request.resolved") {
      run.status = "running";
    } else if (event.type === "item.completed" && event.itemType === "assistant_text") {
      run.output = event.text.trim().slice(0, 2_000);
    } else if (event.type === "runtime.error") {
      run.error = event.message.slice(0, 500);
    } else if (event.type === "turn.completed") {
      run.status = event.ok ? "completed" : "failed";
      run.finishedAt = this.now();
      run.error = event.ok ? undefined : (event.stopReason ?? run.error ?? "The bot did not complete this run");
      run.cost = event.cost;
      run.denials = event.denials;
    } else {
      return;
    }
    this.save();
    this.emitRun(run);
    if (event.type === "turn.completed") {
      if (!event.ok) this.notifyTerminal(run);
      queueMicrotask(() => void this.tick());
    }
  }

  failThread(threadId: string, message: string) {
    const run = this.runs.find((r) => r.threadId === threadId && ["running", "waiting"].includes(r.status));
    if (!run) return;
    run.status = "failed";
    run.error = message.slice(0, 500);
    run.finishedAt = this.now();
    this.save();
    this.emitRun(run);
    this.notifyTerminal(run);
    queueMicrotask(() => void this.tick());
  }

  /** Push one terminal failure/miss to the outside world. The persisted
   * timestamp is the dedupe key: repeated SSE frames and process reloads
   * cannot produce a second notification for the same run. */
  private notifyTerminal(run: RoutineRun) {
    if (run.notifiedAt != null) return;
    if (run.status !== "failed" && run.status !== "missed") return;
    run.notifiedAt = this.now();
    this.save();
    try {
      this.options.onRunTerminal?.({ ...run });
    } catch (error) {
      console.error("routines: terminal notification failed", error);
    }
  }

  private initialOccurrence(schedule: RoutineSchedule, now: number): number | null {
    if (schedule.type === "once") return Math.max(schedule.at, now);
    return nextOccurrence(schedule, now);
  }

  private newRun(routine: Routine, scheduledFor: number, manual: boolean): RoutineRun {
    const run: RoutineRun = {
      id: randomUUID(),
      routineId: routine.id,
      routineName: routine.name,
      prompt: routine.prompt,
      durationMinutes: routine.durationMinutes,
      botId: routine.botId,
      runOn: routine.runOn ?? "crew",
      scheduledFor,
      status: "queued",
      manual,
      triggerSource: manual ? "manual" : "schedule",
      createdAt: this.now(),
    };
    this.runs.push(run);
    if (this.runs.length > MAX_RUNS) this.runs.splice(0, this.runs.length - MAX_RUNS);
    return run;
  }

  private emitRoutine(routine: Routine) {
    this.options.emit?.({ kind: "routine", routine: { ...routine, schedule: { ...routine.schedule } } });
  }

  private emitRun(run: RoutineRun) {
    this.options.emit?.({ kind: "routine.run", run: { ...run } });
  }

  private save() {
    mkdirSync(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify({ version: 1, routines: this.routines, runs: this.runs } satisfies RoutineFile, null, 2));
    renameSync(temp, this.file);
  }
}
