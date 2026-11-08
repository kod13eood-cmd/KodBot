import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n";

export interface ConnectionNameDialogProps {
  open: boolean;
  service: string;
  initial?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}

/** Ask for the account label before OAuth starts. Composio uses the alias to
 * tell a second Gmail/Slack/... account apart from the first, and the name is
 * what the Connected apps rows show afterwards. */
export function ConnectionNameDialog({
  open,
  service,
  initial = "",
  busy = false,
  onCancel,
  onConfirm,
}: ConnectionNameDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  const trimmed = name.trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-name-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed && !busy) onConfirm(trimmed);
        }}
        className="animate-pop-in w-full max-w-[420px] rounded-2xl border border-hairline/50 bg-panel p-5 shadow-2xl shadow-black/50"
      >
        <h2 id="connection-name-title" className="text-[17px] font-semibold text-ink">
          {t("Name this connection")}
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
          {t("Give this {service} connection a name you will recognize. It appears in Connected apps and in each bot's access list.", {
            service,
          })}
        </p>
        <label className="mt-4 block">
          <span className="sr-only">{t("Connection name")}</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder={t("e.g. Work {service}", { service })}
            className="w-full rounded-xl border border-hairline/60 bg-inset px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-secondary focus:border-accent/60 focus:outline-none"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-3.5 py-2 text-[13px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={!trimmed || busy}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {t("Continue to sign in")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
