// Spotlight-style global search: bots, rooms, teams, automations, connected
// apps, settings, and message history in one centered window. The old inline
// field lived inside the 320px sidebar and overflowed when the window was
// narrow; a portal keeps it fully on screen.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Puzzle, Search, Settings, Users, Webhook, X } from "lucide-react";
import { api, useStore, type AppSettingsSection, type Bot, type Group } from "@/state/store";
import { CrewAvatar } from "./Avatar";
import { displayRole } from "@/lib/mascot";
import { SearchResults } from "./SearchResults";
import { openShortcutsSheet } from "./ShortcutsSheet";
import { useI18n } from "@/lib/i18n";

interface AppCard {
  slug: string;
  label: string;
  blurb?: string;
  description?: string;
}

interface SettingsResult {
  id: AppSettingsSection;
  label: string;
  keywords: string;
}

const SETTINGS_RESULTS: SettingsResult[] = [
  { id: "general", label: "General", keywords: "profile name email language updates server" },
  { id: "connections", label: "Connections", keywords: "api keys credentials composio box opencode go" },
  { id: "engines", label: "Engines", keywords: "providers cli models sign in install" },
  { id: "companion", label: "Companion", keywords: "phone pairing devices android iphone" },
  { id: "computer", label: "Local VM", keywords: "computer docker container desktop" },
  { id: "voice", label: "Voice", keywords: "tts elevenlabs speech call" },
  { id: "usage", label: "Usage", keywords: "tokens cost spending billing" },
];

let appCatalog: AppCard[] | null = null;
let appCatalogPromise: Promise<AppCard[]> | null = null;

function loadAppCatalog(): Promise<AppCard[]> {
  if (appCatalog) return Promise.resolve(appCatalog);
  if (!appCatalogPromise) {
    appCatalogPromise = api("/api/connectors/catalog")
      .then((result: { cards?: AppCard[] }) => {
        appCatalog = result.cards ?? [];
        return appCatalog;
      })
      .catch(() => {
        appCatalogPromise = null;
        return [];
      });
  }
  return appCatalogPromise;
}

function matches(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle);
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="mb-2">
      <div className="px-3 pb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
        {title} · {count}
      </div>
      {children}
    </section>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  onPick,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-raised/60"
    >
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-raised text-ink-secondary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{title}</span>
        {subtitle && <span className="block truncate text-[12px] text-ink-secondary">{subtitle}</span>}
      </span>
    </button>
  );
}

function BotResult({ bot, onPick }: { bot: Bot; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-raised/60"
    >
      <CrewAvatar
        color={bot.color}
        shape={bot.mascotShape}
        role={displayRole(bot)}
        state="idle"
        size={30}
        animated={false}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{bot.name}</span>
        <span className="block truncate text-[12px] text-ink-secondary">
          {bot.title || bot.description || bot.modelSelection.model}
        </span>
      </span>
    </button>
  );
}

function RoomResult({ group, onPick }: { group: Group; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-raised/60"
    >
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-raised text-[12px] font-medium text-ink-secondary">
        #
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{group.name}</span>
        <span className="block truncate text-[12px] text-ink-secondary">
          {group.memberIds.length} bots
        </span>
      </span>
    </button>
  );
}

