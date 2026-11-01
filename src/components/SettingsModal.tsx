// App settings, as a real modal with sections rather than one long panel.
// Per-bot settings (persona, model, computer) stay in SettingsPanel — this
// is the stuff shared by every bot: who you are, your keys, and the
// machine your bots can borrow.
import { useEffect, useRef, useState } from "react";
import { Coins, KeyRound, Monitor, Smartphone, Terminal, User, Volume2, X } from "lucide-react";
import { useStore, type AppSettingsSection } from "@/state/store";
import { ApiKeyRow } from "./ApiKeys";
import { useUpdaterState } from "@/lib/updater";
import { EnginesSettings } from "./EnginesSettings";
import { LocalComputerSection } from "./LocalComputerSection";
import { CompanionSection } from "./CompanionSection";
import { Card } from "./SettingsPrimitives";
import { UsageSection } from "./UsageSection";
import { VoiceSettings } from "./VoiceSettings";
import { openShortcutsSheet, SHORTCUTS_KEY_LABEL } from "./ShortcutsSheet";
import { cn } from "@/lib/cn";
import { LOCALE_OPTIONS, useI18n } from "@/lib/i18n";
import type { ServerConnectionState } from "@/types/ogb";

const SECTIONS: Array<{ id: AppSettingsSection; label: string; icon: typeof User }> = [
  { id: "general", label: "General", icon: User },
  { id: "connections", label: "Connections", icon: KeyRound },
  { id: "engines", label: "Engines", icon: Terminal },
  { id: "companion", label: "Companion", icon: Smartphone },
  { id: "computer", label: "Local VM", icon: Monitor },
  { id: "voice", label: "Voice", icon: Volume2 },
  { id: "usage", label: "Usage", icon: Coins },
];

/** Name + email, persisted to /api/config {profile} on blur. */
function ProfileFields() {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [name, setName] = useState(state.config?.profile?.name ?? "");
  const [email, setEmail] = useState(state.config?.profile?.email ?? "");
  useEffect(() => {
    setName(state.config?.profile?.name ?? "");
    setEmail(state.config?.profile?.email ?? "");
  }, [state.config?.profile?.name, state.config?.profile?.email]);

  const save = () => {
    void fetch("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: { name: name.trim(), email: email.trim().toLowerCase() } }),
    })
      .then((r) => r.json())
      .then((config) => dispatch({ type: "configStatus", config }))
      .catch(() => {});
  };

  const inputClass =
    "w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[14px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none";
  return (
    <div className="flex flex-col gap-3">
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} placeholder={t("Your name")} className={inputClass} />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={save}
        placeholder="you@example.com"
        className={inputClass}
      />
    </div>
  );
}

function UpdatesRow() {
  const s = useUpdaterState();
  const { t } = useI18n();
  if (!window.ogb?.updater) return null;
  const updater = window.ogb.updater;
  const label =
    s?.status === "checking"
      ? t("Checking…")
      : s?.status === "available"
        ? t("{version} available", { version: s.version ?? "" })
        : s?.status === "downloading"
          ? t("Downloading {percent}%", { percent: Math.round(s.percent ?? 0) })
          : s?.status === "downloaded"
            ? t("{version} ready — restart to apply", { version: s.version ?? "" })
            : s?.status === "error"
              ? t("Check failed: {message}", { message: s.message ?? t("unknown error") })
              : t("You're on the latest version we know of.");
  return (
    <Card title={t("Updates")} subtitle={label}>
      <button
        onClick={() => {
          if (s?.status === "available") return void updater.download();
          if (s?.status === "downloaded") return void updater.install();
          void updater.check();
        }}
        disabled={s?.status === "checking" || s?.status === "downloading"}
        className="rounded-lg border border-hairline/40 px-3 py-1.5 text-[13px] text-ink hover:bg-raised disabled:opacity-40"
      >
        {s?.status === "available"
          ? t("Download")
          : s?.status === "downloaded"
            ? t("Restart and install")
            : t("Check for updates")}
      </button>
    </Card>
  );
}

function ShortcutsRow() {
  const { t } = useI18n();
  return (
    <Card
      title={t("Keyboard shortcuts")}
      subtitle={t("Every app-wide chord in one place.")}
    >
      <button
        onClick={openShortcutsSheet}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-hairline/40 px-3 py-2 text-left text-[13px] text-ink hover:bg-raised"
      >
        <span>{t("Show all shortcuts")}</span>
        <kbd className="rounded-md border border-hairline/50 bg-inset px-1.5 py-0.5 text-[11px] text-ink-secondary">
          {SHORTCUTS_KEY_LABEL}
        </kbd>
      </button>
    </Card>
  );
}

