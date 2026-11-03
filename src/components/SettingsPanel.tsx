import { ChevronDown, ChevronLeft, Crown, ExternalLink, FileCode2, FolderOpen, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, useStore, type Bot } from "@/state/store";
import { BotRoleIcon, CrewAvatar } from "./Avatar";
import {
  BOT_ROLES,
  BOT_ROLE_META,
  PICKABLE_STATES,
  displayRole,
  inferRole,
  normalizeRole,
  stateForBot,
  CREW_COLORS,
  CREW_COLOR_NAMES,
} from "@/lib/mascot";
import { ModelPicker } from "./ModelPicker";
import { AutoModelPool } from "./AutoModelPool";
import { TeamsPanel } from "./TeamsPanel";
import { autoMascotShape, MASCOT_SHAPE_IDS, MASCOT_SHAPES, normalizeMascotShape } from "@/lib/mascot-shapes";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { cn } from "@/lib/cn";
import { requestNotificationPermission } from "@/lib/notify";
import { botUsage, costCaption, formatTokens, formatUsd } from "@/lib/usage";
import { shortPath } from "@/lib/short-path";
import { useI18n } from "@/lib/i18n";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[13px] text-ink-secondary">{label}</div>
      {children}
    </label>
  );
}

/** What this bot has spent across its tasks. Cost is captioned by how the
 * engine is billed — on a subscription the figure is an equivalent. */
