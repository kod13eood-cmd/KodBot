import { useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import { Loader2, Menu } from "lucide-react";
import { StoreProvider, useStore, visibleMessages } from "@/state/store";
import { Onboarding } from "@/components/Onboarding";
import { emailGateDone, initAnalytics } from "@/lib/analytics";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { GroupView } from "@/components/GroupView";
import { SettingsPanel } from "@/components/SettingsPanel";
import { PluginsPanel } from "@/components/PluginsPanel";
import { ComputerPanel } from "@/components/ComputerPanel";
import { InspectorPanel } from "@/components/InspectorPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { UpdateBanner } from "@/components/UpdateBanner";
import { PageBridge } from "@/components/PageBridge";
import { HelpPanel } from "@/components/HelpPanel";
import { BootScreen, ChatLoadingSkeleton } from "@/components/LoadingScreens";
import { WindowControls } from "@/components/WindowControls";
import { SendQueueDrainer } from "@/components/SendQueueDrainer";
import { DesktopCapabilitiesProvider } from "@/components/DesktopCapabilities";
import { RoutinesPage } from "@/components/RoutinesPage";
import { NoEngines } from "@/components/NoEngines";
import { CommandPalette } from "@/components/CommandPalette";
import { ShortcutsSheet } from "@/components/ShortcutsSheet";
import { NeedsYouBar } from "@/components/NeedsYouBar";
import { collectNeedsYou } from "@/lib/needs-you";
import { useI18n } from "@/lib/i18n";

function Shell() {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  // Mobile-only drawer state. Above md, none of these properties are emitted
  // at all — Sidebar scopes every mobile class with max-md: rather than
  // cancelling them with md:, which would still emit a translate value and
  // turn the aside into a containing block for its fixed descendants (see
  // Sidebar.tsx's className comment).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // Switching chats can involve a large transcript. Defer the expensive
  // render so the lightweight skeleton paints first instead of the window
  // looking frozen for a second.
  const deferredSelectedId = useDeferredValue(state.selectedId);
  const switching = deferredSelectedId !== state.selectedId;
  const group = state.groups.find((g) => g.id === deferredSelectedId);
  const bot = group ? undefined : (state.bots.find((b) => b.id === deferredSelectedId) ?? state.bots[0]);
  const targetGroup = state.groups.find((g) => g.id === state.selectedId);
  const targetBot = targetGroup
    ? undefined
    : (state.bots.find((b) => b.id === state.selectedId) ?? state.bots[0]);

  // Who cannot continue without an answer or an approval. Drives the persistent
  // strip, the tab title, and the app badge.
  const needsYou = useMemo(
    () =>
      collectNeedsYou(
        state.bots.map((entry) => ({
          kind: "bot" as const,
          id: entry.id,
          name: entry.name,
          messages: visibleMessages(entry),
          activity: entry.activity,
          hidden: entry.hidden,
        })),
        state.groups.map((entry) => ({
          kind: "group" as const,
          id: entry.id,
          name: entry.name,
          messages: entry.messages,
        })),
      ),
    [state.bots, state.groups],
  );

  useEffect(() => {
    document.title = needsYou.length ? `(${needsYou.length}) KodBot` : "KodBot";
    const nav = navigator as Navigator & {
      setAppBadge?: (count: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (needsYou.length) void nav.setAppBadge?.(needsYou.length).catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  }, [needsYou.length]);

  // A native notification click names the thread that asked; a room request
  // opens the room, not the member's private chat.
  useEffect(() => {
    const bridge = window.ogb?.notifications;
    if (!bridge) return;
    return bridge.onOpen(({ botId, threadId }) => {
      const room = state.groups.find((entry) => entry.threadId === threadId);
      dispatch({ type: "select", id: room?.id ?? botId });
    });
  }, [state.groups, dispatch]);

  // Nothing on this machine can run a bot. A missing cloud login does not
  // count — that CLI can still host a local model. Wait for the first
  // /api/instances response before deciding: an empty list means "not asked
  // yet", and flashing the setup screen at every launch would be worse.
  const noEngines =
    state.connected &&
    state.instances.length > 0 &&
    !state.instances.some((i) => i.snapshot.state === "available");

  // App-wide shortcuts: ⌘N new bot · ⌘1–9 jump to bot · ⌘⇧[ / ⌘⇧] prev/next.
  // Kept deliberately small; every panel already closes on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const bots = state.bots.filter((b) => !b.hidden);
      if (e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "newBot" });
      } else if (/^[1-9]$/.test(e.key)) {
        const target = bots[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          dispatch({ type: "select", id: target.id });
        }
      } else if (e.shiftKey && (e.key === "[" || e.key === "]")) {
        const idx = bots.findIndex((b) => b.id === state.selectedId);
        const next = bots[(idx + (e.key === "]" ? 1 : -1) + bots.length) % bots.length];
        if (next) {
          e.preventDefault();
          dispatch({ type: "select", id: next.id });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.bots, state.selectedId, dispatch]);

  // Picking a conversation closes the drawer: on a phone the chat is what you
  // asked for, and leaving the list up would hide it. Watching activeView too
  // catches re-selecting the bot that is already current from another view —
  // the reducer switches the view without changing selectedId. pluginsOpen
  // and settingsOpen cover the same idea from a different trigger: close the
  // drawer whenever an action opens something over the chat.
  useEffect(() => {
    setDrawerOpen(false);
  }, [state.selectedId, state.activeView, state.pluginsOpen, state.settingsOpen]);

  // The first REST snapshot can take a moment on a remote harness; show the
  // branded boot screen instead of an empty shell that looks frozen.
  if (!state.hydrated) return <BootScreen connected={state.connected} />;

  return (
    <div className="flex h-full flex-col">
      {/* fixed-position popup, bottom-left — outside the layout flow */}
      <UpdateBanner />
      <NeedsYouBar items={needsYou} />
      <div className="relative flex min-h-0 flex-1">
      <button
        type="button"
        ref={menuButtonRef}
        aria-label={t("Open bot list")}
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
        className="absolute left-3 top-3 z-30 rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink md:hidden"
      >
        <Menu size={18} />
      </button>
      {drawerOpen && (
        <div
          aria-hidden
          onMouseDown={(e) => e.target === e.currentTarget && setDrawerOpen(false)}
          className="absolute inset-0 z-30 bg-black/50 md:hidden"
        />
      )}
      <Sidebar
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          menuButtonRef.current?.focus();
        }}
      />
      {state.activeView === "routines" ? (
        <RoutinesPage />
      ) : noEngines ? (
        <NoEngines />
      ) : switching ? (
        <ChatLoadingSkeleton
          name={targetGroup?.name ?? targetBot?.name ?? ""}
          bot={targetBot}
          group={Boolean(targetGroup)}
        />
      ) : group ? (
        <GroupView key={group.id} group={group} />
      ) : bot ? (
        <ChatView bot={bot} />
      ) : (
        <main className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-app text-ink-secondary">
          <Loader2 size={20} className="animate-spin" />
          <div className="text-[14px]">
            {state.connected ? t("No bots yet") : t("Connecting to the bot server…")}
          </div>
          {!state.connected && (
            <div className="text-[12px]">
              {t("Start it with")} <code className="rounded bg-raised px-1.5 py-0.5">pnpm dev:server</code>
            </div>
          )}
        </main>
      )}
      {state.settingsOpen && bot && <SettingsPanel bot={bot} />}
      {state.computerOpen && bot && <ComputerPanel bot={bot} />}
      {state.inspectorOpen && bot && <InspectorPanel bot={bot} />}
      {state.appSettingsOpen && <SettingsModal />}
      {state.helpOpen && <HelpPanel />}
      {state.pluginsOpen && <PluginsPanel />}
      {/* mounted after the modals: same z-50 tier, so DOM order keeps the
          palette on top when one of them is open underneath */}
      <CommandPalette />
      {/* App-wide shortcut reference; owns the ⌘/ chord like the palette. */}
      <ShortcutsSheet />
      </div>
    </div>
  );
}

export default function App() {
  const [gated, setGated] = useState(() => !emailGateDone());
  useEffect(() => {
    initAnalytics();
  }, []);
  return (
    <DesktopCapabilitiesProvider>
      <StoreProvider>
        <Shell />
        <WindowControls />
        <PageBridge />
        <SendQueueDrainer />
        {gated && <Onboarding onDone={() => setGated(false)} />}
      </StoreProvider>
    </DesktopCapabilitiesProvider>
  );
}