function ServerCard() {
  const { t } = useI18n();
  const [state, setState] = useState<ServerConnectionState | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"local" | "remote" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.ogb?.server) return;
    void window.ogb.server
      .get()
      .then((current) => {
        setState(current);
        setUrl(current.url ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (!window.ogb?.server) return null;

  const choose = async (mode: "local" | "remote") => {
    const bridge = window.ogb?.server;
    if (!bridge) return;
    setBusy(mode);
    setError(null);
    try {
      await bridge.set(mode === "remote" ? { mode, url } : { mode });
      // The main process relaunches after acknowledging; keep the button
      // busy so a second click cannot race the restart.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const remote = state?.mode === "remote";
  return (
    <Card
      title={t("Server")}
      subtitle={t("Run the agents on this computer, or connect this window to a KodBot server that stays on 24/7.")}
    >
      <div className="flex flex-col gap-3">
        {state?.fallback && (
          <div className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-[12.5px] text-warning">
            {t("Could not reach {url}. Using this computer until you fix the address.", { url: state.url ?? "" })}
          </div>
        )}
        <div className="rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[12.5px] text-ink-secondary">
          {state?.active === "remote"
            ? t("Using remote server {url}", { url: state.url ?? "" })
            : t("Using the server on this computer.")}
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.1.50:8799"
          spellCheck={false}
          className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 font-mono text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void choose("remote")}
            disabled={busy !== null || !url.trim() || (remote && !state?.fallback)}
            className="rounded-lg border border-hairline/40 px-3 py-1.5 text-[13px] text-ink hover:bg-raised disabled:opacity-40"
          >
            {busy === "remote" ? t("Connecting…") : t("Connect to remote server")}
          </button>
          <button
            onClick={() => void choose("local")}
            disabled={busy !== null || state?.mode === "local"}
            className="rounded-lg border border-hairline/40 px-3 py-1.5 text-[13px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
          >
            {busy === "local" ? t("Switching…") : t("Use this computer")}
          </button>
        </div>
        <div className="text-[11.5px] leading-relaxed text-ink-secondary">
          {t(
            "The remote machine must be reachable over your LAN or Tailscale and must be running KodBot. Keys, engines, and the companion stay on that machine. The app will restart when you switch.",
          )}
        </div>
        {error && <div className="text-[12.5px] text-danger">{error}</div>}
      </div>
    </Card>
  );
}

function LanguageCard() {
  const { locale, setLocale, t } = useI18n();
  return (
    <Card title={t("Language")} subtitle={t("Choose the language for the app. Changes apply immediately.")}>
      <div className="grid grid-cols-2 gap-2">
        {LOCALE_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => setLocale(option.id)}
            aria-pressed={locale === option.id}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-[14px] transition-colors",
              locale === option.id
                ? "border-accent/50 bg-accent/10 text-ink"
                : "border-hairline/40 text-ink-secondary hover:bg-raised/60 hover:text-ink",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              {option.label}
              {locale === option.id && <span className="text-accent">✓</span>}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2 text-[12px] text-ink-secondary">{t("More languages can be added later.")}</div>
    </Card>
  );
}

export function SettingsModal() {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const section = state.appSettingsSection;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dispatch({ type: "toggleAppSettings", open: false });
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [dispatch]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && dispatch({ type: "toggleAppSettings", open: false })}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-settings-title"
        tabIndex={-1}
        className="flex h-[560px] w-full max-w-[860px] overflow-hidden rounded-2xl border border-hairline/50 bg-panel shadow-2xl outline-none"
      >
        {/* section nav */}
        <nav className="flex w-[190px] shrink-0 flex-col gap-0.5 border-r border-hairline/40 p-3">
          <div id="app-settings-title" className="px-2 pb-2 pt-1 text-[15px] font-semibold text-ink">
            {t("Settings")}
          </div>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => dispatch({ type: "toggleAppSettings", open: true, section: id })}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px]",
                section === id ? "bg-raised text-ink" : "text-ink-secondary hover:bg-raised/50 hover:text-ink",
              )}
            >
              <Icon size={15} />
              {t(label)}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-[15px] font-semibold text-ink">
              {t(SECTIONS.find((s) => s.id === section)?.label ?? "")}
            </span>
            <button
              onClick={() => dispatch({ type: "toggleAppSettings", open: false })}
              aria-label={t("Close settings")}
              className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
            {section === "general" && (
              <>
                <Card title={t("Profile")} subtitle={t("Shown in the sidebar. Saved as you go.")}>
                  <ProfileFields />
                </Card>
                <ServerCard />
                <ShortcutsRow />
                <LanguageCard />
                <UpdatesRow />
              </>
            )}

            {section === "connections" && (
              <Card
                title={t("Connections")}
                subtitle={t("Connections subtitle")}
              >
                <div className="flex flex-col gap-4">
                  {state.config?.composio.mode === "managed" ? (
                    <div className="rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-[13px] text-success">
                      {t("Connected apps service is ready")}
                    </div>
                  ) : null}
                  <ApiKeyRow section="box" />
                  <ApiKeyRow section="opencodeGo" />
                  <details className="rounded-lg border border-hairline/40 bg-inset px-3 py-2">
                    <summary className="cursor-pointer text-[13px] text-ink-secondary">{t("Self-host connected apps")}</summary>
                    <div className="mt-3">
                      <ApiKeyRow section="composio" />
                    </div>
                  </details>
                </div>
              </Card>
            )}

            {section === "engines" && (
              <Card title={t("Engine CLIs")} subtitle={t("Which binary each engine runs. Saved as you go.")}>
                <EnginesSettings />
              </Card>
            )}

            {section === "companion" && <CompanionSection />}

            {section === "voice" && <VoiceSettings />}

            {section === "computer" && <LocalComputerSection />}

            {section === "usage" && <UsageSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
