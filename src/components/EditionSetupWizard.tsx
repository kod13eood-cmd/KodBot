// First-run edition choice: KodBot Solo on this computer, or KodBot Business
// connected to an organization's server. The desktop main process owns the
// local/remote connection; a loopback browser gets the same choice and
// remembers Solo locally. Business always goes through the organization's
// normal login page — this screen never handles credentials.
import { useState, type FormEvent } from "react";
import { ArrowRight, Building2, Loader2, Lock, Monitor } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { rememberSoloEdition } from "@/lib/edition";
import { normalizeRemoteAddress } from "@/lib/server-choice";

export function EditionSetupWizard({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const bridge = window.ogb?.server;
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"solo" | "business" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseSolo = async () => {
    if (busy) return;
    setError(null);
    if (!bridge) {
      rememberSoloEdition();
      onDone();
      return;
    }
    setBusy("solo");
    try {
      await bridge.set({ mode: "local" });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(null);
    }
  };

  const chooseBusiness = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    const address = normalizeRemoteAddress(url);
    if (!address) {
      setError(t("Enter the organization server address."));
      return;
    }
    try {
      const parsed = new URL(address);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("scheme");
      }
    } catch {
      setError(
        t("Enter an address like https://kodbot.example.com or http://192.168.1.50:8780."),
      );
      return;
    }
    setBusy("business");
    setError(null);
    if (!bridge) {
      // The organization's gateway owns the sign-in page; this window simply
      // moves there. A personal harness without accounts lands in Solo.
      window.location.assign(address);
      return;
    }
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
            <Building2 size={22} />
          </div>
          <h1 className="mt-4 text-[24px] font-semibold tracking-tight text-ink">
            {t("How will you use KodBot?")}
          </h1>
          <p className="mx-auto mt-2 max-w-[560px] text-[13px] leading-relaxed text-ink-secondary">
            {t("Choose now. You can change this later in App Settings → General → Usage mode.")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex flex-col rounded-2xl border border-hairline/40 bg-panel p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-raised text-ink-secondary">
              <Monitor size={18} />
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="text-[17px] font-semibold text-ink">{t("KodBot Solo")}</h2>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-medium text-success">
                {t("Free")}
              </span>
            </div>
            <div className="mt-0.5 text-[12px] font-medium text-ink-secondary">
              {t("Local, private, no account.")}
            </div>
            <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-ink-secondary">
              {t(
                "Everything stays on this computer: bots, conversations, memory, files, and keys. KodBot runs its own server here.",
              )}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-secondary/80">
              <Lock size={12} />
              {t("Your keys never leave this machine.")}
            </div>
            <button
              type="button"
              onClick={() => void chooseSolo()}
              disabled={busy !== null}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-[12.5px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {busy === "solo" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowRight size={14} />
              )}
              {busy === "solo" ? t("Preparing this computer…") : t("Use this computer")}
            </button>
          </section>

          <form
            onSubmit={(event) => void chooseBusiness(event)}
            className="flex flex-col rounded-2xl border border-hairline/40 bg-panel p-5"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-raised text-ink-secondary">
              <Building2 size={18} />
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="text-[17px] font-semibold text-ink">{t("KodBot Business")}</h2>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] font-medium text-accent">
                {t("For organizations")}
              </span>
            </div>
            <div className="mt-0.5 text-[12px] font-medium text-ink-secondary">
              {t("Accounts, invitations, administration.")}
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">
              {t(
                "Connect to your organization's KodBot server and sign in with your browser. Your bots, keys, and memory stay in your own workspace on that server.",
              )}
            </p>
            <label className="mt-4 block text-[11.5px] font-medium text-ink-secondary" htmlFor="organization-server-url">
              {t("Organization server address")}
            </label>
            <input
              id="organization-server-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://kodbot.example.com:8780"
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
              {busy === "business" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowRight size={14} />
              )}
              {busy === "business" ? t("Connecting…") : t("Continue to sign-in")}
            </button>
            {error && (
              <p role="alert" className="mt-2 text-[11.5px] leading-relaxed text-danger">
                {error}
              </p>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary/70">
              {t(
                "The server must already be running KodBot Business. A personal server without accounts keeps you in Solo.",
              )}
            </p>
          </form>
        </div>

        <p className="mx-auto mt-5 max-w-[620px] text-center text-[11.5px] leading-relaxed text-ink-secondary/80">
          {t(
            "KodBot Solo is free and open source. KodBot Business is the same app connected to your organization's server, with accounts and administration.",
          )}
        </p>
      </div>
    </div>
  );
}
