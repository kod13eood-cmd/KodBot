import { track } from "@/lib/analytics";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  ArrowDownToLine,
  BellDot,
  Bot as BotIcon,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Crown,
  FolderPlus,
  Library,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Puzzle,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  api,
  useStore,
  formatTime,
  visibleMessages,
  type Action,
  type AppState,
  type Bot,
  type Group,
  type Message,
} from "@/state/store";

import { CrewAvatar, InitialsAvatar } from "./Avatar";
import { displayRole, stateForBot } from "@/lib/mascot";
import { useUpdaterState } from "@/lib/updater";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/cn";
import { downloadAllBots } from "@/lib/team-files";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { SearchDialog } from "./SearchDialog";
import { TeamLibraryPanel, type TeamImportResult } from "./TeamLibraryPanel";
import { TeamsPanel } from "./TeamsPanel";
import { RenameTitle } from "./RenameTitle";
import { useI18n } from "@/lib/i18n";
import { useShowGroupChats } from "@/lib/show-groups";

/** "Milind Soni" → "MS", "milind" → "M", "you@x.dev" → "Y", unset → "?" */
function profileInitials(profile?: { name?: string; email?: string }): string {
  const name = profile?.name?.trim();
  if (name) {
    const words = name.split(/\s+/);
    return words
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("");
  }
  const email = profile?.email?.trim();
  return email ? email[0]!.toUpperCase() : "?";
}

/** Manual update check, next to the settings gear. Packaged app only (no
 * bridge in dev/browser). One button, state-dependent: check → download →
 * restart, with a brief "up to date" tick when a check finds nothing so a
 * click is never silent. The bottom-left popup handles the loud cases. */
function UpdateButton() {
  const s = useUpdaterState();
  const { t } = useI18n();
  const [checkedAt, setCheckedAt] = useState(0);
  const updater = window.ogb?.updater;
  const status = s?.status ?? "idle";
  // download and install both round-trip through main before the status
  // changes — spin on the click itself, and let the new status clear it
  const [pending, setPending] = useState(false);
  useEffect(() => setPending(false), [status]);
  // a check that found nothing lands back on idle — acknowledge it for 3s
  const upToDate = Boolean(checkedAt) && (!s || s.status === "idle") && Date.now() - checkedAt < 3000;
  useEffect(() => {
    if (!upToDate) return;
    const timer = setTimeout(() => setCheckedAt(0), 3000);
    return () => clearTimeout(timer);
  }, [upToDate]);
  if (!updater) return null;

  const working =
    pending || status === "checking" || status === "downloading" || status === "installing";
  const label =
    status === "available"
      ? t("Version {version} available — download", { version: s?.version ?? "" })
      : status === "downloading"
        ? s?.percent == null
          ? t("Starting download…")
          : t("Downloading… {percent}%", { percent: Math.round(s.percent) })
        : status === "downloaded"
          ? t("Version {version} ready — restart to update", { version: s?.version ?? "" })
          : status === "installing"
            ? t("Restarting to update…")
            : status === "checking"
              ? t("Checking for updates…")
              : upToDate
                ? t("You're up to date")
                : t("Check for updates");

  return (
    <button
      onClick={() => {
        if (status === "downloaded") {
          setPending(true);
          return void updater.install();
        }
        if (status === "available") {
          setPending(true);
          return void updater.download();
        }
        setCheckedAt(Date.now());
        void updater.check();
      }}
      disabled={working}
      title={label}
      aria-label={label}
      className="relative rounded-md p-2 text-accent hover:bg-raised disabled:opacity-60"
    >
      {working ? (
        <Loader2 size={18} className="animate-spin" />
      ) : upToDate ? (
        <Check size={18} />
      ) : status === "available" ? (
        <ArrowDownToLine size={18} />
      ) : (
        <RefreshCw size={18} />
      )}
      {status === "downloaded" && (
        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />
      )}
    </button>
  );
}

type Translate = (source: string, vars?: Record<string, string | number>) => string;

function previewFromLast(bot: Bot, last: Message | undefined, t: Translate): string {
  if (bot.activity === "waiting-on-you") return t("Waiting for you…");
  if (bot.busy) return t("Working…");
  if (!last) return "";
  if (last.kind === "options" && last.card) return last.card.title;
  if (last.kind === "activity" && last.tool) return last.tool.name;
  if (last.kind === "screen") return t("Screen frame");
  if (last.kind === "page" && last.page) return last.page.title;
  return last.text ?? "";
}

function preview(bot: Bot, t: Translate): string {
  // the visible branch's tail — bot.messages holds every fork, so its last
  // entry can belong to a version the user switched away from
  return previewFromLast(bot, visibleMessages(bot).at(-1), t);
}

interface MenuState {
  botId: string;
  x: number;
  y: number;
}

function groupPreview(group: Group, bots: Bot[], t: Translate): string {
  if (group.busyBotId) {
    const name = bots.find((b) => b.id === group.busyBotId)?.name ?? t("A bot");
    return t("{name} is working…", { name });
  }
  const last = group.messages.at(-1);
  if (!last) return t("No messages yet");
  const text =
    last.kind === "activity" && last.tool
      ? last.tool.name
      : last.kind === "page" && last.page
        ? last.page.title
        : (last.text ?? "");
  if (last.role === "user") return t("You: {text}", { text });
  return last.from ? `${last.from.name}: ${text}` : text;
}

