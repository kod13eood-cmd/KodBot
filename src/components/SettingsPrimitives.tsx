import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { useI18n } from "@/lib/i18n";

export function Card({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl bg-card p-4">
      {title && <div className="text-[15px] font-medium text-ink">{t(title)}</div>}
      {subtitle && <div className={title ? "mt-0.5 text-[13px] leading-relaxed text-ink-secondary" : "text-[13px] leading-relaxed text-ink-secondary"}>{t(subtitle)}</div>}
      {children && <div className={title || subtitle ? "mt-4" : undefined}>{children}</div>}
    </div>
  );
}

/** A command the user is meant to run, with one-click copy. */
export function CommandLine({ command }: { command: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const copy = async () => {
    if (!(await copyText(command))) return;
    setCopied(true);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-inset px-3 py-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px] text-ink">
        {command}
      </code>
      <button
        onClick={() => void copy()}
        aria-label={t("Copy command")}
        className="shrink-0 rounded p-1 text-ink-secondary hover:bg-raised hover:text-ink"
      >
        {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      </button>
    </div>
  );
}
