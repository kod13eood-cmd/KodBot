// The in-app user guide. The content lives in lib/guide.ts so the same
// bilingual sections can be exported to docs/USER-GUIDE.md.
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";

import { GUIDE_SECTIONS, type GuideLocale } from "@/lib/guide";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { useStore } from "@/state/store";
import { ChatMarkdown } from "./ChatMarkdown";

const LOCALES: Array<{ id: GuideLocale; label: string }> = [
  { id: "en", label: "English" },
  { id: "bg", label: "Български" },
];

export function HelpPanel() {
  const { dispatch } = useStore();
  const { t, locale } = useI18n();
  const [guideLocale, setGuideLocale] = useState<GuideLocale>(locale);
  const [active, setActive] = useState(GUIDE_SECTIONS[0]!.id);
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => setGuideLocale(locale), [locale]);

  // Switching topics should start at the top; otherwise a long section
  // leaves the next one scrolled into its middle.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [active, guideLocale]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dispatch({ type: "toggleHelp", open: false });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [dispatch]);

  const section = useMemo(
    () => GUIDE_SECTIONS.find((entry) => entry.id === active) ?? GUIDE_SECTIONS[0]!,
    [active],
  );

  const localeSwitch = (
    <div className="flex items-center gap-1 rounded-lg bg-inset p-0.5">
      {LOCALES.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setGuideLocale(option.id)}
          aria-pressed={guideLocale === option.id}
          className={cn(
            "rounded-md px-2 py-1 text-[11.5px]",
            guideLocale === option.id ? "bg-raised text-ink shadow" : "text-ink-secondary hover:text-ink",
          )}
        >
          {option.id.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dispatch({ type: "toggleHelp", open: false });
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("Help and guide")}
        tabIndex={-1}
        className="flex h-[min(820px,92vh)] w-full max-w-[1040px] overflow-hidden rounded-2xl border border-hairline/60 bg-panel shadow-2xl shadow-black/60 outline-none"
      >
        <nav className="flex w-[250px] shrink-0 flex-col border-r border-hairline/40 p-3 max-md:hidden">
          <div className="flex items-center gap-2 px-2 pb-2 pt-1">
            <BookOpen size={16} className="text-accent" />
            <span className="text-[14px] font-semibold text-ink">{t("KodBot guide")}</span>
          </div>
          {localeSwitch}
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {GUIDE_SECTIONS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setActive(entry.id)}
                aria-current={active === entry.id ? "page" : undefined}
                className={cn(
                  "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px]",
                  active === entry.id
                    ? "bg-raised text-ink"
                    : "text-ink-secondary hover:bg-raised/50 hover:text-ink",
                )}
              >
                {entry.title[guideLocale]}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-hairline/40 px-5 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <BookOpen size={16} className="shrink-0 text-accent md:hidden" />
              <span className="truncate text-[15px] font-semibold text-ink">
                {section.title[guideLocale]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={active}
                onChange={(event) => setActive(event.target.value)}
                aria-label={t("Guide topic")}
                className="max-w-[180px] rounded-lg border border-hairline/40 bg-inset px-2 py-1.5 text-[12px] text-ink outline-none md:hidden"
              >
                {GUIDE_SECTIONS.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.title[guideLocale]}</option>
                ))}
              </select>
              <span className="md:hidden">{localeSwitch}</span>
              <button
                type="button"
                onClick={() => dispatch({ type: "toggleHelp", open: false })}
                aria-label={t("Close")}
                title={t("Close")}
                className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <ChatMarkdown text={section.body[guideLocale]} />
          </div>
        </div>
      </div>
    </div>
  );
}