/** Room avatar: 2–3 overlapping crews in the same 56px slot a bot gets. */
function StackedCrews({ members }: { members: Bot[] }) {
  if (members.length <= 1) {
    const b = members[0];
    return (
      <div className="flex size-14 shrink-0 items-center justify-center">
        {b ? (
          <CrewAvatar color={b.color} shape={b.mascotShape} role={displayRole(b)} state="happy" size={56} animated={false} />
        ) : (
          <Users size={24} className="text-ink-secondary" />
        )}
      </div>
    );
  }
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <div className="flex size-14 shrink-0 items-center justify-center">
      <div className="flex items-center -space-x-3">
        {shown.map((b) => (
          <CrewAvatar key={b.id} color={b.color} shape={b.mascotShape} role={displayRole(b)} state="happy" size={30} animated={false} />
        ))}
        {extra > 0 && (
          <span className="z-10 flex size-[22px] items-center justify-center rounded-full border border-hairline/40 bg-raised text-[10px] font-medium text-ink-secondary">
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
}

function GroupListItem({ group, onMenu }: { group: Group; onMenu: (menu: { groupId: string; x: number; y: number }) => void }) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const selected = state.activeView === "chat" && state.selectedId === group.id;
  const members = group.memberIds
    .map((id) => state.bots.find((b) => b.id === id))
    .filter((b): b is Bot => Boolean(b));
  const last = group.messages.at(-1);
  return (
    <button
      onClick={() => dispatch({ type: "select", id: group.id })}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ groupId: group.id, x: e.clientX, y: e.clientY });
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
        selected ? "bg-raised" : "hover:bg-raised/50",
      )}
    >
      <StackedCrews members={members} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold text-ink">{group.name}</span>
          {selected && last && <span className="shrink-0 text-xs text-ink-secondary">{formatTime(last.at)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-ink-secondary">{groupPreview(group, state.bots, t)}</span>
          {group.unread && <span className="size-2 shrink-0 rounded-full bg-accent" />}
        </div>
      </div>
    </button>
  );
}

function RoomContextMenu({
  menu,
  onClose,
}: {
  menu: { groupId: string; x: number; y: number };
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const group = state.groups.find((g) => g.id === menu.groupId);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-room-menu]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (!group) return null;
  const top = Math.min(menu.y, window.innerHeight - 164);
  const left = Math.min(menu.x, window.innerWidth - 240);
  return createPortal(
    <div
      data-room-menu
      style={{ top, left }}
      className="fixed z-40 w-[228px] overflow-hidden rounded-xl border border-hairline/50 bg-card py-1.5 shadow-2xl shadow-black/60"
    >
      <button
        onClick={() => {
          void copyText(group.threadId).then((ok) => {
            setCopyState(ok ? "copied" : "failed");
            window.setTimeout(() => setCopyState("idle"), 1600);
          });
        }}
        title={t("Identifies this transcript in logs and API requests. It is not a share link.")}
        className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
      >
        <ClipboardCopy size={16} className={cn("shrink-0", copyState === "failed" ? "text-danger" : "text-ink-secondary")} />
        {copyState === "copied" ? t("Copied") : copyState === "failed" ? t("Copy failed") : t("Copy conversation ID")}
      </button>
      <button
        onClick={() => {
          dispatch({ type: "deleteGroup", groupId: group.id });
          onClose();
        }}
        className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-danger hover:bg-raised/70"
      >
        <Trash2 size={16} />
        {t("Delete Room")}
      </button>
    </div>,
    document.body,
  );
}

/** Pick members → Create. The room name is optional; the server defaults it. */
function NewRoomPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const bots = state.bots.filter((b) => !b.hidden);
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const create = () => {
    if (!picked.size) return;
    dispatch({ type: "createGroup", memberIds: [...picked], name: name.trim() || undefined });
    track("room_created", { members: picked.size });
    onClose();
  };
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[340px] rounded-2xl border border-hairline/50 bg-card p-4 shadow-2xl">
        <div className="mb-3 text-[15px] font-semibold text-ink">{t("New Room")}</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") onClose();
          }}
          placeholder={t("Room name (optional)")}
          className="mb-3 w-full rounded-lg bg-raised/70 px-3 py-2 text-[14px] text-ink placeholder:text-ink-secondary focus:outline-none"
        />
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {bots.length === 0 && (
            <div className="px-2 py-4 text-center text-[13px] text-ink-secondary">{t("Create a bot first — rooms are made of bots.")}</div>
          )}
          {bots.map((b) => (
            <button
              key={b.id}
              onClick={() => toggle(b.id)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-raised/50"
            >
              <CrewAvatar color={b.color} shape={b.mascotShape} role={displayRole(b)} state="happy" size={28} animated={false} />
              <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{b.name}</span>
              <span
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-full border",
                  picked.has(b.id) ? "border-accent bg-accent text-white" : "border-hairline/60",
                )}
              >
                {picked.has(b.id) && <Check size={12} />}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={create}
          disabled={!picked.size}
          className="mt-3 w-full rounded-lg bg-accent py-2 text-[14px] font-medium text-white hover:brightness-110 disabled:opacity-40"
        >
          {picked.size ? t("Create Room · {count} bots", { count: picked.size }) : t("Create Room")}
        </button>
      </div>
    </div>
  );
}

