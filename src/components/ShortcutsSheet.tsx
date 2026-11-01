// Keyboard shortcuts sheet: the discoverable home of every app-wide chord.
// Self-contained like CommandPalette — it owns the ⌘/ chord and its open
// state, so App.tsx only mounts it.
import { useEffect, useRef, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// The sheet is a browser-only component; no SSR path exists in this app.
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const MOD = isMac ? "⌘" : "Ctrl";
const SHIFT = isMac ? "⇧" : "Shift";
export const SHORTCUTS_KEY_LABEL = `${MOD}+/`;

const OPEN_EVENT = "kodbot:open-shortcuts";

/** Open the sheet from a visible affordance (Settings) as well as the chord. */
export function openShortcutsSheet() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

interface Shortcut {
  keys: string[];
  label: string;
}

function Keycaps({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden>
      {keys.map((key, index) => (
        <span key={`${key}:${index}`} className="flex items-center gap-1">
          {index > 0 && <span className="text-[10px] text-ink-secondary/60">+</span>}
          <kbd className="min-w-[22px] rounded-md border border-hairline/50 bg-inset px-1.5 py-0.5 text-center font-sans text-[11px] leading-4 text-ink-secondary">
            {key}
          </kbd>
        </span>
      ))}
    </span>
  );
}

export function ShortcutsSheet() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // ⌘/ (or Ctrl+/) from anywhere. A modifier chord never collides with
  // typing, matching the palette's ⌘K handling. Settings also dispatches an
  // event so the list is discoverable without knowing the chord first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const slash = event.key === "/" || event.code === "Slash";
      if (mod && slash && !event.altKey) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Return focus to whatever opened the sheet. Tab containment lives in the
  // dialog's own key handler: it stops propagation so the settings dialog's
  // window-level trap cannot steal focus from underneath this one.
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => previousFocus?.focus();
  }, [open]);

  if (!open) return null;

  const groups: Array<{ title: string; shortcuts: Shortcut[] }> = [
    {
      title: t("Navigation"),
      shortcuts: [
        { keys: [MOD, "K"], label: t("Command palette") },
        { keys: [MOD, "N"], label: t("New Bot") },
        { keys: [MOD, "1–9"], label: t("Jump to a bot") },
        { keys: [MOD, SHIFT, "["], label: t("Previous bot") },
        { keys: [MOD, SHIFT, "]"], label: t("Next bot") },
        { keys: [MOD, "/"], label: t("Keyboard shortcuts") },
      ],
    },
    {
      title: t("Chat"),
      shortcuts: [
        { keys: ["Enter"], label: t("Send message") },
        { keys: [SHIFT, "Enter"], label: t("New line") },
        { keys: ["↑"], label: t("Edit last message when the box is empty") },
        { keys: [MOD, "Enter"], label: t("Send a room bulletin") },
        { keys: ["Esc"], label: t("Close a panel or dialog") },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
      onKeyDown={(event) => {
        // The sheet sits above settings/plugins. Contain every key here so
        // their window-level focus traps and Esc handlers cannot also fire:
        // Shift+Tab would otherwise jump back into the dialog underneath.
        event.stopPropagation();

        // The window-level chord cannot run here because this handler stops
        // propagation; keep ⌘/ as a toggle while the sheet is focused.
        const mod = event.metaKey || event.ctrlKey;
        if (mod && (event.key === "/" || event.code === "Slash") && !event.altKey) {
          event.preventDefault();
          setOpen(false);
          return;
        }

        if (event.key === "Tab") {
          const dialog = dialogRef.current;
          if (!dialog) return;
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
          return;
        }

        if (event.key !== "Escape") return;
        event.preventDefault();
        setOpen(false);
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        tabIndex={-1}
        className="flex max-h-[min(680px,86vh)] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-hairline/50 bg-panel shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline/40 px-5 py-4">
          <div className="flex items-start gap-3">
            <Keyboard size={19} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <h2 id="shortcuts-title" className="text-[16px] font-semibold text-ink">
                {t("Keyboard shortcuts")}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-secondary">
                {t("Work faster with the keyboard. These shortcuts work anywhere in KodBot.")}
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label={t("Close keyboard shortcuts")}
            className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {groups.map((group) => (
            <section key={group.title} className="mb-4 last:mb-0">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
                {group.title}
              </div>
              <div className="overflow-hidden rounded-xl border border-hairline/40">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between gap-4 border-b border-hairline/40 px-3 py-2 last:border-b-0"
                  >
                    <span className="text-[13px] text-ink">{shortcut.label}</span>
                    <Keycaps keys={shortcut.keys} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-hairline/40 px-5 py-3">
          <span className="text-[11.5px] text-ink-secondary">{t("Press Esc to close")}</span>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg bg-raised px-3 py-1.5 text-[12px] text-ink hover:bg-raised-hover"
          >
            {t("Close")}
          </button>
        </footer>
      </div>
    </div>
  );
}
