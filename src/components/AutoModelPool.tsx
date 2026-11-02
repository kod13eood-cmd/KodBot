import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { useStore, type Bot, type ModelSelection } from "@/state/store";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import { ProviderMark } from "./ProviderIcons";
import { ModelCapabilityIcons } from "./ModelCapabilityIcons";

const SEP = "\u0000";
const keyOf = (instanceId: string, model: string) => `${instanceId}${SEP}${model}`;

/** Pick exactly which models Auto mode may route between. Selecting models
 * from more than one engine is an explicit consent boundary: only this list
 * is ever considered. */
export function AutoModelPool({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((bot.autoModelPool ?? []).map((entry) => keyOf(entry.instanceId, entry.model))),
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const instances = useMemo(
    () =>
      state.instances.filter(
        (instance) =>
          instance.snapshot.state === "available" &&
          instance.snapshot.authenticated !== false &&
          instance.models.options.length > 0,
      ),
    [state.instances],
  );

  const needle = query.trim().toLowerCase();
  const visible = instances.flatMap((instance) => {
    const filtered = instance.models.options.filter(
      (option) =>
        !needle ||
        `${option.label} ${option.id} ${instance.displayName} ${option.group ?? ""}`.toLowerCase().includes(needle),
    );
    const groups = new Map<string, typeof filtered>();
    for (const option of filtered) {
      const group = option.group ?? "";
      const bucket = groups.get(group) ?? [];
      bucket.push(option);
      groups.set(group, bucket);
    }
    return [...groups.entries()].map(([group, options]) => ({ instance, group, options }));
  });

  const toggle = (instanceId: string, model: string) => {
    const key = keyOf(instanceId, model);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleInstance = (instanceId: string, models: string[], allSelected: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const model of models) {
        const key = keyOf(instanceId, model);
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  };

  const save = () => {
    const pool: ModelSelection[] = [];
    for (const instance of instances) {
      for (const option of instance.models.options) {
        if (selected.has(keyOf(instance.instanceId, option.id))) {
          pool.push({ instanceId: instance.instanceId, model: option.id });
        }
      }
    }
    dispatch({
      type: "updateBot",
      botId: bot.id,
      patch: { autoModel: true, autoModelPool: pool },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-pool-title"
        tabIndex={-1}
        className="flex max-h-[min(760px,90vh)] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-hairline/60 bg-panel shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline/40 px-5 py-4">
          <div>
            <h2 id="auto-pool-title" className="text-[16px] font-semibold text-ink">
              {t("Auto model pool")}
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
              {t("Choose which models Auto mode may use. Only this list is considered; nothing else is sent to another provider.")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="border-b border-hairline/40 px-5 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 focus-within:border-accent/60">
            <Search size={13} className="shrink-0 text-ink-secondary" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Search models")}
              aria-label={t("Search models")}
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink placeholder:text-ink-secondary focus:outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {visible.length === 0 && (
            <div className="py-10 text-center text-[13px] text-ink-secondary">
              {t("No available models. Install or sign in to an engine first.")}
            </div>
          )}
          {visible.map(({ instance, group, options }) => {
            const allSelected = options.every((option) => selected.has(keyOf(instance.instanceId, option.id)));
            return (
              <section key={`${instance.instanceId}:${group}`} className="mb-3 last:mb-0">
                <div className="mb-1.5 flex items-center gap-2 px-1">
                  <ProviderMark driverKind={instance.driverKind} size={15} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                    {group ? `${instance.displayName} · ${group}` : instance.displayName}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleInstance(instance.instanceId, options.map((option) => option.id), allSelected)}
                    className="rounded px-1.5 py-0.5 text-[10.5px] text-ink-secondary hover:bg-raised hover:text-ink"
                  >
                    {allSelected ? t("Clear") : t("All")}
                  </button>
                </div>
                <div className="overflow-hidden rounded-xl border border-hairline/40">
                  {options.map((option) => {
                    const checked = selected.has(keyOf(instance.instanceId, option.id));
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggle(instance.instanceId, option.id)}
                        className={cn(
                          "flex w-full items-center gap-2 border-b border-hairline/40 px-3 py-2 text-left last:border-b-0",
                          checked ? "bg-accent/5" : "hover:bg-raised/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            checked ? "border-accent bg-accent text-white" : "border-hairline/60",
                          )}
                        >
                          {checked && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{option.label}</span>
                        <ModelCapabilityIcons option={option} />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline/40 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "updateBot", botId: bot.id, patch: { autoModel: true, autoModelPool: [] } });
              onClose();
            }}
            className="rounded-lg px-2.5 py-1.5 text-[11.5px] text-ink-secondary hover:bg-raised hover:text-ink"
          >
            {t("Use current engine only")}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-ink-secondary">
              {t("{count} selected", { count: selected.size })}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-[12.5px] text-ink-secondary hover:bg-raised hover:text-ink"
            >
              {t("Cancel")}
            </button>
            <button
              onClick={save}
              className="rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white hover:brightness-110"
            >
              {t("Save pool")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
