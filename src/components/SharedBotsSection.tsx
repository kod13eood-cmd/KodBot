// Shared bot templates for KodBot Business. The owner publishes a bot's
// persona and redacted core memory; every member can install their own copy
// into their own workspace. Turns run there with that member's key and quota,
// so the gateway never executes a bot and per-speaker billing stays natural.
import { useEffect, useState } from "react";
import { Download, MessagesSquare, Share2, Trash2, Upload } from "lucide-react";

import { api, useStore } from "@/state/store";
import { useI18n } from "@/lib/i18n";
import { Card } from "./SettingsPrimitives";
import { SharedBotChat } from "./SharedBotChat";

interface SharedBotSummary {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  live?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface SharedBotDetail extends SharedBotSummary {
  memory: string;
}

function when(at: number, locale: string): string {
  return new Date(at).toLocaleString(locale === "bg" ? "bg-BG" : undefined);
}

export function SharedBotsSection() {
  const { state } = useStore();
  const { t, locale } = useI18n();
  const isOwner = state.authUser?.role === "owner";
  const [templates, setTemplates] = useState<SharedBotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [livePublish, setLivePublish] = useState(false);
  const [openChat, setOpenChat] = useState<SharedBotSummary | null>(null);
  const [orgKeyConfigured, setOrgKeyConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await api("/api/shared-bots");
      setTemplates(body.bots ?? []);
      if (isOwner) {
        const settings = await api("/api/admin/shared-bots/settings");
        setOrgKeyConfigured(Boolean(settings.orgKeyConfigured));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!state.authUser) return;
    void load();
  }, [state.authUser?.id]);

  if (!state.authUser) return null;

