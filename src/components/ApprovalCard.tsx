// The approval box: what the bot wants to do, and three ways to answer.
//
// Deliberately not the lettered A/B/C list the onboarding card uses — an
// approval is a decision about one concrete action, so it shows the tool
// and the actual command/path in monospace, and the choices carry their
// own behavior instead of being matched by their label text.
import { Check, Info, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { type Bot, type Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";

interface ToolLabels {
  [tool: string]: string;
}

/** The tool's own name is noise to a human: mcp__ogb__computer_batch is
 * "computer batch", Bash is "run a command". */
function toolLabel(tool?: string): string {
  if (!tool) return "an action";
  const bare = tool.replace(/^mcp__[^_]+__/, "").replace(/_/g, " ");
  const nice: ToolLabels = {
    Bash: "run a command",
    other: "run a command",
    unknown: "use a tool",
    tool: "use a tool",
    Read: "read a file",
    Write: "write a file",
    Edit: "edit a file",
    WebFetch: "fetch a web page",
    WebSearch: "search the web",
  };
  return nice[tool] ?? bare;
}

export function ApprovalCard({
  bot,
  message,
}: {
  /** who is asking, for the "Name wants to …" line */
  bot?: Bot;
  message: Message;
}) {
  const { t } = useI18n();
  const card = message.card;
  if (!card) return null;
  const settled = card.answered;

  return (
    <div
      className={cn(
        "w-full max-w-[840px] rounded-2xl border bg-card p-4",
        settled ? "border-hairline/30 opacity-70" : "border-accent/40",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[15px] font-semibold text-ink">
          {bot ? `${bot.name} wants to ` : "Wants to "}
          {toolLabel(card.tool)}
        </div>
        {card.tool && <span className="shrink-0 font-mono text-[11px] text-ink-secondary">{card.tool}</span>}
      </div>

      {card.explanation && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-[12.5px] leading-relaxed text-ink">
          <Info size={14} className="mt-0.5 shrink-0 text-accent" />
          <span>
            <span className="font-medium">{t("What this means")}: </span>
            {card.explanation}
          </span>
        </div>
      )}

      {card.risk && (
        <div
          className={cn(
            "mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed",
            card.riskLevel === "high"
              ? "border-danger/35 bg-danger/10 text-danger"
              : card.riskLevel === "low"
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/30 bg-warning/10 text-warning",
          )}
        >
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium">{t("Why it needs approval")}: </span>
            {card.risk}
          </span>
        </div>
      )}

      {card.purpose && (
        <div className="mt-1.5 text-[11.5px] text-ink-secondary">
          {t("Task")}: {card.purpose}
        </div>
      )}

      {/* what, exactly */}
      <div className="mt-2 text-[10.5px] uppercase tracking-wider text-ink-secondary">
        {t("Requested action")}
      </div>
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-inset px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink">
        {card.subtitle}
      </pre>

      {card.overdueAt && !settled && (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-warning">
          {t("The timer expired, but the bot is still waiting. You can answer now and it will continue.")}
        </div>
      )}

      {card.held && (
        <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12.5px] text-warning">
          {card.held}
        </div>
      )}

      {/* The decision lives in the composer (one place to answer, and it
          can't be scrolled past); here we only record what happened. */}
      <div className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-secondary">
        {settled === "allow" ? (
          <>
            <Check size={14} className="text-success" /> Allowed
          </>
        ) : settled ? (
          <>
            <X size={14} /> Denied
          </>
        ) : (
          <>
            <ShieldCheck size={14} className="text-accent" /> Waiting for your answer below
          </>
        )}
      </div>
    </div>
  );
}
