// First-run choice: run the harness here, or point this window at a server on
// another machine. It has to happen before onboarding because local mode wants
// to inspect this computer's engines, while remote mode must inspect the
// server's engines instead.
import { useState, type FormEvent } from "react";
import { ArrowRight, Cloud, Loader2, Monitor, Server } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { normalizeRemoteAddress } from "@/lib/server-choice";

export function ServerSetupWizard({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const bridge = window.ogb?.server;
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"local" | "remote" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseLocal = async () => {
    if (!bridge || busy) return;
    setBusy("local");
    setError(null);
    try {
      await bridge.set({ mode: "local" });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(null);
    }
  };

  const chooseRemote = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!bridge || busy) return;
    const address = normalizeRemoteAddress(url);
    if (!address) {
      setError(t("Enter the remote server address."));
      return;
    }
    try {
      const parsed = new URL(address);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("scheme");
      }
    } catch {
      setError(
        t("Enter an address like https://kodbot.example.com or http://192.168.1.50:8799."),
      );
      return;
    }
    setBusy("remote");
    setError(null);
    try {
      await bridge.set({ mode: "remote", url: address });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-app p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Server size={22} />
          </div>
          <h1 className="mt-4 text-[24px] font-semibold tracking-tight text-ink">
            {t("Where should your bots run?")}
          </h1>
          <p className="mx-auto mt-2 max-w-[540px] text-[13px] leading-relaxed text-ink-secondary">
            {t("Choose now. You can change this later in App Settings → General → Server.")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex flex-col rounded-2xl border border-hairline/40 bg-panel p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-raised text-ink-secondary">
              <Monitor size={18} />
            </div>
            <h2 className="mt-3 text-[16px] font-semibold text-ink">{t("Create a local server")}</h2>
            <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-ink-secondary">
              {t(
                "KodBot and the agents run on this computer. The server is built in; install the agent CLIs you want here. Best for one machine.",
              )}
            </p>
            <button
              type="button"
              onClick={() => void chooseLocal()}
              disabled={busy !== null}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-[12.5px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {busy === "local" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowRight size={14} />
              )}
              {busy === "local" ? t("Creating the local server…") : t("Use this computer")}
            </button>
          </section>

          <form
            onSubmit={(event) => void chooseRemote(event)}
            className="flex flex-col rounded-2xl border border-hairline/40 bg-panel p-5"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-raised text-ink-secondary">
              <Cloud size={18} />
            </div>
            <h2 className="mt-3 text-[16px] font-semibold text-ink">
              {t("Connect to a remote server")}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">
              {t(
                "Use KodBot on another computer or a cloud VM. Bots, engines, keys, files and memory stay there. This computer only needs network access.",
              )}
            </p>
            <label className="mt-4 block text-[11.5px] font-medium text-ink-secondary" htmlFor="remote-server-url">
              {t("Remote server address")}
            </label>
            <input
              id="remote-server-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://kodbot.example.com"
              spellCheck={false}
              inputMode="url"
              autoComplete="url"
              disabled={busy !== null}
              className="mt-1.5 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 font-mono text-[12.5px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy !== null || !url.trim()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-hairline/40 px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-raised disabled:opacity-40"
            >
              {busy === "remote" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowRight size={14} />
              )}
              {busy === "remote" ? t("Connecting…") : t("Connect")}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary/70">
              {t("The remote machine must already be running KodBot.")}
            </p>
            {error && (
              <p role="alert" className="mt-2 text-[11.5px] leading-relaxed text-danger">
                {error}
              </p>
            )}
          </form>
        </div>

        <p className="mx-auto mt-5 max-w-[620px] text-center text-[11.5px] leading-relaxed text-ink-secondary/80">
          {t(
            "The server runs on Linux, Windows and macOS. A remote server can be a cloud VM or a machine on your LAN/Tailscale. Use the harness port 8799 (not the phone companion port 8810); HTTPS is best.",
          )}
        </p>
      </div>
    </div>
  );
}
