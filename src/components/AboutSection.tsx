// Settings → About: the version of everything actually running. The harness
// version comes from /api/about (injected at build time); the desktop shell
// reports its own version and Chromium/Node through the preload bridge.
import { useEffect, useState } from "react";
import { Terminal } from "lucide-react";

import { api, useStore } from "@/state/store";
import { useI18n } from "@/lib/i18n";
import { Card } from "./SettingsPrimitives";

interface AboutInfo {
  app: string;
  version: string;
  node: string;
  platform: string;
  arch: string;
  speech: {
    stt: string;
    sttInstalled: boolean;
    tts: string;
    ttsReady: boolean;
    voice: string;
    language: string;
  };
}

interface DesktopAbout {
  version: string;
  electron: string | null;
  chromium: string | null;
  node: string | null;
  platform: string;
  arch: string;
}

function VersionRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline/30 py-1.5 last:border-b-0">
      <span className="shrink-0 text-[12.5px] text-ink-secondary">{label}</span>
      <span
        className="min-w-0 truncate text-right font-mono text-[11.5px] text-ink"
        title={title ?? value}
      >
        {value}
      </span>
    </div>
  );
}

export function AboutSection() {
  const { state } = useStore();
  const { t } = useI18n();
  const [server, setServer] = useState<AboutInfo | null>(null);
  const [desktop, setDesktop] = useState<DesktopAbout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void api("/api/about")
      .then((info) => {
        if (alive) setServer(info as AboutInfo);
      })
      .catch((failure) => {
        if (alive) setError(failure instanceof Error ? failure.message : String(failure));
      });
    const bridge = window.ogb?.about;
    if (bridge) {
      void bridge()
        .then((info) => {
          if (alive) setDesktop(info);
        })
        .catch(() => {
          /* a browser or an older shell simply has no desktop card */
        });
    }
    return () => {
      alive = false;
    };
  }, []);

  const engines = state.instances
    .filter((instance) => instance.snapshot.state === "available")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const versionMismatch = Boolean(server && desktop && server.version !== desktop.version);
  const ttsLabel =
    server?.speech.tts === "local"
      ? "Piper (local)"
      : server?.speech.tts === "elevenlabs"
        ? "ElevenLabs"
        : (server?.speech.tts ?? "—");

  return (
    <>
      <Card title={t("KodBot")} subtitle={t("Local-first agent harness")}>
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-semibold tracking-tight text-ink">
            v{server?.version ?? "…"}
          </span>
          <span className="text-[12px] text-ink-secondary">{t("Server")}</span>
        </div>
        {versionMismatch && (
          <div className="mt-3 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-[12px] text-warning">
            {t("Desktop and server versions differ.")}
          </div>
        )}
        {error && <div className="mt-2 text-[12px] text-danger">{error}</div>}
        {server && (
          <div className="mt-3">
            <VersionRow label="Node" value={server.node} />
            <VersionRow label={t("Platform")} value={`${server.platform} · ${server.arch}`} />
          </div>
        )}
      </Card>

      {desktop && (
        <Card title={t("Desktop app")} subtitle={t("The Electron shell around this window.")}>
          <VersionRow label={t("Version")} value={`v${desktop.version}`} />
          <VersionRow label="Electron" value={desktop.electron ?? "—"} />
          <VersionRow label="Chromium" value={desktop.chromium ?? "—"} />
          <VersionRow label="Node" value={desktop.node ?? "—"} />
        </Card>
      )}

      <Card title={t("External engines")} subtitle={t("Agent CLIs this harness can run.")}>
        {engines.length === 0 ? (
          <div className="text-[12.5px] text-ink-secondary">{t("No engine CLIs detected.")}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {engines.map((instance) => (
              <div key={instance.instanceId} className="flex items-center gap-2.5">
                <Terminal size={14} className="shrink-0 text-ink-secondary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-ink">{instance.displayName}</div>
                  <div className="truncate font-mono text-[10.5px] text-ink-secondary/70">
                    {instance.driverKind}
                  </div>
                </div>
                <div
                  className="max-w-[55%] truncate text-right font-mono text-[11px] text-ink-secondary"
                  title={instance.snapshot.version ?? undefined}
                >
                  {instance.snapshot.version || t("Version unknown")}
                  {instance.snapshot.authenticated === false ? ` · ${t("not signed in")}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {server && (
        <Card
          title={t("Voice")}
          subtitle={t("Local speech components used by the composer and voice notes.")}
        >
          <VersionRow
            label={t("Speech to text")}
            value={`${server.speech.stt} · ${server.speech.sttInstalled ? t("Installed") : t("Not installed")}`}
          />
          <VersionRow
            label={t("Text to speech")}
            value={`${ttsLabel} · ${server.speech.ttsReady ? t("Installed") : t("Not installed")}`}
          />
          {server.speech.voice && <VersionRow label={t("Voice")} value={server.speech.voice} />}
          {server.speech.language && (
            <VersionRow label={t("Language")} value={server.speech.language} />
          )}
        </Card>
      )}
    </>
  );
}
