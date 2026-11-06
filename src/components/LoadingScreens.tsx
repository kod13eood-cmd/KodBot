// Loading surfaces: a branded boot screen for the first REST snapshot and a
// lightweight chat skeleton while a bot switch is being rendered. Both are
// deliberately cheap so they can paint before a large transcript does.
import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";

import { displayRole } from "@/lib/mascot";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import type { Bot } from "@/state/store";
import { CrewAvatar } from "./Avatar";

export function BootScreen({ connected }: { connected: boolean }) {
  const { t } = useI18n();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 6_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-app p-6">
      <div className="flex max-w-[360px] flex-col items-center text-center">
        <div className="relative flex size-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-accent/10" />
          <span className="absolute -inset-2 rounded-3xl border border-accent/15" />
          <img
            src="/app-icon.svg"
            alt=""
            draggable={false}
            className="relative size-16 rounded-2xl shadow-2xl shadow-black/40"
          />
        </div>
        <div className="mt-6 text-[16px] font-semibold tracking-tight text-ink">KodBot</div>
        <div className="mt-2 flex items-center gap-2 text-[13px] text-ink-secondary">
          <Loader2 size={14} className="animate-spin" />
          {connected ? t("Loading your workspace…") : t("Connecting to the bot server…")}
        </div>
        {slow && (
          <div className="mt-3 text-[12px] leading-relaxed text-ink-secondary/70">
            {connected
              ? t("The transcripts are large; this can take a few seconds.")
              : t("The server has not answered yet. Check that it is running and reachable.")}
          </div>
        )}
      </div>
    </div>
  );
}

/** A chat-shaped placeholder for a bot switch. The avatar/name switch
 * immediately; the message bubbles pulse until the real transcript paints. */
export function ChatLoadingSkeleton({
  name,
  bot,
  group = false,
}: {
  name: string;
  bot?: Bot;
  group?: boolean;
}) {
  const { t } = useI18n();
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-app" aria-busy="true" aria-label={t("Loading chat…")}>
      <div className="flex items-center gap-2.5 px-5 py-3 pl-11 md:pl-5">
        {group || !bot ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-raised text-ink-secondary">
            <Users size={15} />
          </span>
        ) : (
          <CrewAvatar
            color={bot.color}
            shape={bot.mascotShape}
            role={displayRole(bot)}
            state="idle"
            size={28}
            animated={false}
          />
        )}
        <span className="max-w-[240px] truncate text-[15px] font-semibold text-ink">{name}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-secondary">
          <Loader2 size={13} className="animate-spin" />
          {t("Loading chat…")}
        </span>
      </div>

      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-5 px-5 py-7">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className={cn("flex", index % 2 === 1 ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "animate-pulse rounded-2xl bg-raised/70",
                index % 2 === 1 ? "h-11 w-[42%]" : "h-16 w-[62%]",
              )}
              style={{ animationDelay: `${index * 120}ms` }}
            />
          </div>
        ))}
      </div>

      <div className="px-5 pb-5 pt-2">
        <div className="mx-auto h-[52px] max-w-[900px] animate-pulse rounded-3xl border border-hairline/40 bg-raised/40" />
      </div>
    </main>
  );
}