export function SearchDialog({
  query,
  onQuery,
  onClose,
  onOpenTeams,
}: {
  query: string;
  onQuery: (query: string) => void;
  onClose: () => void;
  onOpenTeams: () => void;
}) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [apps, setApps] = useState<AppCard[]>(() => appCatalog ?? []);
  const needle = query.trim().toLowerCase();

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    void loadAppCatalog().then((cards) => {
      if (alive) setApps(cards);
    });
    return () => {
      alive = false;
    };
  }, []);

  const words = needle.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  // A search for a category name should reveal the category, not only items
  // whose own name happens to contain it. "Teams" must list teams even when
  // none is literally called "Teams".
  const isCategory = (aliases: string[]) =>
    aliases.some(
      (alias) =>
        words.includes(alias) ||
        needle === alias ||
        (needle.length >= 3 && alias.startsWith(needle)),
    );
  const allBots = isCategory(["bot", "bots", "бот", "ботове"]);
  const allRooms = isCategory(["room", "rooms", "стая", "стаи"]);
  const allTeams = isCategory(["team", "teams", "екип", "екипи"]);
  const allAutomations = isCategory([
    "automation",
    "automations",
    "routine",
    "routines",
    "schedule",
    "schedules",
    "webhook",
    "webhooks",
    "автоматизация",
    "автоматизации",
    "график",
    "уебхук",
  ]);
  const allSettings = isCategory(["setting", "settings", "preference", "preferences", "config", "configuration", "настройки"]);
  const appsCategory = isCategory([
    "app",
    "apps",
    "integration",
    "integrations",
    "connected",
    "composio",
    "свързани",
  ]);

  const bots = needle
    ? state.bots
        .filter((bot) => !bot.hidden)
        .filter(
          (bot) =>
            allBots ||
            matches(bot.name, needle) ||
            matches(bot.title ?? "", needle) ||
            matches(bot.description ?? "", needle),
        )
        .slice(0, 8)
    : [];
  const rooms = needle
    ? state.groups
        .filter((group) => allRooms || matches(group.name, needle))
        .slice(0, 6)
    : [];
  const teams = needle
    ? state.teams
        .filter((team) => {
          if (allTeams || matches(team.name, needle)) return true;
          const leader = state.bots.find((bot) => bot.id === team.leaderBotId);
          if (leader && matches(leader.name, needle)) return true;
          return team.memberIds.some((id) => {
            const member = state.bots.find((bot) => bot.id === id);
            return member ? matches(member.name, needle) : false;
          });
        })
        .slice(0, 6)
    : [];
  const routines = needle
    ? state.routines
        .filter((routine) => {
          const bot = state.bots.find((candidate) => candidate.id === routine.botId);
          return (
            allAutomations ||
            matches(routine.name, needle) ||
            matches(routine.prompt, needle) ||
            (bot ? matches(bot.name, needle) : false)
          );
        })
        .slice(0, 6)
    : [];
  const webhooks = needle
    ? state.webhooks
        .filter((webhook) => {
          const bot = state.bots.find((candidate) => candidate.id === webhook.botId);
          return (
            allAutomations ||
            matches(webhook.name, needle) ||
            matches(webhook.prompt, needle) ||
            (bot ? matches(bot.name, needle) : false)
          );
        })
        .slice(0, 6)
    : [];
  const appResults =
    needle && !appsCategory && !(allBots || allRooms || allTeams || allAutomations || allSettings)
      ? apps
          .filter(
            (app) =>
              matches(app.label, needle) ||
              matches(app.slug, needle) ||
              matches(app.blurb ?? "", needle) ||
              matches(app.description ?? "", needle),
          )
          .slice(0, 6)
      : [];
  const settingsResults = needle
    ? SETTINGS_RESULTS.filter(
        (entry) =>
          allSettings || matches(t(entry.label), needle) || matches(entry.keywords, needle),
      )
    : [];
  const shortcutsResult =
    needle.length > 0 &&
    (allSettings ||
      matches(t("Keyboard shortcuts"), needle) ||
      matches("keyboard shortcuts hotkeys keys chords", needle));
  const appsNav = appsCategory;
  const localCount =
    bots.length +
    rooms.length +
    teams.length +
    routines.length +
    webhooks.length +
    appResults.length +
    (appsNav ? 1 : 0) +
    settingsResults.length +
    (shortcutsResult ? 1 : 0);
  const finish = () => onClose();

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Search everything")}
        className="flex h-[min(720px,78vh)] w-full max-w-[700px] flex-col overflow-hidden rounded-2xl border border-hairline/60 bg-panel shadow-2xl shadow-black/50"
      >
        <div className="flex items-center gap-2 border-b border-hairline/40 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-hairline/40 bg-inset px-3 py-2 transition-colors focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
            <Search size={17} className="shrink-0 text-accent" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder={t("Search everything")}
              aria-label={t("Search everything")}
              className="field-input min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-secondary focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQuery("")}
                aria-label={t("Clear search")}
                className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close search")}
            className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {!needle ? (
            <div className="px-3 py-10 text-center text-[13px] text-ink-secondary">
              {t("Search everything")}
              <div className="mt-1 text-[11.5px] text-ink-secondary/70">
                {t("Bots, rooms, teams, automations, connected apps, settings and messages")}
              </div>
            </div>
          ) : (
            <>
              <Section title={t("Bots")} count={bots.length}>
                {bots.map((bot) => (
                  <BotResult
                    key={bot.id}
                    bot={bot}
                    onPick={() => {
                      dispatch({ type: "select", id: bot.id });
                      finish();
                    }}
                  />
                ))}
              </Section>

              <Section title={t("Rooms")} count={rooms.length}>
                {rooms.map((group) => (
                  <RoomResult
                    key={group.id}
                    group={group}
                    onPick={() => {
                      dispatch({ type: "select", id: group.id });
                      finish();
                    }}
                  />
                ))}
              </Section>

              <Section title={t("Teams")} count={teams.length}>
                {teams.map((team) => {
                  const leader = state.bots.find((bot) => bot.id === team.leaderBotId);
                  return (
                    <ResultRow
                      key={team.id}
                      icon={<Users size={15} />}
                      title={team.name}
                      subtitle={`${t("Lead: {name}", { name: leader?.name ?? t("No leader") })} · ${team.memberIds.length} ${t("bots")}`}
                      onPick={() => {
                        onOpenTeams();
                        finish();
                      }}
                    />
                  );
                })}
              </Section>

              <Section title={t("Automations")} count={routines.length + webhooks.length}>
                {routines.map((routine) => {
                  const bot = state.bots.find((candidate) => candidate.id === routine.botId);
                  return (
                    <ResultRow
                      key={routine.id}
                      icon={<CalendarClock size={15} />}
                      title={routine.name}
                      subtitle={`${t("Schedule")} · ${bot?.name ?? routine.botId}${routine.enabled ? "" : ` · ${t("Disabled")}`}`}
                      onPick={() => {
                        dispatch({ type: "showRoutines" });
                        finish();
                      }}
                    />
                  );
                })}
                {webhooks.map((webhook) => {
                  const bot = state.bots.find((candidate) => candidate.id === webhook.botId);
                  return (
                    <ResultRow
                      key={webhook.id}
                      icon={<Webhook size={15} />}
                      title={webhook.name}
                      subtitle={`${t("Webhook")} · ${bot?.name ?? webhook.botId}${webhook.enabled ? "" : ` · ${t("Disabled")}`}`}
                      onPick={() => {
                        dispatch({ type: "showRoutines" });
                        finish();
                      }}
                    />
                  );
                })}
              </Section>

              <Section title={t("Connected apps")} count={appResults.length + (appsNav ? 1 : 0)}>
                {appsNav && (
                  <ResultRow
                    icon={<Puzzle size={15} />}
                    title={t("Connected apps")}
                    subtitle={t("Marketplace and accounts")}
                    onPick={() => {
                      dispatch({ type: "togglePlugins", open: true });
                      finish();
                    }}
                  />
                )}
                {appResults.map((app) => (
                  <ResultRow
                    key={app.slug}
                    icon={<Puzzle size={15} />}
                    title={app.label}
                    subtitle={app.blurb}
                    onPick={() => {
                      dispatch({ type: "togglePlugins", open: true, query: app.label });
                      finish();
                    }}
                  />
                ))}
              </Section>

              <Section title={t("Settings")} count={settingsResults.length + (shortcutsResult ? 1 : 0)}>
                {settingsResults.map((entry) => (
                  <ResultRow
                    key={entry.id}
                    icon={<Settings size={15} />}
                    title={t(entry.label)}
                    subtitle={t("App settings")}
                    onPick={() => {
                      dispatch({ type: "toggleAppSettings", open: true, section: entry.id });
                      finish();
                    }}
                  />
                ))}
                {shortcutsResult && (
                  <ResultRow
                    icon={<Settings size={15} />}
                    title={t("Keyboard shortcuts")}
                    subtitle={t("App settings")}
                    onPick={() => {
                      openShortcutsSheet();
                      finish();
                    }}
                  />
                )}
              </Section>

              {localCount === 0 && needle.length < 2 && (
                <div className="px-3 py-8 text-center text-[13px] text-ink-secondary">
                  {t("Nothing matches “{query}”", { query: query.trim() })}
                </div>
              )}
              <SearchResults query={query} onLanded={finish} />
            </>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-hairline/40 px-4 py-2 text-[11px] text-ink-secondary">
          <span>{t("Search everything")}</span>
          <span>Esc</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