function BotContextMenu({
  menu,
  onClose,
  onArchive,
}: {
  menu: MenuState;
  onClose: () => void;
  onArchive: (bot: Bot) => void;
}) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const bot = state.bots.find((b) => b.id === menu.botId);
  const botTeam = bot ? state.teams.find((team) => team.memberIds.includes(bot.id)) : undefined;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-bot-menu]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (!bot) return null;
  const engine = state.instances.find((instance) => instance.instanceId === bot.modelSelection.instanceId);
  const canCoordinate = engine?.capabilities?.agentsMcp === true;
  const visibleBotCount = state.bots.filter((candidate) => !candidate.hidden).length;
  const archiveBlocked = Boolean(bot.chiefOfStaff) || visibleBotCount <= 1;
  const archiveHint = bot.chiefOfStaff
    ? t("Choose another Chief of Staff first")
    : visibleBotCount <= 1
      ? t("Keep at least one active bot")
      : undefined;
  // keep the menu on-screen near the click
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - 380));
  const left = Math.min(menu.x, window.innerWidth - 240);

  const item = (
    icon: React.ReactNode,
    label: string,
    onClick?: () => void,
    opts?: { danger?: boolean; disabled?: boolean; hint?: string; keepOpen?: boolean },
  ) => (
    <button
      key={label}
      disabled={opts?.disabled}
      onClick={() => {
        onClick?.();
        if (!opts?.keepOpen) onClose();
      }}
      title={opts?.hint}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px]",
        opts?.danger ? "text-danger" : "text-ink",
        opts?.disabled ? "cursor-default opacity-40" : "hover:bg-raised/70",
      )}
    >
      {icon}
      {label}
    </button>
  );
  const divider = (key: string) => <div key={key} className="mx-2 my-1 border-t border-hairline/40" />;

  return (
    <div
      data-bot-menu
      style={{ top, left }}
      className="fixed z-40 w-[228px] overflow-hidden rounded-xl border border-hairline/50 bg-card py-1.5 shadow-2xl shadow-black/60"
    >
      {[
        item(
          bot.pinned ? <PinOff size={16} className="text-ink-secondary" /> : <Pin size={16} className="text-ink-secondary" />,
          bot.pinned ? t("Unpin") : t("Pin"),
          () => dispatch({ type: "updateBot", botId: bot.id, patch: { pinned: !bot.pinned } }),
        ),
        item(
          <Crown size={16} className={bot.chiefOfStaff ? "text-accent" : "text-ink-secondary"} />,
          bot.chiefOfStaff ? t("Remove Chief of Staff") : t("Make Chief of Staff"),
          () => dispatch({ type: "updateBot", botId: bot.id, patch: { chiefOfStaff: !bot.chiefOfStaff } }),
          {
            disabled: !bot.chiefOfStaff && !canCoordinate,
            hint: !bot.chiefOfStaff && !canCoordinate ? t("Choose a Claude or ACP engine first") : undefined,
          },
        ),
        item(
          <FolderPlus size={16} className="text-ink-secondary" />,
          botTeam ? t("Leave team") : t("Create team"),
          () => {
            if (botTeam) {
              void api(`/api/teams/${botTeam.id}/members/${bot.id}`, { method: "DELETE" })
                .then(({ team }) => dispatch({ type: "teamPatched", team }))
                .catch((error) => dispatch({ type: "error", message: error.message }));
              return;
            }
            const name = window.prompt(t("Team name"), `${bot.name}'s team`);
            if (!name?.trim()) return;
            void api("/api/teams", {
              method: "POST",
              body: JSON.stringify({ name: name.trim(), creatorBotId: bot.id }),
            })
              .then(({ team }) => dispatch({ type: "teamPatched", team }))
              .catch((error) => dispatch({ type: "error", message: error.message }));
          },
          {
            disabled: Boolean(botTeam && botTeam.leaderBotId === bot.id),
            hint: botTeam?.leaderBotId === bot.id
              ? t("Choose a new leader first")
              : botTeam
                ? t("Leave this team")
                : t("Create a team with this bot as leader"),
          },
        ),
        item(<BellDot size={16} className="text-ink-secondary" />, t("Mark as Unread"), () =>
          dispatch({ type: "markUnread", botId: bot.id }),
        ),
        divider("d1"),
        item(<Pencil size={16} className="text-ink-secondary" />, t("Edit Profile"), () => {
          dispatch({ type: "select", id: bot.id });
          dispatch({ type: "toggleSettings", open: true });
        }),
        item(<Copy size={16} className="text-ink-secondary" />, t("Duplicate"), () =>
          dispatch({ type: "duplicateBot", botId: bot.id }),
        ),
        divider("d2"),
        item(
          <ClipboardCopy size={16} className="text-ink-secondary" />,
          copyState === "copied" ? t("Copied") : copyState === "failed" ? t("Copy failed") : t("Copy conversation ID"),
          () => {
            void copyText(bot.threadId).then((ok) => {
              setCopyState(ok ? "copied" : "failed");
              window.setTimeout(() => setCopyState("idle"), 1600);
            });
          },
          {
            keepOpen: true,
            hint: t("Identifies this transcript in logs and API requests. It is not a share link."),
          },
        ),
        divider("d3"),
        item(
          <Archive size={16} className="text-ink-secondary" />,
          t("Archive"),
          () => onArchive(bot),
          {
            disabled: archiveBlocked,
            hint: archiveHint,
          },
        ),
        item(<Trash2 size={16} />, t("Delete"), () => dispatch({ type: "deleteBot", botId: bot.id }), {
          danger: true,
        }),
      ]}
    </div>
  );
}

