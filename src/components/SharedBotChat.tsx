// Live shared conversation: one bot thread on the organization's shared
// harness, opened by any signed-in member. The gateway authenticates the
// member and the shared harness attributes each turn to that speaker.
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Users, X } from "lucide-react";

import { api, type Message } from "@/state/store";
import { useI18n } from "@/lib/i18n";
import { formatTokens, formatUsd } from "@/lib/usage";
import { cn } from "@/lib/cn";
import { ChatMarkdown } from "./ChatMarkdown";

interface SharedBotChatProps {
  bot: { id: string; name: string; title: string | null; description: string | null };
  canSeeUsage: boolean;
  onClose: () => void;
}

interface MemberUsage {
  id: string;
  name: string;
  input: number;
  output: number;
  costUsd: number;
  turns: number;
}

function timeLabel(at: number, locale: string): string {
  return new Date(at).toLocaleTimeString(locale === "bg" ? "bg-BG" : undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SharedBotChat({ bot, canSeeUsage, onClose }: SharedBotChatProps) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState<MemberUsage[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);

  const load = async () => {
    try {
      const page = await api(`/api/shared-bots/${bot.id}/messages?limit=200`);
      if (!alive.current) return;
      setMessages(Array.isArray(page.messages) ? page.messages : []);
      setError(null);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (alive.current) setLoading(false);
    }
  };

  const loadUsage = async () => {
    if (!canSeeUsage) return;
    try {
      const body = await api(`/api/shared-bots/${bot.id}/usage`);
      if (alive.current) setUsage(Array.isArray(body.members) ? body.members : []);
    } catch {
      /* usage is a secondary panel; the conversation still works */
    }
  };

  useEffect(() => {
    alive.current = true;
    setMessages([]);
    setUsage(null);
    setLoading(true);
    setError(null);
    void load();
    void loadUsage();
    const timer = window.setInterval(() => {
      void load();
      void loadUsage();
    }, 2_500);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
    };
    // A new bot id is a new conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id, canSeeUsage]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, text]);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/shared-bots/${bot.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: value }),
      });
      setText("");
      await load();
      await loadUsage();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSending(false);
    }
  };

  const waiting = messages.length > 0 && messages.at(-1)?.role === "user";
  const total = (usage ?? []).reduce(
    (sum, member) => ({
      input: sum.input + member.input,
      output: sum.output + member.output,
      costUsd: sum.costUsd + member.costUsd,
      turns: sum.turns + member.turns,
    }),
    { input: 0, output: 0, costUsd: 0, turns: 0 },
  );

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-2 sm:p-6">
      <div className="flex h-full max-h-[880px] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-hairline/50 bg-app shadow-2xl">
        <div className="flex items-start gap-3 border-b border-hairline/40 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[16px] font-semibold text-ink">{bot.name}</h2>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-medium text-accent">
                {t("Live shared")}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-ink-secondary">
              {bot.title || bot.description || t("Everyone in the organization uses this one conversation.")}
            </div>
          </div>
          {canSeeUsage && usage && usage.length > 0 && (
            <div className="hidden shrink-0 text-right text-[10.5px] text-ink-secondary sm:block">
              <div className="flex items-center justify-end gap-1">
                <Users size={11} /> {usage.length}
              </div>
              <div>
                {formatTokens(total.input + total.output)} · {formatUsd(total.costUsd)}
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            aria-label={t("Close shared conversation")}
            className="rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {canSeeUsage && usage && usage.length > 0 && (
          <details className="border-b border-hairline/30 bg-panel/40 px-4 py-2 text-[11.5px] text-ink-secondary">
            <summary className="cursor-pointer select-none">
              {t("Usage by member")} · {formatTokens(total.input + total.output)} · {formatUsd(total.costUsd)}
            </summary>
            <div className="mt-2 flex flex-col gap-1">
              {usage.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{member.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {formatTokens(member.input + member.output)} · {formatUsd(member.costUsd)} · {member.turns}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-ink-secondary">
              <Loader2 size={15} className="animate-spin" /> {t("Loading conversation…")}
            </div>
          ) : messages.length === 0 ? (
            <div className="px-4 py-16 text-center text-[13px] text-ink-secondary">
              {t("No messages yet. Say hello to start the shared conversation.")}
            </div>
          ) : (
            <div className="mx-auto flex max-w-[760px] flex-col gap-3">
              {messages.map((message) => {
                if (message.kind === "activity") {
                  const name = message.tool?.name ?? "";
                  if (!name || name.startsWith("error:")) {
                    const errorText = name.startsWith("error:") ? name.slice(6).trim() : "";
                    return errorText ? (
                      <div key={message.id} className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
                        {errorText}
                      </div>
                    ) : null;
                  }
                  return null;
                }
                if (message.kind !== "text" || !message.text) return null;
                const user = message.role === "user";
                return (
                  <div key={message.id} className={cn("flex flex-col", user ? "items-end" : "items-start")}>
                    {user && (
                      <span className="mb-0.5 max-w-[80%] truncate pr-1 text-[10.5px] font-medium text-ink-secondary">
                        {message.speaker?.name ?? t("Member")}
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed",
                        user
                          ? "bg-[var(--color-bubble-user)] text-ink"
                          : "border border-hairline/30 bg-card text-ink",
                      )}
                    >
                      {user ? (
                        <div className="whitespace-pre-wrap break-words">{message.text}</div>
                      ) : (
                        <ChatMarkdown text={message.text} />
                      )}
                    </div>
                    <span className="mt-0.5 px-1 text-[10px] tabular-nums text-ink-secondary/60">
                      {timeLabel(message.at, locale)}
                    </span>
                  </div>
                );
              })}
              {waiting && (
                <div className="flex items-center gap-2 text-[12px] text-ink-secondary">
                  <Loader2 size={13} className="animate-spin text-accent" />
                  {t("{name} is working…", { name: bot.name })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-hairline/40 p-3">
          {error && (
            <div className="mb-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
              {error}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-xl border border-hairline/50 bg-inset px-3 py-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={t("Message everyone in this shared bot…")}
              aria-label={t("Message the shared bot")}
              className="max-h-32 min-h-6 w-full resize-none bg-transparent py-1 text-[14px] leading-6 text-ink placeholder:text-ink-secondary focus:outline-none"
            />
            <button
              onClick={() => void send()}
              disabled={!text.trim() || sending}
              aria-label={t("Send")}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