function BotUsageCard({ bot }: { bot: Bot }) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const usage = botUsage(bot);
  const instance = state.instances.find((i) => i.instanceId === bot.modelSelection.instanceId);
  if (usage.turns === 0) return null;
  return (
    <div className="rounded-xl bg-card p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[15px] font-medium text-ink">{t("Usage")}</div>
        <button
          onClick={() => dispatch({ type: "toggleAppSettings", open: true, section: "usage" })}
          className="text-[12px] text-ink-secondary hover:text-ink"
        >
          {t("All bots →")}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-[13px]">
        <div>
          <div className="text-[11.5px] uppercase tracking-wide text-ink-secondary">{t("Turns")}</div>
          <div className="mt-0.5 tabular-nums text-ink">{usage.turns}</div>
        </div>
        <div>
          <div className="text-[11.5px] uppercase tracking-wide text-ink-secondary">{t("Tokens")}</div>
          <div className="mt-0.5 tabular-nums text-ink" title={`${formatTokens(usage.input)} in · ${formatTokens(usage.output)} out`}>
            {formatTokens(usage.input + usage.output)}
          </div>
        </div>
        <div>
          <div className="text-[11.5px] uppercase tracking-wide text-ink-secondary">{t("Cost")}</div>
          <div className="mt-0.5 tabular-nums text-ink">{formatUsd(usage.costUsd)}</div>
        </div>
      </div>
      <div className="mt-2 text-[12px] text-ink-secondary">
        {typeof usage.costUsd === "number"
          ? t("Cost {caption}.", { caption: costCaption(instance?.snapshot.billing) })
          : t("This engine doesn't report a price; tokens are counted.")}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-secondary focus:outline-none focus:border-hairline";

/** Where a bot's shell tools run. Set per bot; each task pins its own copy
 * on its first turn (the server does the pinning — Claude keeps sessions
 * per project folder, so a folder must not move under a live task). The
 * PATCH is made directly rather than through updateBot: the server
 * validates the path and a rejected folder must not stick in local state. */
function WorkingFolder({ bot }: { bot: Bot }) {
  const { capabilities } = useDesktopCapabilities();
  const { t } = useI18n();
  const home = capabilities.host.homeDir;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canPick = Boolean(window.ogb?.pickFolder) && !capabilities.remoteMode;
  const task = bot.tasks?.find((t) => t.threadId === bot.threadId);
  const pinned = task?.cwd; // undefined = not yet, null = legacy home, string = folder
  const pinnedElsewhere = pinned !== undefined && (pinned ?? undefined) !== bot.cwd;

  const save = async (cwd: string | null) => {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/bots/${bot.id}`, { method: "PATCH", body: JSON.stringify({ cwd }) });
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  const pick = async () => {
    const chosen = await window.ogb?.pickFolder?.(bot.cwd);
    if (chosen) void save(chosen);
  };

  return (
    <div className="rounded-xl bg-card p-4">
      <div className="text-[15px] font-medium text-ink">{t("Working folder")}</div>
      <div className="mt-0.5 text-[13px] text-ink-secondary">{t("Where this bot runs its shell and file tools.")}</div>
      {canPick ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate rounded-lg border border-hairline/40 bg-inset px-3 py-2 font-mono text-[12.5px] text-ink" title={bot.cwd}>
            {bot.cwd ? shortPath(bot.cwd, home) : <span className="text-ink-secondary">{t("Private bot workspace")}</span>}
          </div>
          <button onClick={() => void pick()} disabled={saving} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-raised px-3 py-2 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50">
            <FolderOpen size={14} /> {t("Choose…")}
          </button>
          {bot.cwd && (
            <button onClick={() => void save(null)} disabled={saving} className="shrink-0 rounded-lg px-2 py-2 text-[13px] text-ink-secondary hover:text-ink disabled:opacity-50">
              {t("Clear")}
            </button>
          )}
        </div>
      ) : (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            // an emptied field clears the folder — the server wants null
            void save((draft ?? bot.cwd ?? "").trim() || null);
          }}
        >
          <input
            className={cn(inputCls, "font-mono text-[12.5px]")}
            placeholder={t("Private bot workspace — or an absolute path")}
            value={draft ?? bot.cwd ?? ""}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" disabled={saving || draft === null} className="shrink-0 rounded-lg bg-raised px-3 py-2 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50">
            {t("Save")}
          </button>
        </form>
      )}
      {capabilities.remoteMode && (
        <div className="mt-2 text-[12px] text-ink-secondary">
          {t("This folder is on the remote server.")}
        </div>
      )}
      {error && <div className="mt-2 text-[12px] text-danger">{error}</div>}
      {pinnedElsewhere && (
        <div className="mt-2 text-[12px] text-ink-secondary">
          {t("New tasks start here. This task is pinned to {where} — start a new task to use the new folder.", {
            where: pinned ? shortPath(pinned, home) : t("the home folder"),
          })}
        </div>
      )}
    </div>
  );
}

interface MemoryTopic {
  name: string;
  bytes: number;
}

const formatBytes = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 102.4) / 10} KB`);

/** MEMORY.md + memory/ topic files, surfaced so the user can read and fix
 * what the bot believes. Fetched on expand, not on mount: settings opens for
 * every bot and most visits never look at memory — and an expand also
 * re-reads, so notes the bot wrote mid-session show up on the next open. */
function MemoryCard({ bot }: { bot: Bot }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [topics, setTopics] = useState<MemoryTopic[]>([]);
  const [saving, setSaving] = useState(false);
  const [topic, setTopic] = useState<{ name: string; text: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"append" | "replace" | "topic">("append");
  const [importTopic, setImportTopic] = useState("imported-memory");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  const importPrompt =
    "Please summarize everything you remember about me and my work in durable Markdown. " +
    "Include who I am, my preferences, active projects, important decisions, people and accounts I use, " +
    "and open questions. Do not invent details. Return only the summary.";

  const load = async () => {
    setLoading(true);
    setError(null);
    setTopic(null);
    try {
      const result: { text: string; truncated: boolean; topics: MemoryTopic[] } = await api(
        `/api/bots/${bot.id}/memory`,
      );
      setText(result.text);
      setTruncated(result.truncated);
      setTopics(result.topics);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result: { truncated: boolean } = await api(`/api/bots/${bot.id}/memory`, {
        method: "PUT",
        body: JSON.stringify({ text }),
      });
      setTruncated(result.truncated);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const openTopic = async (name: string) => {
    setError(null);
    try {
      setTopic(await api(`/api/bots/${bot.id}/memory/topics/${encodeURIComponent(name)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const importMemory = async () => {
    if (!importText.trim()) return;
    if (
      importMode === "replace" &&
      !window.confirm(t("Replace the current MEMORY.md with this text? This cannot be undone."))
    ) {
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const result: { text: string; truncated: boolean; topics: MemoryTopic[] } = await api(
        `/api/bots/${bot.id}/memory/import`,
        {
          method: "POST",
          body: JSON.stringify({ text: importText, mode: importMode, topic: importTopic }),
        },
      );
      setText(result.text);
      setTruncated(result.truncated);
      setTopics(result.topics);
      setDirty(false);
      setImportOpen(false);
      setImportText("");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const copyImportPrompt = async () => {
    try {
      await navigator.clipboard.writeText(importPrompt);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      setImportError(t("The browser blocked clipboard access. Select the prompt and copy it manually."));
    }
  };

  return (
    <div className="rounded-xl bg-card p-4">
      <button
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
      >
        <div>
          <div className="text-[15px] font-medium text-ink">{t("Memory")}</div>
          <div className="mt-0.5 text-[13px] text-ink-secondary">
            {t("Notes this bot keeps between tasks — plain files you can edit.")}
          </div>
        </div>
        <ChevronDown size={16} className={cn("shrink-0 text-ink-secondary transition-transform", open && "rotate-180")} />
      </button>

      {open && loading && <div className="mt-3 text-[13px] text-ink-secondary">{t("Loading…")}</div>}

      {open && !loading && topic && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[12.5px] text-ink">memory/{topic.name}</span>
            <button
              onClick={() => setTopic(null)}
              className="shrink-0 rounded-md px-2 py-1 text-[13px] text-ink-secondary hover:bg-raised hover:text-ink"
            >
              {t("Back")}
            </button>
          </div>
          <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap rounded-lg border border-hairline/40 bg-inset p-3 font-mono text-[12.5px] leading-relaxed text-ink">
            {topic.text}
          </pre>
        </div>
      )}

      {open && !loading && !topic && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-ink-secondary">
              {t("Bring context from ChatGPT, Claude, or another assistant.")}
            </span>
            <button
              onClick={() => setImportOpen(true)}
              className="shrink-0 rounded-lg bg-raised px-2.5 py-1.5 text-[12px] text-ink hover:bg-raised-hover"
            >
              {t("Import memory")}
            </button>
          </div>
          <textarea
            className={cn(inputCls, "min-h-[160px] resize-y font-mono text-[12.5px] leading-relaxed")}
            value={text}
            placeholder={t("Nothing remembered yet. The bot writes durable notes here — or add your own.")}
            aria-label={t("Bot memory")}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
            }}
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => void save()}
              disabled={saving || !dirty}
              className="rounded-lg bg-raised px-3 py-1.5 text-[13px] text-ink hover:bg-raised-hover disabled:opacity-50"
            >
              {saving ? t("Saving…") : t("Save")}
            </button>
            {truncated && (
              <span className="text-[11.5px] text-ink-secondary">
                {t("Over the budget — only the top of this file loads each turn.")}
              </span>
            )}
          </div>
          {topics.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                {t("Topic files")}
              </div>
              <div className="overflow-hidden rounded-lg border border-hairline/40">
                {topics.map((entry) => (
                  <button
                    key={entry.name}
                    onClick={() => void openTopic(entry.name)}
                    className="flex w-full items-center justify-between gap-2 border-b border-hairline/40 px-3 py-2 text-left last:border-b-0 hover:bg-raised/60"
                  >
                    <span className="truncate font-mono text-[12.5px] text-ink">{entry.name}</span>
                    <span className="shrink-0 text-[11.5px] text-ink-secondary">{formatBytes(entry.bytes)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="mt-2 text-[12px] text-danger">{error}</div>}

      {importOpen && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => event.target === event.currentTarget && setImportOpen(false)}
        >
          <div className="flex max-h-[min(760px,90vh)] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-hairline/60 bg-panel shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-hairline/40 px-5 py-4">
              <div>
                <div className="text-[16px] font-semibold text-ink">{t("Import memory")}</div>
                <div className="mt-0.5 text-[12px] text-ink-secondary">
                  {t("Copy the prompt into your other assistant, then paste its answer here.")}
                </div>
              </div>
              <button
                onClick={() => setImportOpen(false)}
                aria-label={t("Close")}
                className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"
              >
                <X size={18} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-ink">{t("1. Get the summary")}</span>
                <button
                  onClick={() => void copyImportPrompt()}
                  className="rounded-lg bg-raised px-2.5 py-1.5 text-[11.5px] text-ink hover:bg-raised-hover"
                >
                  {promptCopied ? t("Copied") : t("Copy prompt")}
                </button>
              </div>
              <pre className="max-h-[120px] overflow-auto whitespace-pre-wrap rounded-lg border border-hairline/40 bg-inset p-3 text-[11.5px] leading-relaxed text-ink-secondary">
                {importPrompt}
              </pre>
              <div className="mb-2 mt-4 text-[12px] font-medium text-ink">{t("2. Paste the answer")}</div>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                rows={7}
                placeholder={t("Paste the memory summary here…")}
                className={cn(inputCls, "min-h-[140px] resize-y text-[12.5px] leading-relaxed")}
              />
              <div className="mb-2 mt-4 text-[12px] font-medium text-ink">{t("3. Where should it go?")}</div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["append", t("Append to MEMORY.md")],
                  ["replace", t("Replace MEMORY.md")],
                  ["topic", t("Save as a topic file")],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setImportMode(mode)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[11.5px]",
                      importMode === mode
                        ? "border-accent/70 bg-accent/10 text-ink"
                        : "border-hairline/50 bg-inset text-ink-secondary hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {importMode === "topic" && (
                <input
                  value={importTopic}
                  onChange={(event) => setImportTopic(event.target.value)}
                  className={cn(inputCls, "mt-2 font-mono text-[12.5px]")}
                  placeholder={t("imported-memory")}
                  aria-label={t("Topic file name")}
                />
              )}
              {importError && <div className="mt-3 text-[12px] text-danger">{importError}</div>}
            </div>
            <footer className="flex justify-end gap-2 border-t border-hairline/40 px-5 py-3">
              <button
                onClick={() => setImportOpen(false)}
                className="rounded-lg px-3 py-2 text-[12.5px] text-ink-secondary hover:bg-raised hover:text-ink"
              >
                {t("Cancel")}
              </button>
              <button
                onClick={() => void importMemory()}
                disabled={importing || !importText.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-[12.5px] font-medium text-white hover:brightness-110 disabled:opacity-40"
              >
                {importing ? t("Importing…") : t("Import")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

interface PageSummary {
  name: string;
  title: string;
  bytes: number;
  updatedAt: number;
}

/** Self-contained HTML pages the bot writes into ./pages/. The document is
 * served with a sandbox CSP and framed without same-origin access. */
function PagesCard({ bot }: { bot: Bot }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<PageSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PageSummary | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const pageUrl = (name: string) =>
    `${window.location.origin}/api/bots/${encodeURIComponent(bot.id)}/pages/${encodeURIComponent(name)}`;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result: { pages: PageSummary[] } = await api(`/api/bots/${bot.id}/pages`);
      setPages(result.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const copy = async (page: PageSummary) => {
    try {
      await navigator.clipboard.writeText(pageUrl(page.name));
      setCopied(page.name);
      window.setTimeout(() => setCopied((current) => (current === page.name ? null : current)), 1800);
    } catch {
      setError(t("The browser blocked clipboard access; open the page and copy its URL."));
    }
  };

  const remove = async (page: PageSummary) => {
    if (!window.confirm(t("Delete the page “{name}”?", { name: page.title }))) return;
    setError(null);
    try {
      await api(`/api/bots/${bot.id}/pages/${encodeURIComponent(page.name)}`, { method: "DELETE" });
      if (selected?.name === page.name) setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="rounded-xl bg-card p-4">
      <button
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
      >
        <div>
          <div className="text-[15px] font-medium text-ink">{t("Pages")}</div>
          <div className="mt-0.5 text-[13px] text-ink-secondary">
            {t("Dashboards, checklists, and reports the bot builds as private web pages.")}
          </div>
        </div>
        <ChevronDown size={16} className={cn("shrink-0 text-ink-secondary transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-ink-secondary">
              {t("Pages run in a sandbox and cannot read your chat or credentials.")}
            </span>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
            >
              <RefreshCw size={12} className={cn(loading && "animate-spin")} /> {t("Refresh")}
            </button>
          </div>
          {loading && <div className="mt-2 text-[13px] text-ink-secondary">{t("Loading…")}</div>}
          {!loading && pages?.length === 0 && (
            <div className="mt-2 rounded-lg border border-dashed border-hairline/50 px-3 py-4 text-[12.5px] leading-relaxed text-ink-secondary">
              {t("No pages yet. Ask this bot to build a dashboard, checklist, or report — it will appear here.")}
            </div>
          )}
          {!loading && pages && pages.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-lg border border-hairline/40">
              {pages.map((page) => (
                <div
                  key={page.name}
                  className="flex items-center gap-2 border-b border-hairline/40 px-3 py-2 last:border-b-0"
                >
                  <FileCode2 size={15} className="shrink-0 text-ink-secondary" />
                  <button
                    onClick={() => setSelected(page)}
                    className="min-w-0 flex-1 text-left hover:text-accent"
                    title={t("Open {name}", { name: page.name })}
                  >
                    <span className="block truncate text-[12.5px] font-medium text-ink">{page.title}</span>
                    <span className="block truncate font-mono text-[10.5px] text-ink-secondary/70">
                      {page.name} · {formatBytes(page.bytes)}
                    </span>
                  </button>
                  <button
                    onClick={() => void copy(page)}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] text-ink-secondary hover:bg-raised hover:text-ink"
                  >
                    {copied === page.name ? t("Copied") : t("Copy link")}
                  </button>
                  <button
                    onClick={() => setSelected(page)}
                    aria-label={t("Open {name}", { name: page.title })}
                    className="shrink-0 rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
                  >
                    <ExternalLink size={13} />
                  </button>
                  <button
                    onClick={() => void remove(page)}
                    aria-label={t("Delete {name}", { name: page.title })}
                    className="shrink-0 rounded-md p-1 text-ink-secondary hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 text-[11.5px] text-ink-secondary/80">
            {t("Tip: ask for “a dashboard with our open orders” or “a checklist I can share with the team”.")}
          </div>
        </div>
      )}

      {error && <div className="mt-2 text-[12px] text-danger">{error}</div>}

      {selected && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
        >
          <div className="flex h-[min(860px,90vh)] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-hairline/60 bg-panel shadow-2xl">
            <header className="flex items-center gap-3 border-b border-hairline/40 px-4 py-3">
              <FileCode2 size={16} className="shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-ink">{selected.title}</div>
                <div className="truncate font-mono text-[10.5px] text-ink-secondary">{selected.name}</div>
              </div>
              <button
                onClick={() => void copy(selected)}
                className="rounded-lg px-2.5 py-1.5 text-[12px] text-ink-secondary hover:bg-raised hover:text-ink"
              >
                {copied === selected.name ? t("Copied") : t("Copy link")}
              </button>
              <button
                onClick={() => window.open(pageUrl(selected.name), "_blank", "noopener,noreferrer")}
                className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"
                aria-label={t("Open in a new window")}
                title={t("Open in a new window")}
              >
                <ExternalLink size={15} />
              </button>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"
                aria-label={t("Close page")}
              >
                <X size={17} />
              </button>
            </header>
            <iframe
              src={pageUrl(selected.name)}
              title={selected.title}
              data-kodbot-page
              data-kodbot-bot={bot.id}
              sandbox="allow-scripts allow-downloads"
              referrerPolicy="no-referrer"
              className="min-h-0 flex-1 border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BotTeamCard({ bot }: { bot: Bot }) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const team = state.teams.find((candidate) => candidate.memberIds.includes(bot.id));
  const leader = team ? state.bots.find((candidate) => candidate.id === team.leaderBotId) : undefined;
  const joinable = state.teams.filter((candidate) => !candidate.memberIds.includes(bot.id));

  const join = async (teamId: string) => {
    if (!teamId) return;
    setBusy(true);
    setError(null);
    try {
      const { team: updated } = await api(`/api/teams/${teamId}/members`, {
        method: "POST",
        body: JSON.stringify({ botId: bot.id }),
      });
      dispatch({ type: "teamPatched", team: updated });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!team || team.leaderBotId === bot.id) return;
    setBusy(true);
    setError(null);
    try {
      const { team: updated } = await api(`/api/teams/${team.id}/members/${bot.id}`, { method: "DELETE" });
      dispatch({ type: "teamPatched", team: updated });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-ink">{t("Team")}</div>
          <div className="mt-0.5 text-[13px] text-ink-secondary">
            {team ? `${team.name}${leader ? ` · ${t("Leader")}: ${leader.name}` : ""}` : t("Not in a team")}
          </div>
        </div>
        <button
          onClick={() => setTeamsOpen(true)}
          className="shrink-0 rounded-lg bg-raised px-2.5 py-1.5 text-[11.5px] text-ink hover:bg-raised-hover"
        >
          {t("Manage teams")}
        </button>
      </div>

      {team ? (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-inset px-2.5 py-2">
          <span className="min-w-0 truncate text-[12px] text-ink-secondary">{team.name}</span>
          <button
            onClick={() => void leave()}
            disabled={busy || team.leaderBotId === bot.id}
            title={team.leaderBotId === bot.id ? t("Choose a new leader in Manage teams") : undefined}
            className="shrink-0 rounded-md px-2 py-1 text-[11.5px] text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("Leave team")}
          </button>
        </div>
      ) : joinable.length > 0 ? (
        <select
          value=""
          disabled={busy}
          onChange={(event) => void join(event.target.value)}
          aria-label={t("Join a team")}
          className="mt-2.5 w-full rounded-lg border border-hairline/40 bg-inset px-2.5 py-2 text-[12px] text-ink focus:outline-none"
        >
          <option value="">{t("Join a team…")}</option>
          {joinable.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
          ))}
        </select>
      ) : (
        <div className="mt-2.5 text-[11.5px] text-ink-secondary">
          {t("Create a team from Manage teams.")}
        </div>
      )}

      {error && <div className="mt-2 text-[11.5px] text-danger">{error}</div>}
      {teamsOpen && <TeamsPanel onClose={() => setTeamsOpen(false)} />}
    </div>
  );
}

export function SettingsPanel({ bot }: { bot: Bot }) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [voices, setVoices] = useState<Array<{ id: string; label: string; description?: string }>>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);
  const patch = (
    p: Partial<
      Pick<
        Bot,
        | "name"
        | "title"
        | "description"
        | "notifications"
        | "computer"
        | "color"
        | "mascotExpression"
        | "mascotShape"
        | "role"
        | "autoApprove"
        | "autoModel"
        | "autoModelPool"
        | "speakReplies"
        | "voice"
        | "chiefOfStaff"
        | "approvePeerComms"
        | "composio"
        | "modelSelection"
      >
    >,
  ) => dispatch({ type: "updateBot", botId: bot.id, patch: p });
  const activeState = stateForBot(bot);
  const activeRole = displayRole(bot);
  const activeShape = normalizeMascotShape(bot.mascotShape) ?? autoMascotShape(activeRole, bot.color);
  const explicitRole = normalizeRole(bot.role);
  const suggestedRole = inferRole(bot);
  const mascotMotion = state.mascotMotion?.botId === bot.id ? state.mascotMotion : null;
  const engine = state.instances.find((instance) => instance.instanceId === bot.modelSelection.instanceId);
  const canCoordinate = engine?.capabilities?.agentsMcp === true;
  const canUseConnectedApps = engine?.capabilities?.composioMcp === true;
  const connectedAppsConfigured = state.config?.composio?.configured === true;
  const connectedAppsEnabled = bot.composio !== false;
  const currentChief = state.bots.find((candidate) => candidate.chiefOfStaff);

  useEffect(() => {
    if (!state.config?.tts?.configured) {
      setVoices([]);
      return;
    }
    let alive = true;
    setVoicesLoading(true);
    api("/api/tts/voices")
      .then((result: { voices?: typeof voices }) => alive && setVoices(result.voices ?? []))
      .catch(() => alive && setVoices([]))
      .finally(() => alive && setVoicesLoading(false));
    return () => {
      alive = false;
    };
  }, [state.config?.tts?.configured]);

  return (
    <aside className="animate-panel-in flex h-full w-[400px] shrink-0 flex-col border-l border-hairline/40 bg-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => dispatch({ type: "toggleSettings", open: false })}
          className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-[15px] font-semibold text-ink">{t("Settings")}</span>
        <button
          onClick={() => dispatch({ type: "toggleSettings", open: false })}
          className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div className="flex justify-center py-5">
          <CrewAvatar
            color={bot.color}
            shape={activeShape}
            role={activeRole}
            state={activeState}
            size={112}
            motion={mascotMotion?.kind ?? "none"}
            motionKey={mascotMotion?.nonce ?? 0}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-hairline/40 bg-card">
            <div className="flex items-center justify-between border-b border-hairline/40 px-3 py-2.5">
              <span className="rounded-lg bg-raised px-3 py-1.5 text-[14px] font-medium text-ink">
                {t("Bot")}
              </span>
              <button
                onClick={() => patch({ color: "green", mascotExpression: null, mascotShape: null, role: null })}
                className="rounded-md px-2 py-1.5 text-[13px] text-ink-secondary hover:bg-raised hover:text-ink"
              >
                {t("Reset")}
              </button>
            </div>

            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                  {t("Role")}
                </div>
                <button
                  onClick={() => patch({ role: null })}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] text-ink-secondary hover:bg-raised hover:text-ink",
                    explicitRole === null && "text-ink",
                  )}
                  title={suggestedRole ? t("Suggested: {name}", { name: t(BOT_ROLE_META[suggestedRole].label) }) : t("Choose a role")}
                >
                  <Sparkles size={12} /> {t("Auto")}
                </button>
              </div>
              <div className="mt-1 text-[11.5px] text-ink-secondary/80">
                {explicitRole
                  ? t(BOT_ROLE_META[explicitRole].blurb)
                  : suggestedRole
                    ? t("Suggested from the bot's title: {name}", { name: t(BOT_ROLE_META[suggestedRole].label) })
                    : t("Pick the job this bot presents as. It changes the badge and idle motion.")}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {BOT_ROLES.map((role) => {
                  const meta = BOT_ROLE_META[role];
                  const selected = explicitRole === role;
                  const suggested = explicitRole === null && suggestedRole === role;
                  return (
                    <button
                      key={role}
                      onClick={() => patch({ role })}
                      className={cn(
                        "flex min-h-[58px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
                        selected
                          ? "border-accent/70 bg-accent/10"
                          : suggested
                            ? "border-hairline/70 bg-inset"
                            : "border-hairline/40 bg-inset hover:bg-raised",
                      )}
                      title={t(meta.blurb)}
                    >
                      <BotRoleIcon role={role} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium text-ink">{t(meta.label)}</span>
                        <span className="mt-0.5 block text-[10.5px] leading-snug text-ink-secondary line-clamp-2">
                          {t(meta.blurb)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mb-2 mt-4 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                {t("Expression")}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PICKABLE_STATES.map((expression) => (
                  <button
                    key={expression}
                    onClick={() => patch({ mascotExpression: expression })}
                    className={cn(
                      "flex h-[58px] items-center justify-center rounded-xl bg-inset transition-colors hover:bg-raised",
                      activeState === expression && "ring-2 ring-accent-border",
                    )}
                    title={expression}
                    aria-label={t("Use {name} expression", { name: expression })}
                  >
                    <CrewAvatar
                      color={bot.color}
                      shape={activeShape}
                      role={activeRole}
                      state={expression}
                      size={42}
                      animated={false}
                    />
                  </button>
                ))}
              </div>

              <div className="mb-2 mt-4 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                {t("Color")}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {CREW_COLOR_NAMES.map((color) => (
                  <button
                    key={color}
                    onClick={() => patch({ color })}
                    className={cn(
                      "size-8 rounded-full border-2 border-transparent transition-transform hover:scale-110",
                      bot.color === color && "ring-2 ring-accent-border ring-offset-2 ring-offset-card",
                    )}
                    style={{ backgroundColor: CREW_COLORS[color] }}
                    title={color}
                    aria-label={t("Use {name} mascot color", { name: color })}
                  />
                ))}
              </div>

              <div className="mb-2 mt-4 flex items-center justify-between">
                <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                  {t("Shape")}
                </div>
                <button
                  onClick={() => patch({ mascotShape: null })}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] text-ink-secondary hover:bg-raised hover:text-ink",
                    !normalizeMascotShape(bot.mascotShape) && "text-ink",
                  )}
                  title={t("Use the shape suggested by this bot's role")}
                >
                  <Sparkles size={12} /> {t("Auto")}
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {MASCOT_SHAPE_IDS.map((shape) => (
                  <button
                    key={shape}
                    onClick={() => patch({ mascotShape: shape })}
                    className={cn(
                      "flex h-[58px] items-center justify-center rounded-xl bg-inset transition-colors hover:bg-raised",
                      activeShape === shape && "ring-2 ring-accent-border",
                    )}
                    title={t(MASCOT_SHAPES[shape].label)}
                    aria-label={t("Use {name} body shape", { name: t(MASCOT_SHAPES[shape].label) })}
                  >
                    <CrewAvatar
                      color={bot.color}
                      shape={shape}
                      role={activeRole}
                      state="idle"
                      size={42}
                      animated={false}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Field label={t("Name")}>
            <input
              className={inputCls}
              value={bot.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <BotTeamCard bot={bot} />
          <Field label={t("Title")}>
            <input
              className={inputCls}
              placeholder={t("Describe what your agent does")}
              value={bot.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </Field>
          <Field label={t("Description")}>
            <textarea
              className={cn(inputCls, "min-h-[96px] resize-none")}
              placeholder={t("What this agent is for")}
              value={bot.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>

          <div className={cn(
            "rounded-xl border p-4",
            bot.chiefOfStaff ? "border-accent/40 bg-accent/10" : "border-hairline/40 bg-card",
          )}>
            <div className="flex items-center gap-3">
              <span className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                bot.chiefOfStaff ? "bg-accent text-white" : "bg-raised text-ink-secondary",
              )}>
                <Crown size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-ink">{t("Chief of Staff")}</div>
                <div className="text-[11.5px] text-ink-secondary">{t("One per workspace")}</div>
              </div>
              <button
                role="switch"
                aria-checked={Boolean(bot.chiefOfStaff)}
                aria-label={t("Chief of Staff")}
                disabled={!bot.chiefOfStaff && !canCoordinate}
                onClick={() => patch({ chiefOfStaff: !bot.chiefOfStaff })}
                title={!bot.chiefOfStaff && !canCoordinate ? t("This engine cannot contact other bots") : undefined}
                className={cn(
                  "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  bot.chiefOfStaff ? "bg-accent" : "bg-raised",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                    bot.chiefOfStaff ? "left-[21px]" : "left-[3px]",
                  )}
                />
              </button>
            </div>
            <div className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
              {bot.chiefOfStaff && !canCoordinate
                ? t("This bot still holds the role, but its current engine cannot contact teammates. Choose a Claude or ACP engine to restore coordination.")
                : bot.chiefOfStaff
                  ? t("This is your primary contact. It can coordinate the other bots and combine their work into one answer.")
                : !canCoordinate
                  ? t("Choose a Claude or ACP engine to let this bot coordinate teammates.")
                  : currentChief
                    ? t("Make this bot your primary contact and hand the role over from {name}.", { name: currentChief.name })
                    : t("Make this bot your primary contact for work that may involve several bots.")}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">
                {t("Ask me before contacting other bots")}
              </div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                {bot.approvePeerComms
                  ? t("This bot will stop and ask before it reaches out to another bot.")
                  : t("Let this bot talk to teammates on its own, without a confirmation step.")}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={Boolean(bot.approvePeerComms)}
              aria-label={t("Ask me before contacting other bots")}
              disabled={!bot.approvePeerComms && !canCoordinate}
              onClick={() => patch({ approvePeerComms: !bot.approvePeerComms })}
              title={!bot.approvePeerComms && !canCoordinate ? t("This engine cannot contact other bots") : undefined}
              className={cn(
                "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                bot.approvePeerComms ? "bg-accent" : "bg-raised",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                  bot.approvePeerComms ? "left-[21px]" : "left-[3px]",
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">{t("Connected apps")}</div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                {!connectedAppsConfigured
                  ? t("Connect apps in App Settings before giving this bot access.")
                  : !canUseConnectedApps
                    ? t("This bot's current engine cannot use connected apps.")
                    : connectedAppsEnabled
                      ? t("Let this bot use your connected Gmail, Calendar, Slack, and other apps.")
                      : t("Keep your connected apps unavailable to this bot.")}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={connectedAppsEnabled}
              aria-label={t("Allow this bot to use connected apps")}
              disabled={
                !connectedAppsEnabled && (!connectedAppsConfigured || !canUseConnectedApps)
              }
              onClick={() => patch({ composio: !connectedAppsEnabled })}
              title={
                !connectedAppsEnabled && !connectedAppsConfigured
                  ? t("Connect apps in App Settings first")
                  : !connectedAppsEnabled && !canUseConnectedApps
                    ? t("This engine cannot use connected apps")
                    : undefined
              }
              className={cn(
                "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                connectedAppsEnabled ? "bg-accent" : "bg-raised",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                  connectedAppsEnabled ? "left-[21px]" : "left-[3px]",
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">{t("Model")}</div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                {t("Which provider and model this bot runs on")}
              </div>
            </div>
            <ModelPicker bot={bot} />
          </div>

          <div className="rounded-xl bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[15px] font-medium text-ink">{t("Auto model")}</div>
                <div className="mt-0.5 text-[13px] text-ink-secondary">
                  {t(
                    "Pick the best available model for each task. Complex work gets the strongest engine; short requests get the fastest one.",
                  )}
                </div>
                {bot.autoModel && (
                  <div className="mt-1 text-[11.5px] text-ink-secondary/80">
                    {t("The picker shows the last routed model; the next task is routed again.")}
                  </div>
                )}
              </div>
              <button
                role="switch"
                aria-checked={Boolean(bot.autoModel)}
                aria-label={t("Auto model")}
                onClick={() => patch({ autoModel: !bot.autoModel })}
                className={cn(
                  "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors",
                  bot.autoModel ? "bg-accent" : "bg-raised",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                    bot.autoModel ? "left-[21px]" : "left-[3px]",
                  )}
                />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-inset px-3 py-2">
              <div className="min-w-0 text-[11.5px] leading-snug text-ink-secondary">
                {bot.autoModelPool?.length
                  ? t("{count} models in the auto pool", { count: bot.autoModelPool.length })
                  : t("Using all models from the current engine.")}
              </div>
              <button
                onClick={() => setPoolOpen(true)}
                className="shrink-0 rounded-lg bg-raised px-2.5 py-1.5 text-[11.5px] text-ink hover:bg-raised-hover"
              >
                {t("Choose models")}
              </button>
            </div>
          </div>

          {!!engine?.capabilities?.effortLevels?.length && (
            <div className="rounded-xl bg-card p-4">
              <div className="text-[15px] font-medium text-ink">{t("Effort")}</div>
              {/* Says what the app does, not what the engine ends up at:
                  Codex applies a level to the whole thread and has no way to
                  take one back, so "currently: engine default" was a promise
                  we could not keep for a thread that had already been sent
                  one. Sending nothing is true on every engine. */}
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                {t("How hard this bot thinks")}
                {bot.modelSelection.effort ? "" : ` ${t("(Default: no level is sent)")}`}
              </div>
              <div className="mt-3 flex overflow-hidden rounded-lg border border-hairline/40">
                {([undefined, ...engine.capabilities.effortLevels] as const).map((level, i) => (
                  <button
                    key={level ?? "default"}
                    aria-pressed={bot.modelSelection.effort === level}
                    onClick={() => patch({ modelSelection: { ...bot.modelSelection, effort: level } })}
                    className={cn(
                      "flex-1 py-1.5 text-[13px] capitalize",
                      i > 0 && "border-l border-hairline/40",
                      bot.modelSelection.effort === level
                        ? "bg-raised text-ink"
                        : "text-ink-secondary hover:bg-raised/60 hover:text-ink",
                    )}
                  >
                    {/* the others capitalize cleanly; "xhigh" would read "Xhigh" */}
                    {level === "xhigh" ? t("X-High") : level ? t(level) : t("Default")}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-card p-4">
            <div className="text-[15px] font-medium text-ink">{t("Computer")}</div>
            <div className="mt-0.5 text-[13px] text-ink-secondary">
              {t("Where this bot's computer runs")}
              {bot.computer ? "" : ` (${t("currently: auto")})`}
            </div>
            <div className="mt-3 flex overflow-hidden rounded-lg border border-hairline/40">
              {(["cloud", "local", "off"] as const).map((mode, i) => (
                <button
                  key={mode}
                  onClick={() => patch({ computer: mode })}
                  className={cn(
                    "flex-1 py-1.5 text-[13px] capitalize",
                    i > 0 && "border-l border-hairline/40",
                    bot.computer === mode
                      ? "bg-raised text-ink"
                      : "text-ink-secondary hover:bg-raised/60 hover:text-ink",
                  )}
                >
                  {t(mode)}
                </button>
              ))}
            </div>
          </div>

          <BotUsageCard bot={bot} />
          <WorkingFolder bot={bot} />

          {/* keyed so switching bots never shows one bot's notes under another's name */}
          <MemoryCard key={bot.id} bot={bot} />
          <PagesCard key={`pages:${bot.id}`} bot={bot} />

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">{t("Auto mode")}</div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                {bot.autoApprove
                  ? t("Keeps going on its own — you'll still be asked about anything destructive, and about questions it asks you.")
                  : t("Approve each action yourself. Turn on to let this bot keep working without stopping to ask.")}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={Boolean(bot.autoApprove)}
              aria-label={t("Auto mode")}
              onClick={() => patch({ autoApprove: !bot.autoApprove })}
              className={cn(
                "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors",
                bot.autoApprove ? "bg-accent" : "bg-raised",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                  bot.autoApprove ? "left-[21px]" : "left-[3px]",
                )}
              />
            </button>
          </div>

          {state.config?.tts?.configured && (
            <div className="rounded-xl bg-card p-4">
              <div className="text-[15px] font-medium text-ink">{t("Bot voice")}</div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                {t("Use a distinct voice for calls and spoken replies, or inherit the app default")}
              </div>
              <select
                value={bot.voice ?? ""}
                onChange={(e) => patch({ voice: e.target.value })}
                aria-label={t("{name}'s voice", { name: bot.name })}
                className="mt-3 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink focus:border-hairline focus:outline-none"
              >
                <option value="">{t("App default")}</option>
                {bot.voice && !voices.some((voice) => voice.id === bot.voice) && (
                  <option value={bot.voice}>{t("Current bot voice")}</option>
                )}
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}{voice.description ? ` — ${voice.description}` : ""}
                  </option>
                ))}
              </select>
              {voicesLoading && <div className="mt-1.5 text-[11.5px] text-ink-secondary">{t("Loading voices…")}</div>}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">{t("Read replies aloud")}</div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                {t("Speak this bot's answers as they arrive, even when you're in another chat")}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={Boolean(bot.speakReplies)}
              aria-label={t("Read this bot's replies aloud")}
              onClick={() => patch({ speakReplies: !bot.speakReplies })}
              className={cn(
                "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors",
                bot.speakReplies ? "bg-accent" : "bg-raised",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                  bot.speakReplies ? "left-[21px]" : "left-[3px]",
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4">
            <div>
              <div className="text-[15px] font-medium text-ink">
                {t("Notifications")}
              </div>
              <div className="mt-0.5 text-[13px] text-ink-secondary">
                {t("Get notified when this agent finishes or needs input")}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={bot.notifications}
              onClick={() => {
                const enabled = !bot.notifications;
                if (enabled) void requestNotificationPermission();
                patch({ notifications: enabled });
              }}
              className={cn(
                "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors",
                bot.notifications ? "bg-accent" : "bg-raised",
              )}
            >
              <span
                className={cn(
                  "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                  bot.notifications ? "left-[21px]" : "left-[3px]",
                )}
              />
            </button>
          </div>
        </div>
      </div>
      {poolOpen && <AutoModelPool bot={bot} onClose={() => setPoolOpen(false)} />}
    </aside>
  );
}