const BotListItem = memo(function BotListItem({
  bot,
  onMenu,
  selected,
  mascotMotion,
  dispatch,
  teamLeader = false,
}: {
  bot: Bot;
  onMenu: (menu: MenuState) => void;
  selected: boolean;
  mascotMotion: AppState["mascotMotion"];
  dispatch: (action: Action) => void;
  teamLeader?: boolean;
}) {
  const { t } = useI18n();
  const [renaming, setRenaming] = useState(false);
  // The visible branch, so a version switch changes the row with the chat.
  // Memoized on the bot object: a message event normally replaces one bot,
  // and the other rows must not re-walk large transcripts on every event.
  const visible = useMemo(() => visibleMessages(bot), [bot]);
  const last = visible.at(-1);
  const previewText = useMemo(() => previewFromLast(bot, last, t), [bot, last, t]);
  const avatarState = useMemo(() => stateForBot({ ...bot, messages: visible }), [bot, visible]);
  const rowClass = cn(
    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left",
    bot.chiefOfStaff
      ? selected
        ? "border-accent/40 bg-accent/15"
        : "border-accent/25 bg-accent/5 hover:bg-accent/10"
      : selected
        ? "border-transparent bg-raised"
        : "border-transparent hover:bg-raised/50",
  );
  const body = (
    <>
      <CrewAvatar
        color={bot.color}
        shape={bot.mascotShape}
        role={displayRole(bot)}
        state={avatarState}
        size={56}
        motion={mascotMotion?.kind ?? "none"}
        motionKey={mascotMotion?.nonce ?? 0}
        animated={selected}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[15px] font-semibold text-ink">
            {bot.pinned && <Pin size={12} className="shrink-0 text-ink-secondary" />}
            <RenameTitle
              value={bot.name}
              onCommit={(name) => dispatch({ type: "updateBot", botId: bot.id, patch: { name } })}
              onEditingChange={setRenaming}
              className="truncate"
              inputClassName="w-full rounded bg-inset px-1 py-0.5 text-[15px] font-semibold"
            />
          </span>
          {selected && last && !renaming && (
            <span className="shrink-0 text-xs text-ink-secondary">
              {formatTime(last.at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] text-ink-secondary">
            {bot.chiefOfStaff && (
              <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-accent">
                <Crown size={11} /> {t("Chief of Staff")}
              </span>
            )}
            {teamLeader && (
              <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-accent">
                <Crown size={11} /> {t("Team leader")}
              </span>
            )}
            {(bot.chiefOfStaff || teamLeader) && previewText && (
              <span className="shrink-0 text-ink-secondary/60">·</span>
            )}
            <span className="truncate">{previewText}</span>
          </span>
          {bot.unread && (
            <span className="size-2 shrink-0 rounded-full bg-accent" />
          )}
        </div>
      </div>
    </>
  );
  const onContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    onMenu({ botId: bot.id, x: event.clientX, y: event.clientY });
  };

  // Keep the rename <input> out of role="button" — a button's descendants
  // are presentational, which hides the field from assistive tech.
  if (renaming) {
    return (
      <div className={rowClass} onContextMenu={onContextMenu}>
        {body}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => dispatch({ type: "select", id: bot.id })}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          dispatch({ type: "select", id: bot.id });
        }
      }}
      onContextMenu={onContextMenu}
      className={rowClass}
    >
      {body}
    </div>
  );
});

