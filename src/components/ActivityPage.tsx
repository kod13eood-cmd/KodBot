import { useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  GitBranch,
  Loader2,
  Workflow,
} from "lucide-react";

import { useI18n } from "@/lib/i18n";
import {
  activeGroupTurnJobs,
  activeTurnJobs,
  jobGroup,
  jobTimestamp,
  routineRunToJob,
  type Job,
  type JobStatus,
} from "@/lib/jobs";
import { cn } from "@/lib/cn";
import { useStore } from "@/state/store";

type Filter = "all" | "attention" | "running" | "done";

function statusLabel(t: (key: string) => string, status: JobStatus): string {
  switch (status) {
    case "queued":
      return t("Queued");
    case "running":
      return t("Running");
    case "waiting":
      return t("Waiting for you");
    case "completed":
      return t("Completed");
    case "failed":
      return t("Failed");
    case "missed":
      return t("Missed");
    case "cancelled":
      return t("Cancelled");
  }
}

function statusTone(status: JobStatus): string {
  if (status === "failed" || status === "missed") return "text-danger";
  if (status === "waiting") return "text-warning";
  if (status === "completed") return "text-success";
  if (status === "cancelled") return "text-ink-secondary";
  return "text-accent";
}

function kindLabel(t: (key: string) => string, job: Job): string {
  if (job.kind === "delegation") return t("Delegated");
  if (job.kind === "webhook") return t("Webhook");
  if (job.kind === "turn") return t("Live");
  return t("Scheduled");
}

function StatusIcon({ status }: { status: JobStatus }) {
  if (status === "failed" || status === "missed") return <CircleAlert size={17} />;
  if (status === "waiting") return <Clock3 size={17} />;
  if (status === "completed") return <CheckCircle2 size={17} />;
  if (status === "cancelled") return <CheckCircle2 size={17} />;
  return <Loader2 size={17} className="animate-spin" />;
}

