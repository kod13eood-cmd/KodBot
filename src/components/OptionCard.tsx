import { useState } from "react";
import { X } from "lucide-react";
import { api, useStore, type Message } from "@/state/store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

function localInputValue(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function OptionCard({
  botId,
  message,
}: {
  botId: string;
  message: Message;
}) {
  const { dispatch } = useStore();
  const { t } = useI18n();
  const [custom, setCustom] = useState("");
  const card = message.card;
  if (!card || card.dismissed) return null;
  if (card.routineDraft) {
    return <RoutineDraftCard botId={botId} message={message} />;
  }

  const answer = (text: string) => {
    if (!text.trim()) return;
    dispatch({ type: "answerCard", botId, messageId: message.id, answer: text.trim() });
  };

  return (
    <div className="w-full max-w-[840px] rounded-2xl border border-hairline/50 bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[16px] font-semibold text-ink">{t(card.title)}</div>
          <div className="mt-0.5 text-[14px] text-ink-secondary">
            {t(card.subtitle)}
          </div>
        </div>
        <button
          onClick={() =>
            dispatch({ type: "dismissCard", botId, messageId: message.id })
          }
          className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-hairline/40">
        {card.options.map((opt, i) => (
          <button
            key={opt}
            disabled={!!card.answered}
            onClick={() => answer(opt)}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-3 text-left text-[15px] text-ink",
              i > 0 && "border-t border-hairline/40",
              card.answered === opt
                ? "bg-raised"
                : "hover:bg-raised/60 disabled:hover:bg-transparent",
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-raised text-[12px] font-medium text-ink-secondary">
              {LETTERS[i]}
            </span>
            {opt}
          </button>
        ))}
      </div>

      {/* a permission ask has no free-text answer — the broker only accepts
          allow/deny, so typing here used to fail silently */}
      {!card.answered && !card.tool && (
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && answer(custom)}
          placeholder={t("Type your own answer")}
          className="mt-3 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-secondary focus:outline-none focus:border-hairline"
        />
      )}
    </div>
  );
}

function RoutineDraftCard({ botId, message }: { botId: string; message: Message }) {
  const { dispatch } = useStore();
  const { t } = useI18n();
  const card = message.card!;
  const draft = card.routineDraft!;
  const [prompt, setPrompt] = useState(draft.prompt);
  const [when, setWhen] = useState(localInputValue(draft.schedule.at));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const text = prompt.trim();
    if (!text || saving) return;
    const at = new Date(when).getTime();
    const name =
      text.split(/\r?\n/).find((line) => line.trim())?.replace(/\s+/g, " ").trim().slice(0, 80) || draft.name;
    setSaving(true);
    try {
      await api("/api/routines", {
        method: "POST",
        body: JSON.stringify({
          name,
          prompt: text,
          botId: draft.botId,
          runOn: draft.runOn ?? "crew",
          enabled: false,
          schedule: { type: "once", at: Number.isFinite(at) ? at : draft.schedule.at },
        }),
      });
      dispatch({ type: "answerCard", botId, messageId: message.id, answer: t("Save as a paused routine") });
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : String(error) });
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[840px] rounded-2xl border border-hairline/50 bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[16px] font-semibold text-ink">{t(card.title)}</div>
          <div className="mt-0.5 text-[14px] text-ink-secondary">{t(card.subtitle)}</div>
        </div>
        {!card.answered && (
          <button
            onClick={() => dispatch({ type: "dismissCard", botId, messageId: message.id })}
            className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
            aria-label={t("Not now")}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {card.answered ? (
        <div className="mt-3 text-[14px] text-ink-secondary">{t(card.answered)}</div>
      ) : (
        <>
          <label className="mt-3 block text-[13px] text-ink-secondary" htmlFor={`routine-prompt-${message.id}`}>
            {t("Prompt")}
          </label>
          <textarea
            id={`routine-prompt-${message.id}`}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2.5 text-[15px] text-ink focus:border-hairline focus:outline-none"
          />
          <label className="mt-3 block text-[13px] text-ink-secondary" htmlFor={`routine-time-${message.id}`}>
            {t("Time")}
          </label>
          <input
            id={`routine-time-${message.id}`}
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            className="mt-1 rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[15px] text-ink focus:border-hairline focus:outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !prompt.trim()}
              className="rounded-lg bg-accent px-3 py-2 text-[14px] text-white disabled:opacity-50"
            >
              {t("Save as a paused routine")}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "dismissCard", botId, messageId: message.id })}
              className="rounded-lg px-3 py-2 text-[14px] text-ink-secondary hover:bg-raised"
            >
              {t("Not now")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