function ArchivedBotsPanel({
  bots,
  onClose,
  onRestored,
}: {
  bots: Bot[];
  onClose: () => void;
  onRestored: (message: string) => void;
}) {
  const { dispatch } = useStore();
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restoringAll, setRestoringAll] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyId && !restoringAll) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busyId, onClose, restoringAll]);

  const restore = async (bot: Bot) => {
    setBusyId(bot.id);
    setError("");
    try {
      const response = await api(`/api/bots/${bot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden: false }),
      });
      dispatch({ type: "botPatched", bot: response.bot });
      dispatch({ type: "select", id: bot.id });
      onRestored(`${bot.name} restored`);
      if (bots.length === 1) onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  const restoreAll = async () => {
    setRestoringAll(true);
    setError("");
    try {
      const responses = await Promise.all(
        bots.map((bot) =>
          api(`/api/bots/${bot.id}`, {
            method: "PATCH",
            body: JSON.stringify({ hidden: false }),
          }),
        ),
      );
      for (const response of responses) dispatch({ type: "botPatched", bot: response.bot });
      const first = bots[0];
      if (first) dispatch({ type: "select", id: first.id });
      onRestored(`${bots.length} ${bots.length === 1 ? "bot" : "bots"} restored`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRestoringAll(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && !busyId && !restoringAll && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archived-bots-title"
        tabIndex={-1}
        className="animate-pop-in flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-[760px] flex-col overflow-hidden rounded-[24px] border border-hairline/50 bg-panel shadow-2xl shadow-black/50 outline-none"
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-6 sm:px-8 sm:pt-7">
          <div>
            <h2 id="archived-bots-title" className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{t("Archived bots")}</h2>
            <p className="mt-1 text-[13px] text-ink-secondary">{t("Conversations are kept until you choose to delete a bot.")}</p>
          </div>
          <div className="flex items-center gap-1">
            {bots.length > 1 && (
              <button
                onClick={() => void restoreAll()}
                disabled={restoringAll || Boolean(busyId)}
                className="flex items-center gap-1.5 rounded-full bg-raised px-3.5 py-2 text-[12.5px] text-ink hover:bg-raised-hover disabled:opacity-40"
              >
                {restoringAll && <Loader2 size={13} className="animate-spin" />}
                {t("Restore all")}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={restoringAll || Boolean(busyId)}
              className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
              aria-label={t("Close archived bots")}
            >
              <X size={21} />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-3 sm:px-8">
          <div className="mb-3 text-[12px] font-medium text-ink-secondary">{t("{count} archived", { count: bots.length })}</div>
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            {bots.map((bot) => (
              <div key={bot.id} className="flex min-h-[82px] items-center gap-3 border-b border-hairline/35 px-1 py-3">
                <CrewAvatar color={bot.color} shape={bot.mascotShape} role={displayRole(bot)} state="happy" size={42} animated={false} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{bot.name}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-ink-secondary">{bot.title || t("Bot")}</div>
                </div>
                <button
                  onClick={() => void restore(bot)}
                  disabled={restoringAll || Boolean(busyId)}
                  className="flex min-w-[78px] items-center justify-center gap-1.5 rounded-full bg-raised px-3.5 py-2 text-[12.5px] text-ink hover:bg-raised-hover disabled:opacity-40"
                >
                  {busyId === bot.id && <Loader2 size={13} className="animate-spin" />}
                  {t("Restore")}
                </button>
              </div>
            ))}
          </div>
          {error && <div role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const { capabilities } = useDesktopCapabilities();
  const showGroupChats = useShowGroupChats();
  const importReturnRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [roomMenu, setRoomMenu] = useState<{ groupId: string; x: number; y: number } | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [newRoom, setNewRoom] = useState(false);
  const [teamLibraryOpen, setTeamLibraryOpen] = useState(false);
  const [teamsPanelOpen, setTeamsPanelOpen] = useState(false);
  const [archivedBotsOpen, setArchivedBotsOpen] = useState(false);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [exportingTeam, setExportingTeam] = useState(false);
  const [teamFeedback, setTeamFeedback] = useState<{
    error: boolean;
    text: string;
    undo?: TeamImportResult;
    restoreBot?: { id: string; name: string };
  } | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!showGroupChats) setNewRoom(false);
  }, [showGroupChats]);

  // Esc closes the drawer, mirroring ApiKeys.tsx:75-85. Bound only while the
  // drawer is open — on mobile, exactly when a bot/room context menu or the
  // New Room panel can be open on top of it, so the same Escape press closes
  // them together. Fine, since both directions are "get me out of here."
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!teamFeedback) return;
    const timer = window.setTimeout(() => setTeamFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [teamFeedback]);

  const exportAllBots = async () => {
    setExportingTeam(true);
    setTeamFeedback(null);
    try {
      const exported = await downloadAllBots();
      track("team_exported", { members: exported.members, scope: "all_visible" });
      setTeamFeedback({ error: false, text: `${exported.members} bots exported` });
    } catch (cause) {
      setTeamFeedback({
        error: true,
        text: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setExportingTeam(false);
    }
  };

  const undoTeamLoad = async (result: TeamImportResult) => {
    setTeamFeedback(null);
    try {
      const archiveNew = await Promise.all(
        result.importedBotIds.map((botId) =>
          api(`/api/bots/${botId}`, {
            method: "PATCH",
            body: JSON.stringify({ hidden: true, chiefOfStaff: false }),
          }),
        ),
      );
      for (const response of archiveNew) dispatch({ type: "botPatched", bot: response.bot });

      const previousChief = result.archived.find((bot) => bot.chiefOfStaff);
      const restoreOthers = await Promise.all(
        result.archived
          .filter((bot) => !bot.chiefOfStaff)
          .map((bot) =>
            api(`/api/bots/${bot.id}`, {
              method: "PATCH",
              body: JSON.stringify({ hidden: false }),
            }),
          ),
      );
      for (const response of restoreOthers) dispatch({ type: "botPatched", bot: response.bot });
      if (previousChief) {
        const response = await api(`/api/bots/${previousChief.id}`, {
          method: "PATCH",
          body: JSON.stringify({ hidden: false, chiefOfStaff: true }),
        });
        dispatch({ type: "botPatched", bot: response.bot });
      }
      const first = result.archived[0];
      if (first) dispatch({ type: "select", id: first.id });
      setTeamFeedback({ error: false, text: "Previous team restored" });
    } catch (cause) {
      setTeamFeedback({ error: true, text: cause instanceof Error ? cause.message : String(cause) });
    }
  };

  const archiveBot = async (bot: Bot) => {
    const activeBots = state.bots.filter((candidate) => !candidate.hidden);
    if (bot.chiefOfStaff || activeBots.length <= 1) return;
    setTeamFeedback(null);
    try {
      const response = await api(`/api/bots/${bot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden: true }),
      });
      dispatch({ type: "botPatched", bot: response.bot });
      if (state.selectedId === bot.id) {
        const next = activeBots.find((candidate) => candidate.id !== bot.id);
        if (next) dispatch({ type: "select", id: next.id });
      }
      setTeamFeedback({
        error: false,
        text: `${bot.name} archived`,
        restoreBot: { id: bot.id, name: bot.name },
      });
    } catch (cause) {
      setTeamFeedback({ error: true, text: cause instanceof Error ? cause.message : String(cause) });
    }
  };

  const undoBotArchive = async (bot: { id: string; name: string }) => {
    setTeamFeedback(null);
    try {
      const response = await api(`/api/bots/${bot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden: false }),
      });
      dispatch({ type: "botPatched", bot: response.bot });
      dispatch({ type: "select", id: bot.id });
      setTeamFeedback({ error: false, text: `${bot.name} restored` });
    } catch (cause) {
      setTeamFeedback({ error: true, text: cause instanceof Error ? cause.message : String(cause) });
    }
  };

  const macInset = capabilities.windowChrome === "mac-inset";
  const browser = capabilities.host.label === "Browser";
  // Frameless chrome (macOS inset traffic lights, Linux custom controls) needs
  // a drag strip in the header; the buttons inside it opt out.
  const customChrome = macInset || Boolean(window.ogb?.windowControls);

  const q = query.trim().toLowerCase();

  // Message search rides the same box as the name filter: names match
  // instantly from local state; transcript hits are the SearchResults
  // section below the list (debounced, lands on the message).

  const matchingBots = state.bots
    .filter((b) => !b.hidden)
    .filter(
      (b) =>
        !q ||
        b.name.toLowerCase().includes(q) ||
        (b.title ?? "").toLowerCase().includes(q) ||
        preview(b, t).toLowerCase().includes(q),
    );
  const chiefBot = matchingBots.find((bot) => bot.chiefOfStaff);
  const chiefTeam = chiefBot
    ? state.teams.find((team) => team.memberIds.includes(chiefBot.id))
    : undefined;
  // A Chief of Staff without a team stays in the special top slot. Once the
  // chief belongs to a team, it must appear inside that team like every other
  // member — otherwise the team looks incomplete.
  const showChiefAlone = Boolean(chiefBot && !chiefTeam);
  const visibleBots = matchingBots
    .filter((bot) => !showChiefAlone || !bot.chiefOfStaff)
    .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false));
  const visibleGroups = showGroupChats
    ? state.groups.filter((g) => !q || g.name.toLowerCase().includes(q))
    : [];
  const teamById = new Map(state.teams.map((team) => [team.id, team]));
  const botById = new Map(state.bots.map((bot) => [bot.id, bot]));
  const teamByBot = new Map<string, { id: string; name: string }>();
  for (const team of state.teams) {
    for (const botId of team.memberIds) teamByBot.set(botId, { id: team.id, name: team.name });
  }
  // A conversation belongs inside a team when the team explicitly owns its
  // room, or when every participant belongs to that same team. A room with
  // one member outside the team (or a member in another team) stays in the
  // general room list — it cannot honestly claim to be that team's room.
  const teamByGroup = new Map<string, string>();
  for (const team of state.teams) {
    if (team.roomId) teamByGroup.set(team.roomId, team.id);
  }
  for (const group of state.groups) {
    if (teamByGroup.has(group.id) || group.memberIds.length === 0) continue;
    const teamId = teamByBot.get(group.memberIds[0]!)?.id;
    if (teamId && group.memberIds.every((botId) => teamByBot.get(botId)?.id === teamId)) {
      teamByGroup.set(group.id, teamId);
    }
  }
  const teamBuckets = new Map<string, { name: string; leaderBotId?: string; bots: Bot[] }>();
  for (const bot of visibleBots) {
    const team = teamByBot.get(bot.id);
    const key = team?.id ?? "";
    const bucket =
      teamBuckets.get(key) ??
      { name: team?.name ?? "", leaderBotId: team ? teamById.get(team.id)?.leaderBotId : undefined, bots: [] };
    bucket.bots.push(bot);
    teamBuckets.set(key, bucket);
  }
  // A team reads leader-first: the person in charge is the first row, then
  // pinned bots, then the rest. This is stable, so existing order survives
  // for members with the same rank.
  for (const bucket of teamBuckets.values()) {
    const leaderId = bucket.leaderBotId;
    bucket.bots.sort(
      (a, b) =>
        Number(b.id === leaderId) - Number(a.id === leaderId) ||
        Number(b.pinned ?? false) - Number(a.pinned ?? false),
    );
  }
  const teamOrder = new Map(state.teams.map((team, index) => [team.id, index]));
  const teamKeys = [...teamBuckets.keys()].sort((a, b) => {
    if (a === b) return 0;
    if (a === "") return 1;
    if (b === "") return -1;
    return (teamOrder.get(a) ?? 999) - (teamOrder.get(b) ?? 999);
  });
  const hasTeams = teamKeys.some((key) => key !== "");
  const groupsByTeam = new Map<string, Group[]>();
  const ungroupedGroups: Group[] = [];
  for (const group of visibleGroups) {
    const teamId = teamByGroup.get(group.id);
    // Keep the room visible if its team has no visible bots; moving it into a
    // section that is not rendered would silently hide the conversation.
    if (teamId && teamBuckets.has(teamId)) {
      const bucket = groupsByTeam.get(teamId) ?? [];
      bucket.push(group);
      groupsByTeam.set(teamId, bucket);
    } else {
      ungroupedGroups.push(group);
    }
  }
  const archivedBots = state.bots.filter((bot) => bot.hidden);
  const pendingTeamUndo = teamFeedback?.undo;
  const pendingBotUndo = teamFeedback?.restoreBot;

  return (
    <aside
      className={cn(
        "flex h-full w-[320px] shrink-0 flex-col border-r border-hairline/40 bg-panel",
        // Below md only: the sidebar leaves the flow and slides in over the chat.
        // Scoped with max-md: rather than cancelled with md: on purpose — Tailwind
        // v4 emits the native `translate` property, and any value other than
        // `none` turns this element into a containing block for its `fixed`
        // descendants. Cancelling it with an `md:` prefix still emits a value, which
        // silently reparents NewRoomPanel's overlay and the "+" menu backdrop on
        // desktop.
        "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40",
        "max-md:transition-transform max-md:duration-200",
        open ? "max-md:translate-x-0" : "max-md:-translate-x-full",
      )}
    >
      {/* macOS owns inset traffic lights; Linux draws its own controls at the
          top-right of the window, so the header stays a drag strip. */}
      <div
        className="flex items-center justify-between px-4 pt-3.5 pb-1"
        style={customChrome ? ({ WebkitAppRegion: "drag" } as React.CSSProperties) : undefined}
      >
        {macInset ? (
          <div className="w-14" />
        ) : browser ? (
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </div>
        ) : (
          // The app's own top-left mark. GNOME's top panel cannot host an
          // application icon (the tray lives on the right), so the brand sits
          // where the window chrome leaves space.
          <img
            src="/app-icon.svg"
            alt="KodBot"
            title="KodBot"
            draggable={false}
            className="size-7 rounded-lg max-md:hidden"
          />
        )}
        <div
          className="flex items-center gap-0.5"
          style={customChrome ? ({ WebkitAppRegion: "no-drag" } as React.CSSProperties) : undefined}
        >
          <button
            onClick={() => {
              setPlusOpen(false);
              setSearchOpen(true);
            }}
            aria-label={t("Search bots and messages")}
            aria-expanded={searchOpen}
            className={cn(
              "rounded-md p-1.5 hover:bg-raised hover:text-ink",
              searchOpen ? "bg-raised text-accent" : "text-ink-secondary",
            )}
            title={t("Search bots and messages")}
          >
            <Search size={18} />
          </button>
          <div className="relative">
            <button
              ref={importReturnRef}
              onClick={() => setPlusOpen((o) => !o)}
              aria-label={t("New or share")}
              className="rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
              title={t("New or share")}
            >
              <Plus size={20} strokeWidth={2} />
            </button>
            {plusOpen && (
            <>
              <div className="fixed inset-0 z-30" onMouseDown={() => setPlusOpen(false)} />
              <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-xl border border-hairline/50 bg-card py-1.5 shadow-2xl shadow-black/60">
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    track("bot_created");
                    dispatch({ type: "newBot" });
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                >
                  <BotIcon size={16} className="text-ink-secondary" />
                  {t("New Bot")}
                </button>
                {showGroupChats && (
                  <button
                    onClick={() => {
                      setPlusOpen(false);
                      setNewRoom(true);
                    }}
                    className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                  >
                    <Users size={16} className="text-ink-secondary" />
                    {t("New Room")}
                  </button>
                )}
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    void exportAllBots();
                  }}
                  disabled={exportingTeam}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                >
                  {exportingTeam ? <Loader2 size={16} className="animate-spin text-ink-secondary" /> : <ArrowDownToLine size={16} className="text-ink-secondary" />}
                  {exportingTeam ? t("Exporting…") : t("Export all bots")}
                </button>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    setTeamsPanelOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                >
                  <Users size={16} className="text-ink-secondary" />
                  {t("Manage teams")}
                </button>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    setTeamLibraryOpen(true);
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                >
                  <Library size={16} className="text-ink-secondary" />
                  {t("Team library")}
                </button>
                {archivedBots.length > 0 && (
                  <button
                    onClick={() => {
                      setPlusOpen(false);
                      setArchivedBotsOpen(true);
                    }}
                    className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-[14px] text-ink hover:bg-raised/70"
                  >
                    <Archive size={16} className="text-ink-secondary" />
                    <span className="flex-1">{t("Archived bots")}</span>
                    <span className="text-[11.5px] text-ink-secondary">{archivedBots.length}</span>
                  </button>
                )}
              </div>
            </>
          )}
          </div>
          <button
            onClick={() => dispatch({ type: "showRoutines" })}
            aria-label={t("Automations")}
            title={t("Automations")}
            className={cn(
              "relative rounded-md p-1.5 hover:bg-raised hover:text-ink",
              state.activeView === "routines" ? "bg-raised text-accent" : "text-ink-secondary",
            )}
          >
            <CalendarDays size={18} />
            {state.routineRuns.some((run) => ["failed", "missed"].includes(run.status) && !run.seenAt) && (
              <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-danger" />
            )}
          </button>
          <button
            onClick={() => dispatch({ type: "togglePlugins", open: true })}
            aria-label={t("Connected apps")}
            title={t("Connected apps")}
            className="rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
          >
            <Puzzle size={18} />
          </button>
        </div>
      </div>

      {/* Bot list */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="flex flex-col gap-0.5">
          {chiefBot && showChiefAlone && (
            <div className="mb-1.5">
              <BotListItem
                bot={chiefBot}
                onMenu={setMenu}
                selected={state.activeView === "chat" && state.selectedId === chiefBot.id}
                mascotMotion={state.mascotMotion?.botId === chiefBot.id ? state.mascotMotion : null}
                dispatch={dispatch}
              />
            </div>
          )}
          {ungroupedGroups.map((g) => (
            <GroupListItem key={g.id} group={g} onMenu={setRoomMenu} />
          ))}
          {!hasTeams ? (
            visibleBots.map((b) => (
              <BotListItem
                key={b.id}
                bot={b}
                onMenu={setMenu}
                selected={state.activeView === "chat" && state.selectedId === b.id}
                mascotMotion={state.mascotMotion?.botId === b.id ? state.mascotMotion : null}
                dispatch={dispatch}
              />
            ))
          ) : (
            teamKeys.map((team) => {
              const bucket = teamBuckets.get(team);
              const bots = bucket?.bots ?? [];
              const record = team ? teamById.get(team) : undefined;
              const leader = record ? botById.get(record.leaderBotId) : undefined;
              const rooms = team ? (groupsByTeam.get(team) ?? []) : [];
              const collapseKey = team || "__ungrouped__";
              const collapsed = !q && collapsedTeams.has(collapseKey);
              return (
                <div key={collapseKey} className="flex flex-col gap-0.5">
                  <button
                    onClick={() =>
                      setCollapsedTeams((current) => {
                        const next = new Set(current);
                        if (next.has(collapseKey)) next.delete(collapseKey);
                        else next.add(collapseKey);
                        return next;
                      })
                    }
                    aria-expanded={!collapsed}
                    className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-left text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-secondary hover:bg-raised/50 hover:text-ink"
                  >
                    {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{bucket?.name || t("Other bots")}</span>
                      {leader && (
                        <span className="flex min-w-0 items-center gap-1 text-[10px] font-normal normal-case tracking-normal text-accent/90">
                          <Crown size={9} className="shrink-0" />
                          <span className="truncate">{t("Lead: {name}", { name: leader.name })}</span>
                        </span>
                      )}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] font-normal tracking-normal text-ink-secondary/70">
                      {bots.length}
                    </span>
                  </button>
                  {!collapsed &&
                    bots.map((b) => (
                      <BotListItem
                        key={b.id}
                        bot={b}
                        onMenu={setMenu}
                        selected={state.activeView === "chat" && state.selectedId === b.id}
                        mascotMotion={state.mascotMotion?.botId === b.id ? state.mascotMotion : null}
                        dispatch={dispatch}
                        teamLeader={record?.leaderBotId === b.id}
                      />
                    ))}
                  {!collapsed && rooms.length > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      <div className="px-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-secondary/70">
                        {t("Rooms")}
                      </div>
                      {rooms.map((g) => (
                        <GroupListItem key={g.id} group={g} onMenu={setRoomMenu} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 pt-2">
        <div className="flex items-center">
          <button
            onClick={() => dispatch({ type: "toggleAppSettings" })}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-raised/50"
          >
            <InitialsAvatar initials={profileInitials(state.config?.profile)} size={28} />
            <span className="truncate text-[14px] text-ink">
              {state.config?.profile?.name?.trim() || state.config?.profile?.email?.trim() || t("You")}
            </span>
          </button>
          <UpdateButton />
          <button
            onClick={() => dispatch({ type: "toggleAppSettings" })}
            className="rounded-md p-2 text-ink-secondary hover:bg-raised hover:text-ink"
            title={t("App settings")}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <SearchDialog
          query={query}
          onQuery={setQuery}
          onClose={closeSearch}
          onOpenTeams={() => setTeamsPanelOpen(true)}
        />
      )}
      {menu && <BotContextMenu menu={menu} onClose={() => setMenu(null)} onArchive={(bot) => void archiveBot(bot)} />}
      {roomMenu && (
        <RoomContextMenu
          menu={roomMenu}
          onClose={() => setRoomMenu(null)}
        />
      )}
      {newRoom && <NewRoomPanel onClose={() => setNewRoom(false)} />}
      {archivedBotsOpen && (
        <ArchivedBotsPanel
          bots={archivedBots}
          onClose={() => setArchivedBotsOpen(false)}
          onRestored={(message) => setTeamFeedback({ error: false, text: message })}
        />
      )}
      {teamsPanelOpen && <TeamsPanel onClose={() => setTeamsPanelOpen(false)} />}
      {teamLibraryOpen && (
        <TeamLibraryPanel
          returnFocusRef={importReturnRef}
          onClose={() => setTeamLibraryOpen(false)}
          onImported={(result) => {
            setTeamLibraryOpen(false);
            setTeamFeedback(
              result.archived.length > 0
                ? {
                    error: false,
                    text: `${result.name} loaded · ${result.members} ${result.members === 1 ? "bot" : "bots"}`,
                    undo: result,
                  }
                : {
                    error: false,
                    text: `${result.name} loaded · ${result.members} ${result.members === 1 ? "bot" : "bots"}`,
                  },
            );
          }}
        />
      )}
      {teamFeedback &&
        createPortal(
          <div
            role="status"
            className={cn(
              "fixed bottom-4 left-4 z-[60] max-w-[300px] rounded-xl border px-3.5 py-2.5 text-[13px] shadow-xl",
              teamFeedback.error
                ? "border-danger/30 bg-card text-danger"
                : "border-hairline/50 bg-card text-ink",
            )}
          >
            <div className="flex items-center gap-3">
              <span>{teamFeedback.text}</span>
              {pendingTeamUndo && (
                <button
                  onClick={() => void undoTeamLoad(pendingTeamUndo)}
                  className="rounded-md px-1.5 py-0.5 font-medium text-accent hover:bg-raised"
                >
                  Undo
                </button>
              )}
              {pendingBotUndo && (
                <button
                  onClick={() => void undoBotArchive(pendingBotUndo)}
                  className="rounded-md px-1.5 py-0.5 font-medium text-accent hover:bg-raised"
                >
                  Undo
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </aside>
  );
}
