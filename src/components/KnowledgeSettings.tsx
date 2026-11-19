import { useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Save, Trash2 } from "lucide-react";

import { api, useStore } from "@/state/store";
import { useI18n } from "@/lib/i18n";

interface Topic {
  id?: string;
  title: string;
  body: string;
  updatedAt?: number;
  updatedBy?: string;
}

interface Book {
  core: string;
  topics: Topic[];
}

interface KnowledgeResponse {
  global: Book;
  teams: Array<{ id: string; name: string; book: Book }>;
}

const TEMPLATE = `# Owner
Name:
Languages:
Preferences:

# Mission
What are we trying to do?

# Projects
- Name — one line, current status, where the work lives.

# Skills and tools
- What we are good at, and what we prefer to use.

# People
- Who else matters, and how they relate to the work.`;

export function KnowledgeSettings() {
  const { state } = useStore();
  const { t } = useI18n();
  const [data, setData] = useState<KnowledgeResponse | null>(null);
  const [scope, setScope] = useState<string>("global");
  const [draft, setDraft] = useState<Book>({ core: "", topics: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData((await api("/api/knowledge")) as KnowledgeResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const current = useMemo(() => {
    if (!data) return { core: "", topics: [] };
    if (scope === "global") return data.global;
    return data.teams.find((team) => team.id === scope)?.book ?? { core: "", topics: [] };
  }, [data, scope]);

  useEffect(() => {
    setDraft({ core: current.core, topics: current.topics.map((topic) => ({ ...topic })) });
    setMessage(null);
    setError(null);
  }, [current]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const path = scope === "global" ? "/api/knowledge/global" : `/api/knowledge/teams/${scope}`;
      const body = {
        core: draft.core,
        topics: draft.topics
          .map((topic) => ({
            ...(topic.id ? { id: topic.id } : {}),
            title: topic.title,
            body: topic.body,
            ...(topic.updatedAt ? { updatedAt: topic.updatedAt } : {}),
            ...(topic.updatedBy ? { updatedBy: topic.updatedBy } : {}),
          }))
          .filter((topic) => topic.title.trim() || topic.body.trim()),
      };
      await api(path, { method: "PUT", body: JSON.stringify(body) });
      setMessage(t("Saved. The next turn picks it up."));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const addTopic = () => {
    setDraft((value) => ({
      ...value,
      topics: [...value.topics, { title: "", body: "" }],
    }));
  };

  const patchTopic = (index: number, patch: Partial<Topic>) => {
    setDraft((value) => ({
      ...value,
      topics: value.topics.map((topic, i) => (i === index ? { ...topic, ...patch } : topic)),
    }));
  };

  const removeTopic = (index: number) => {
    setDraft((value) => ({ ...value, topics: value.topics.filter((_, i) => i !== index) }));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-card p-4">
        <div className="flex items-center gap-2 text-[15px] font-medium text-ink">
          <BookOpen size={17} className="text-accent" />
          {t("Shared knowledge")}
        </div>
        <div className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
          {t(
            "One place for who you are, the mission, projects, skills, and the people around the work. Every bot gets the compact core each turn and can read the full topics from its workspace. Team books are visible only to that team.",
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setScope("global")}
          className={
            scope === "global"
              ? "rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white"
              : "rounded-full bg-raised px-3 py-1.5 text-[12.5px] text-ink-secondary hover:text-ink"
          }
        >
          {t("All bots")}
        </button>
        {state.teams.map((team) => (
          <button
            key={team.id}
            onClick={() => setScope(team.id)}
            className={
              scope === team.id
                ? "rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white"
                : "rounded-full bg-raised px-3 py-1.5 text-[12.5px] text-ink-secondary hover:text-ink"
            }
          >
            {team.name}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
      {message && <div className="rounded-lg bg-success/10 px-3 py-2 text-[12.5px] text-success">{message}</div>}

      {loading ? (
        <div className="text-[13px] text-ink-secondary">{t("Loading knowledge…")}</div>
      ) : (
        <>
          <div className="rounded-xl bg-card p-4">
            <div className="text-[13.5px] font-medium text-ink">{t("Core")}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-secondary">
              {t("Short and durable: owner, mission, active projects, skills, and preferences. This is sent with every turn.")}
            </div>
            <textarea
              value={draft.core}
              onChange={(event) => setDraft((value) => ({ ...value, core: event.target.value }))}
              rows={14}
              placeholder={TEMPLATE}
              className="mt-3 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-ink-secondary/60 focus:border-hairline focus:outline-none"
            />
            <div className="mt-1 text-right text-[11px] text-ink-secondary/70">
              {draft.core.length} / 8,000
            </div>
          </div>

          <div className="rounded-xl bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13.5px] font-medium text-ink">{t("Topics")}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-secondary">
                  {t("Full notes a bot reads only when relevant: a project brief, a glossary, a family routine, a skill guide.")}
                </div>
              </div>
              <button
                onClick={addTopic}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-raised px-3 py-1.5 text-[12.5px] text-ink hover:bg-raised-hover"
              >
                <Plus size={13} /> {t("Add topic")}
              </button>
            </div>
            {draft.topics.length === 0 && (
              <div className="mt-3 rounded-lg bg-inset px-3 py-2 text-[12.5px] text-ink-secondary">
                {t("No topics yet. The core is enough to start.")}
              </div>
            )}
            <div className="mt-3 flex flex-col gap-3">
              {draft.topics.map((topic, index) => (
                <div key={topic.id ?? index} className="rounded-lg border border-hairline/40 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={topic.title}
                      onChange={(event) => patchTopic(index, { title: event.target.value })}
                      placeholder={t("Topic title")}
                      maxLength={160}
                      className="min-w-0 flex-1 rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
                    />
                    <button
                      onClick={() => removeTopic(index)}
                      aria-label={t("Remove topic")}
                      className="rounded-md p-2 text-ink-secondary hover:bg-raised hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea
                    value={topic.body}
                    onChange={(event) => patchTopic(index, { body: event.target.value })}
                    rows={4}
                    placeholder={t("The full text a bot reads on demand…")}
                    className="mt-2 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] text-ink-secondary">
              {t("Secrets never belong here. Knowledge is context, not permissions.")}
            </div>
            <button
              onClick={() => void save()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              <Save size={14} /> {saving ? t("Saving…") : t("Save knowledge")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
