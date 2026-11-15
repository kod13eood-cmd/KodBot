// A bot's tasks: separate contexts on the same bot.
//
// One endless thread per bot means every job contaminates the next, and
// the only clean slate is a second bot. A task is a real boundary — its
// own transcript and its own provider session — so sensitive work, a
// long job and a quick question can sit side by side under one agent.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, CalendarClock, Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore, formatTime, type Bot, type Task } from "@/state/store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { formatTokens } from "@/lib/format-tokens";

/** Quiet per-task token tally — input+output combined, because one honest
 * total reads faster than a split; the split lives in the hover title. */
function TaskUsage({ usage }: { usage: Task["usage"] }) {
  const { t } = useI18n();
  if (!usage) return null;
  const label = formatTokens(usage.input + usage.output);
  if (!label) return null;
  return (
    <span
      title={t("{input} in · {output} out", {
        input: usage.input.toLocaleString(),
        output: usage.output.toLocaleString(),
      })}
    >
      {" · "}
      {label}
    </span>
  );
}

export function TaskPicker({ bot }: { bot: Bot }) {
  const { t } = useI18n();
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  /** right-click menu: the three task actions, anchored at the pointer */
  const [menu, setMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const allTasks = bot.tasks ?? [];
  const tasks = allTasks.filter((task) => !task.archivedAt);
  const archived = allTasks.filter((task) => task.archivedAt);
  const current = tasks.find((t) => t.threadId === bot.threadId);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // SAFETY: a mousedown target inside a document is always a DOM Node
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  // a bot that has only ever done one thing doesn't need a switcher yet —
  // just the button that gives it a second context
  if (tasks.length <= 1 && archived.length === 0) {
    return (
      <button
        onClick={() => dispatch({ type: "newTask", botId: bot.id })}
        disabled={bot.busy}
        title={bot.busy ? t("Let this turn finish first") : t("New task — a fresh context on this bot")}
        className="flex items-center gap-1 rounded-full border border-hairline/40 px-2.5 py-1 text-[12.5px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
      >
        <Plus size={12} /> {t("Task")}
      </button>
    );
  }

  const commitRename = (threadId: string) => {
    const title = draft.trim();
    setRenaming(null);
    if (title) dispatch({ type: "renameTask", botId: bot.id, threadId, title });
  };

  // the picker button stays as-is — a token count next to a truncated title
  // and count would crowd it; the open task's tally rides the hover title
  const u = current?.usage;
  const currentLabel = u ? formatTokens(u.input + u.output) : null;
  const switchTitle =
    u && currentLabel
      ? t("Switch task · {usage} ({input} in · {output} out)", {
          usage: currentLabel,
          input: u.input.toLocaleString(),
          output: u.output.toLocaleString(),
        })
      : t("Switch task");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={switchTitle}
        className="flex max-w-[220px] items-center gap-1.5 rounded-full border border-hairline/40 px-2.5 py-1 text-[12.5px] text-ink-secondary hover:bg-raised hover:text-ink"
      >
        <span className="truncate">{current?.title ?? t("Task")}</span>
        <span className="shrink-0 tabular-nums opacity-60">{tasks.length}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-[300px] overflow-hidden rounded-xl border border-hairline/50 bg-card py-1 shadow-2xl shadow-black/50">
          <div className="max-h-[320px] overflow-y-auto">
            {tasks.map((task) => {
              const active = task.threadId === bot.threadId;
              const scheduled = state.routineRuns.some((run) => run.threadId === task.threadId);
              return (
                <div
                  key={task.threadId}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ task, x: event.clientX, y: event.clientY });
                  }}
                  className={cn("group flex items-center gap-2 px-2.5 py-2", active ? "bg-raised/60" : "hover:bg-raised/40")}
                >
                  <Check size={13} className={cn("shrink-0", active ? "text-accent" : "opacity-0")} />
                  {renaming === task.threadId ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitRename(task.threadId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(task.threadId);
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      className="min-w-0 flex-1 rounded bg-inset px-1.5 py-0.5 text-[13px] text-ink focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        if (!active) dispatch({ type: "switchTask", botId: bot.id, threadId: task.threadId });
                        setOpen(false);
                      }}
                      onDoubleClick={() => {
                        setDraft(task.title);
                        setRenaming(task.threadId);
                      }}
                      className="min-w-0 flex-1 text-left"
                      title={t("Click to switch · double-click to rename")}
                    >
                      <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink">
                        {scheduled && <CalendarClock size={11} className="shrink-0 text-accent" aria-label={t("Scheduled")} />}
                        <span className="truncate">{task.title}</span>
                        {task.unread && (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-accent"
                            aria-label={t("Unread")}
                          />
                        )}
                      </div>
                      <div className="text-[11px] text-ink-secondary">
                        {scheduled && <span className="text-accent">{t("Scheduled")} · </span>}
                        {formatTime(task.createdAt)}
                        <TaskUsage usage={task.usage} />
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {archived.length > 0 && (
            <div className="mt-1 border-t border-hairline/40 pt-1">
              <button
                onClick={() => setShowArchived((value) => !value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-ink-secondary hover:bg-raised/50"
              >
                <Archive size={12} /> {showArchived ? t("Hide archived") : t("Archived tasks")}
                <span className="ml-auto tabular-nums opacity-60">{archived.length}</span>
              </button>
              {showArchived && archived.map((task) => (
                <div
                  key={task.threadId}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ task, x: event.clientX, y: event.clientY });
                  }}
                  className="group flex items-center gap-2 px-2.5 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] text-ink-secondary">{task.title}</div>
                    <div className="text-[11px] text-ink-secondary/70">{formatTime(task.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-hairline/30 px-3 pb-1 pt-2 text-[10.5px] text-ink-secondary/70">
            {t("Right-click a task to rename, archive, or delete it.")}
          </div>
          <button
            onClick={() => {
              dispatch({ type: "newTask", botId: bot.id });
              setOpen(false);
            }}
            disabled={bot.busy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-raised/50 disabled:opacity-40"
          >
            <Plus size={13} className="text-ink-secondary" /> {t("New task")}
          </button>
        </div>
      )}
      {menu &&
        createPortal(
          <div
            role="menu"
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              left: Math.min(menu.x, window.innerWidth - 190),
              top: Math.min(menu.y, window.innerHeight - 132),
            }}
            className="fixed z-[90] w-[180px] overflow-hidden rounded-lg border border-hairline/60 bg-card py-1 shadow-2xl shadow-black/60"
          >
            <button
              role="menuitem"
              onClick={() => {
                setDraft(menu.task.title);
                setRenaming(menu.task.threadId);
                setOpen(true);
                setMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-raised"
            >
              <Pencil size={13} className="text-ink-secondary" /> {t("Rename")}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                dispatch(
                  menu.task.archivedAt
                    ? { type: "unarchiveTask", botId: bot.id, threadId: menu.task.threadId }
                    : { type: "archiveTask", botId: bot.id, threadId: menu.task.threadId },
                );
                setMenu(null);
              }}
              disabled={!menu.task.archivedAt && tasks.length <= 1}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-raised disabled:opacity-40"
            >
              <Archive size={13} className="text-ink-secondary" />
              {menu.task.archivedAt ? t("Restore") : t("Archive")}
            </button>
            <button
              role="menuitem"
              onClick={() => {
                dispatch({ type: "deleteTask", botId: bot.id, threadId: menu.task.threadId });
                setMenu(null);
              }}
              disabled={bot.busy && menu.task.threadId === bot.threadId}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-danger hover:bg-danger/10 disabled:opacity-40"
            >
              <Trash2 size={13} /> {t("Delete")}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
