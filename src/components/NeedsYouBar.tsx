import { Bell } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import type { NeedsYouItem } from "@/lib/needs-you";
import { useStore } from "@/state/store";

/** A persistent strip while any bot or room cannot continue without a human.
 * It stays until the request is answered — dismissing it would recreate the
 * exact problem the app had: a blocked bot nobody notices. */
export function NeedsYouBar({ items }: { items: NeedsYouItem[] }) {
  const { dispatch } = useStore();
  const { t } = useI18n();
  if (items.length === 0) return null;
  const first = items[0]!;
  const reason =
    first.reason === "approval"
      ? t("needs approval")
      : first.reason === "question"
        ? t("has a question")
        : first.reason === "routine-failed"
          ? t("has a failed scheduled run")
          : first.reason === "routine-missed"
            ? t("missed a scheduled run")
            : t("is waiting for you");

  return (
    <div
      role="status"
      className="animate-panel-in fixed left-1/2 top-2 z-40 flex max-w-[calc(100vw-160px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-warning/40 bg-panel/95 px-3.5 py-2 shadow-2xl shadow-black/50 backdrop-blur"
    >
      <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
        <Bell size={15} />
        <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-warning" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
        <strong className="font-semibold">{first.name}</strong> {reason}
        {first.kind === "routine" && first.detail && <span className="text-ink-secondary"> · {first.detail}</span>}
        {items.length > 1 && <span className="text-ink-secondary"> · +{items.length - 1}</span>}
      </span>
      <button
        type="button"
        onClick={() => {
          if (first.kind === "routine") {
            dispatch({ type: "markRoutineRunSeen", runId: first.id });
            dispatch({ type: "showRoutines" });
          } else {
            dispatch({ type: "select", id: first.id });
          }
        }}
        className="shrink-0 rounded-lg bg-warning/15 px-3 py-1.5 text-[12.5px] font-medium text-warning hover:bg-warning/25"
      >
        {t("Open")}
      </button>
    </div>
  );
}