  const publish = async () => {
    if (!selectedBotId || busy) return;
    setBusy("publish");
    setError(null);
    setNotice(null);
    try {
      const template = await api(`/api/bots/${selectedBotId}/shared-template`);
      await api("/api/admin/shared-bots", {
        method: "POST",
        body: JSON.stringify({ ...template.bot, live: livePublish }),
      });
      setNotice(
        livePublish
          ? t("Published {name} as a live shared conversation.", { name: template.bot.name })
          : t("Published {name}. Every member of the organization can install a copy.", {
              name: template.bot.name,
            }),
      );
      setLivePublish(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (template: SharedBotSummary) => {
    if (
      !window.confirm(
        template.live
          ? t("Remove {name}? Its shared conversation and usage history will be deleted.", {
              name: template.name,
            })
          : t("Remove {name} from shared bots? Copies already installed stay in their workspaces.", {
              name: template.name,
            }),
      )
    ) {
      return;
    }
    setBusy(`remove:${template.id}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/admin/shared-bots/${template.id}`, { method: "DELETE" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const install = async (template: SharedBotSummary) => {
    if (busy) return;
    setBusy(`install:${template.id}`);
    setError(null);
    setNotice(null);
    let botId: string | null = null;
    try {
      const full = (await api(`/api/shared-bots/${template.id}`)) as { bot: SharedBotDetail };
      const created = (await api("/api/bots", { method: "POST", body: "{}" })) as {
        bot: { id: string };
      };
      botId = created.bot.id;
      await api(`/api/bots/${botId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: full.bot.name,
          ...(full.bot.title ? { title: full.bot.title } : {}),
          ...(full.bot.description ? { description: full.bot.description } : {}),
        }),
      });
      if (full.bot.memory.trim()) {
        await api(`/api/bots/${botId}/memory`, {
          method: "PUT",
          body: JSON.stringify({ text: full.bot.memory }),
        });
      }
      setNotice(
        t("{name} was added to your workspace. It runs here, with your key and quota.", {
          name: full.bot.name,
        }),
      );
      // The fleet is hydrated at boot; a reload is the simplest guaranteed
      // way to show the new bot in the sidebar and task picker.
      window.setTimeout(() => window.location.reload(), 700);
    } catch (cause) {
      if (botId) {
        await api(`/api/bots/${botId}`, { method: "DELETE" }).catch(() => {});
      }
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(null);
    }
  };

  const candidates = state.bots.filter((bot) => !bot.hidden);

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={t("Shared bots")}
        subtitle={t(
          "Publish a bot for the organization. Each member who installs it gets their own copy; turns run in their workspace with their own key.",
        )}
      >
        {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
        {notice && <div className="rounded-lg bg-success/10 px-3 py-2 text-[12.5px] text-success">{notice}</div>}

        {isOwner ? (
          <div className="mt-3 flex flex-col gap-2">
            <label className="text-[12px] text-ink-secondary">
              {t("Bot to publish")}
              <select
                value={selectedBotId}
                onChange={(event) => setSelectedBotId(event.target.value)}
                disabled={busy !== null || candidates.length === 0}
                className="mt-1 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink focus:border-hairline focus:outline-none"
              >
                <option value="">{t("Choose a bot…")}</option>
                {candidates.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.title ? `${bot.name} · ${bot.title}` : bot.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void publish()}
                disabled={busy !== null || !selectedBotId}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white hover:brightness-110 disabled:opacity-40"
              >
                <Upload size={13} />
                {busy === "publish" ? t("Publishing…") : t("Publish to organization")}
              </button>
              <span className="text-[11.5px] text-ink-secondary">
                {t("Only the name, title, description, and MEMORY.md are shared. Common secrets are redacted; review the memory before publishing.")}
              </span>
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[12px] leading-relaxed text-ink-secondary">
              <input
                type="checkbox"
                checked={livePublish}
                onChange={(event) => setLivePublish(event.target.checked)}
                disabled={busy !== null}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-ink">{t("Live shared conversation")}</span>
                <span className="block">
                  {t("Everyone talks to one bot on the organization server. The organization model key is used; usage is attributed to each member.")}
                </span>
              </span>
            </label>
            {orgKeyConfigured !== null && (
              <div
                className={`rounded-lg px-3 py-2 text-[11.5px] leading-relaxed ${
                  orgKeyConfigured ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                }`}
              >
                {orgKeyConfigured
                  ? t("The organization OpenCode key is configured for live shared bots.")
                  : t(
                      "No organization OpenCode key is configured yet; live bots use free OpenCode models. Add OC_ORG_OPENCODE_API_KEY to the gateway env file and restart the gateway for paid models.",
                    )}
              </div>
            )}
            <div className="text-[11.5px] leading-relaxed text-ink-secondary">
              {t("Every member of the organization can see a shared bot. Install copies stay independent; live conversations are shared.")}
            </div>
          </div>
        ) : (
          <div className="mt-3 text-[12px] leading-relaxed text-ink-secondary">
            {t("Install a shared bot, or open a live shared conversation with the organization.")}
          </div>
        )}
      </Card>

      <Card
        title={t("Published bots")}
        subtitle={t("Templates install a private copy. Live bots keep one shared conversation on the organization server.")}
      >
        {loading ? (
          <div className="text-[13px] text-ink-secondary">{t("Loading…")}</div>
        ) : templates.length === 0 ? (
          <div className="text-[12.5px] text-ink-secondary">
            {t("No shared bots yet.")}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-hairline/40 bg-inset px-3 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Share2 size={13} className="shrink-0 text-accent" />
                      <span className="truncate text-[13.5px] font-medium text-ink">{template.name}</span>
                      {template.live && (
                        <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9.5px] font-medium text-accent">
                          {t("Live")}
                        </span>
                      )}
                    </div>
                    {template.title && (
                      <div className="mt-0.5 text-[11.5px] text-ink-secondary">{template.title}</div>
                    )}
                    {template.description && (
                      <div className="mt-0.5 text-[11.5px] leading-relaxed text-ink-secondary">
                        {template.description}
                      </div>
                    )}
                    <div className="mt-1 text-[10.5px] text-ink-secondary/70">
                      {t("Published {when}", { when: when(template.updatedAt, locale) })}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {template.live ? (
                      <button
                        onClick={() => setOpenChat(template)}
                        className="flex items-center gap-1 rounded-md bg-raised px-2 py-1 text-[11.5px] text-ink hover:bg-raised-hover"
                      >
                        <MessagesSquare size={12} />
                        {t("Open conversation")}
                      </button>
                    ) : (
                      <button
                        onClick={() => void install(template)}
                        disabled={busy !== null}
                        className="flex items-center gap-1 rounded-md bg-raised px-2 py-1 text-[11.5px] text-ink hover:bg-raised-hover disabled:opacity-50"
                      >
                        <Download size={12} />
                        {busy === `install:${template.id}` ? t("Adding…") : t("Add to my workspace")}
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => void remove(template)}
                        disabled={busy !== null}
                        aria-label={t("Remove shared bot")}
                        title={t("Remove shared bot")}
                        className="rounded-md px-2 py-1 text-danger hover:bg-raised disabled:opacity-50"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {openChat && (
        <SharedBotChat
          bot={openChat}
          canSeeUsage={isOwner}
          onClose={() => setOpenChat(null)}
        />
      )}
    </div>
  );
}
