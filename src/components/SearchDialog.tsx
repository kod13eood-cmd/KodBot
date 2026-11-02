// Spotlight-style search: one centered window for bots, rooms, and message
// hits. The old inline field lived inside the 320px sidebar and overflowed
// when the window was narrow; a portal keeps it fully on screen.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { useStore, type Bot, type Group } from "@/state/store";
import { CrewAvatar } from "./Avatar";
import { displayRole } from "@/lib/mascot";
import { SearchResults } from "./SearchResults";
import { useI18n } from "@/lib/i18n";

function matches(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle);
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
}: {
  query: string;
  onQuery: (query: string) => void;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
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

  const bots = needle
    ? state.bots
        .filter((bot) => !bot.hidden)
        .filter(
          (bot) =>
            matches(bot.name, needle) ||
            matches(bot.title ?? "", needle) ||
            matches(bot.description ?? "", needle),
        )
        .slice(0, 8)
    : [];
  const rooms = needle
    ? state.groups.filter((group) => matches(group.name, needle)).slice(0, 6)
    : [];
  const hasLocalResults = bots.length > 0 || rooms.length > 0;
  const finish = () => {
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Search bots and messages")}
        className="flex h-[min(720px,78vh)] w-full max-w-[700px] flex-col overflow-hidden rounded-2xl border border-hairline/60 bg-panel shadow-2xl shadow-black/50"
      >
        <div className="flex items-center gap-2.5 border-b border-hairline/40 px-4 py-3">
          <Search size={18} className="shrink-0 text-accent" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={t("Search bots, rooms and messages")}
            aria-label={t("Search bots and messages")}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-secondary focus:outline-none"
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
              {t("Search bots, rooms and messages")}
              <div className="mt-1 text-[11.5px] text-ink-secondary/70">{t("Type at least two characters to search messages")}</div>
            </div>
          ) : (
            <>
              {bots.length > 0 && (
                <section className="mb-2">
                  <div className="px-3 pb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                    {t("Bots")} · {bots.length}
                  </div>
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
                </section>
              )}
              {rooms.length > 0 && (
                <section className="mb-2">
                  <div className="px-3 pb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                    {t("Rooms")} · {rooms.length}
                  </div>
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
                </section>
              )}
              {!hasLocalResults && needle.length < 2 && (
                <div className="px-3 py-8 text-center text-[13px] text-ink-secondary">
                  {t("No bots or rooms match “{query}”", { query: query.trim() })}
                </div>
              )}
              <SearchResults query={query} onLanded={finish} />
            </>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-hairline/40 px-4 py-2 text-[11px] text-ink-secondary">
          <span>{t("Search bots, rooms and message history")}</span>
          <span>Esc</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