function timeLabel(at: number | undefined): string {
  if (!at) return "";
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityPage() {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [botFilter, setBotFilter] = useState("all");

  const jobs = useMemo(() => {
    const routine = state.routineRuns.map((run) => routineRunToJob(run, state.bots));
    const claimed = new Set(
      [...routine, ...state.delegationJobs]
        .filter((job) => ["queued", "running", "waiting"].includes(job.status))
        .map((job) => job.threadId)
        .filter((threadId): threadId is string => Boolean(threadId)),
    );
    const roomLive = activeGroupTurnJobs(state.groups, state.bots).filter(
      (job) => !job.threadId || !claimed.has(job.threadId),
    );
    const roomBusyBots = new Set(roomLive.map((job) => job.botId));
    const live = activeTurnJobs(state.bots).filter(
      (job) =>
        !roomBusyBots.has(job.botId) &&
        (!job.threadId || !claimed.has(job.threadId)),
    );
    return [...routine, ...state.delegationJobs, ...roomLive, ...live].sort((a, b) => {
      const groupOrder = { attention: 0, running: 1, done: 2 };
      const byGroup = groupOrder[jobGroup(a.status)] - groupOrder[jobGroup(b.status)];
      return byGroup || jobTimestamp(b) - jobTimestamp(a);
    });
  }, [state.routineRuns, state.delegationJobs, state.bots, state.groups]);

  const counts = useMemo(() => {
    const next = { attention: 0, running: 0, done: 0 };
    for (const job of jobs) next[jobGroup(job.status)] += 1;
    return next;
  }, [jobs]);

  const visible = jobs.filter((job) => {
    if (filter !== "all" && jobGroup(job.status) !== filter) return false;
    if (botFilter !== "all" && job.botId !== botFilter) return false;
    return true;
  });

  const openJob = (job: Job) => {
    if (job.channelId && state.groups.some((group) => group.id === job.channelId)) {
      dispatch({ type: "select", id: job.channelId });
      return;
    }
    if (job.threadId) {
      const room = state.groups.find((group) => group.threadId === job.threadId);
      if (room) {
        dispatch({ type: "select", id: room.id });
        return;
      }
      const bot = state.bots.find((entry) => entry.id === job.botId);
      if (bot) {
        if (job.threadId !== bot.threadId && bot.tasks?.some((task) => task.threadId === job.threadId)) {
          dispatch({ type: "switchTask", botId: bot.id, threadId: job.threadId });
        }
        dispatch({ type: "select", id: bot.id });
        return;
      }
    }
    if (job.kind === "delegation" && job.sourceBotId && job.sourceThreadId) {
      const source = state.bots.find((entry) => entry.id === job.sourceBotId);
      if (source) {
        if (job.sourceThreadId !== source.threadId && source.tasks?.some((task) => task.threadId === job.sourceThreadId)) {
          dispatch({ type: "switchTask", botId: source.id, threadId: job.sourceThreadId });
        }
        dispatch({ type: "select", id: source.id });
        return;
      }
    }
    if (job.kind === "routine" || job.kind === "webhook") {
      dispatch({ type: "showRoutines" });
      return;
    }
    if (job.kind === "turn") dispatch({ type: "select", id: job.botId });
  };

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: t("All"), count: jobs.length },
    { key: "attention", label: t("Needs attention"), count: counts.attention },
    { key: "running", label: t("Running"), count: counts.running },
    { key: "done", label: t("Done"), count: counts.done },
  ];

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-app">
      <header
        className={cn(
          "shrink-0 px-5 pb-4 pt-4 pl-11 md:pl-5",
          window.ogb?.windowControls && "pr-[148px]",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <ActivityIcon size={21} className="text-accent" />
              <h1 className="text-[20px] font-semibold tracking-tight text-ink">{t("Activity")}</h1>
            </div>
            <p className="mt-1 text-[12.5px] text-ink-secondary">
              {t("Scheduled and delegated work, and what needs you.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {counts.attention > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-danger/25 bg-danger/10 px-2.5 py-1.5 text-[11px] text-danger">
                <CircleAlert size={12} />
                {t("{count} need attention", { count: counts.attention })}
              </span>
            )}
            {counts.running > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1.5 text-[11px] text-accent">
                <Loader2 size={12} className="animate-spin" />
                {t("{count} active", { count: counts.running })}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-panel p-1">
            {filters.map((entry) => (
              <button
                key={entry.key}
                onClick={() => setFilter(entry.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium",
                  filter === entry.key
                    ? "bg-raised text-ink shadow"
                    : "text-ink-secondary hover:text-ink",
                )}
              >
                {entry.label}
                <span className="tabular-nums opacity-60">{entry.count}</span>
              </button>
            ))}
          </div>
          <select
            value={botFilter}
            onChange={(event) => setBotFilter(event.target.value)}
            className="rounded-xl border border-hairline/50 bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-accent/60"
          >
            <option value="all">{t("All bots")}</option>
            {state.bots
              .filter((bot) => !bot.hidden)
              .map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
          </select>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {visible.length === 0 ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-center text-ink-secondary">
            <ActivityIcon size={28} className="opacity-40" />
            <div className="text-[14px] font-medium text-ink">{t("No background work here.")}</div>
            <div className="max-w-sm text-[12.5px]">
              {t("Scheduled runs, webhooks, delegations, and live turns will appear here.")}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((job) => (
              <JobCard key={job.id} job={job} onOpen={() => openJob(job)} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function JobCard({ job, onOpen }: { job: Job; onOpen: () => void }) {
  const { t } = useI18n();
  const attention = jobGroup(job.status) === "attention";
  const live = job.kind === "turn";
  const detail = job.error ?? job.result ?? job.message;
  return (
    <article
      className={cn(
        "rounded-xl border bg-panel px-4 py-3",
        attention ? "border-danger/35" : "border-hairline/50",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn("mt-0.5 shrink-0", statusTone(job.status))}>
          <StatusIcon status={job.status} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[14px] font-medium text-ink">{job.title}</h2>
            <span className="rounded-full bg-raised px-2 py-0.5 text-[10.5px] text-ink-secondary">
              {kindLabel(t, job)}
            </span>
            <span className={cn("text-[11px]", statusTone(job.status))}>{statusLabel(t, job.status)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-secondary">
            {job.kind === "delegation" && job.sourceBotName ? (
              <span className="inline-flex items-center gap-1">
                {job.sourceBotName} <ArrowRight size={11} /> {job.botName}
              </span>
            ) : (
              <span>{job.botName}</span>
            )}
            {job.scheduledFor && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock size={11} /> {timeLabel(job.scheduledFor)}
              </span>
            )}
            {job.finishedAt && <span>{timeLabel(job.finishedAt)}</span>}
            {!job.finishedAt && job.startedAt && (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" /> {timeLabel(job.startedAt)}
              </span>
            )}
            {job.sourceTaskTitle && (
              <span className="inline-flex items-center gap-1">
                <GitBranch size={11} /> {job.sourceTaskTitle}
              </span>
            )}
          </div>
          {detail && (
            <p
              className={cn(
                "mt-2 line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-relaxed",
                job.error ? "text-danger" : "text-ink-secondary",
              )}
            >
              {detail}
            </p>
          )}
          {job.reason && <p className="mt-1 text-[11.5px] text-ink-secondary">{job.reason}</p>}
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 rounded-lg bg-raised px-3 py-1.5 text-[12px] text-ink hover:bg-raised-hover"
        >
          <span className="inline-flex items-center gap-1.5">
            {live ? <Workflow size={13} /> : null}
            {t("Open")}
          </span>
        </button>
      </div>
    </article>
  );
}
