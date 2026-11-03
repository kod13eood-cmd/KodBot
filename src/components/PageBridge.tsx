import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";

import { copyText } from "@/lib/clipboard";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/state/store";
import { downloadPageText, installPageBridge } from "@/lib/page-bridge";

type CopyStatus = "idle" | "copied" | "blocked";

/** App-level listener for sandboxed bot pages. A page cannot reach the
 * clipboard or start a download itself, so it posts a request and this
 * component completes it outside the sandbox — on the user's click, with a
 * real top-level dialog. Rendered once, outside the chat.
 *
 * The dialog deliberately does not report success until the browser confirms
 * the write; when it refuses, the text is still selected for a manual copy. */
export function PageBridge() {
  const { t } = useI18n();
  const { dispatch } = useStore();
  const [copyTextValue, setCopyTextValue] = useState<string | null>(null);
  const [status, setStatus] = useState<CopyStatus>("idle");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return installPageBridge(
      {
        onCopy: (text) => {
          setStatus("idle");
          setCopyTextValue(text);
        },
        onDownload: (filename, text) => downloadPageText(filename, text),
        onSend: (text, botId) => {
          // Zero-copy path: answers typed into a page go straight to that
          // bot's conversation. This is an explicit submission, not a draft:
          // the server's steer-queue holds it if the bot is mid-turn, and the
          // page closes itself right after.
          dispatch({ type: "send", botId, text });
        },
        onClose: (botId) => {
          // PageArtifactCard owns the viewer; a page message cannot close a
          // React portal directly, so announce it on the window.
          window.dispatchEvent(new CustomEvent("kodbot:page-close", { detail: { botId } }));
        },
      },
      document,
      window,
    );
  }, []);

  const close = useCallback(() => {
    setCopyTextValue(null);
    setStatus("idle");
    const previous = returnFocusRef.current;
    returnFocusRef.current = null;
    previous?.focus();
  }, []);

  useLayoutEffect(() => {
    if (copyTextValue === null) return;
    if (!returnFocusRef.current) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    areaRef.current?.focus();
    areaRef.current?.select();
  }, [copyTextValue]);

  useEffect(() => {
    if (copyTextValue === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copyTextValue, close]);

  if (copyTextValue === null) return null;

  const copy = async () => {
    const ok = await copyText(copyTextValue);
    setStatus(ok ? "copied" : "blocked");
    if (!ok) {
      areaRef.current?.focus();
      areaRef.current?.select();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-bridge-title"
        aria-describedby="page-bridge-hint"
        className="flex max-h-[min(680px,90vh)] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-hairline/60 bg-panel shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-hairline/40 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="page-bridge-title" className="text-[14px] font-semibold text-ink">
              {t("Copy from page")}
            </h2>
            <p id="page-bridge-hint" className="mt-0.5 text-[12px] text-ink-secondary">
              {t("The page asked to put this text on your clipboard.")}
            </p>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"
            aria-label={t("Close")}
            title={t("Close")}
          >
            <X size={17} />
          </button>
        </header>

        <div className="min-h-0 flex-1 p-4">
          <textarea
            ref={areaRef}
            readOnly
            value={copyTextValue}
            aria-label={t("Text from page")}
            spellCheck={false}
            className="h-[min(360px,50vh)] w-full resize-none rounded-xl border border-hairline/50 bg-inset p-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-hairline/40 px-4 py-3">
          <button
            onClick={() => void copy()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90"
          >
            {status === "copied" ? <Check size={14} /> : <Copy size={14} />}
            {status === "copied" ? t("Copied") : t("Copy")}
          </button>
          <button
            onClick={() => {
              areaRef.current?.focus();
              areaRef.current?.select();
            }}
            className="rounded-lg px-3 py-1.5 text-[12.5px] text-ink-secondary hover:bg-raised hover:text-ink"
          >
            {t("Select all")}
          </button>
          <span
            role="status"
            aria-live="polite"
            className="min-w-0 flex-1 text-[12px] text-ink-secondary"
          >
            {status === "blocked"
              ? t("The browser blocked the clipboard. The text is selected — press Ctrl+C or ⌘C.")
              : null}
          </span>
          <button
            onClick={close}
            className="ml-auto rounded-lg px-3 py-1.5 text-[12.5px] text-ink-secondary hover:bg-raised hover:text-ink"
          >
            {t("Close")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
