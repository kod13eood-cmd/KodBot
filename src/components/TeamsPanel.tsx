import { useEffect, useState } from "react";
import { Crown, DoorOpen, Loader2, Pencil, Plus, Trash2, UserMinus, UserPlus, Users, X } from "lucide-react";
import { api, useStore, type Bot, type Team } from "@/state/store";
import { useI18n } from "@/lib/i18n";
import { CrewAvatar } from "./Avatar";
import { displayRole } from "@/lib/mascot";

function TeamMember({
  bot,
  leader,
  onMakeLeader,
  onRemove,
}: {
  bot: Bot;
  leader: boolean;
  onMakeLeader: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-raised/40">
      <CrewAvatar color={bot.color} shape={bot.mascotShape} role={displayRole(bot)} state="idle" size={26} animated={false} />
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{bot.name}</span>
      {leader ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
          <Crown size={10} /> {t("Leader")}
        </span>
      ) : (
        <>
          <button
            onClick={onMakeLeader}
            className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] text-ink-secondary hover:bg-raised hover:text-ink"
            title={t("Make leader")}
          >
            {t("Make leader")}
          </button>
          <button
            onClick={onRemove}
            aria-label={t("Remove {name} from the team", { name: bot.name })}
            className="shrink-0 rounded p-1 text-ink-secondary hover:bg-danger/10 hover:text-danger"
            title={t("Remove from team")}
          >
            <UserMinus size={12} />
          </button>
        </>
      )}
    </div>
  );
}

function TeamCard({ team, onChanged, onOpenRoom }: { team: Team; onChanged: (team: Team) => void; onOpenRoom: () => void }) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addBotId, setAddBotId] = useState("");
  const members = team.memberIds
    .map((id) => state.bots.find((bot) => bot.id === id))
    .filter((bot): bot is Bot => Boolean(bot));
  const memberSet = new Set(team.memberIds);
  const available = state.bots.filter(
    (bot) => !bot.hidden && !memberSet.has(bot.id) && !state.teams.some((candidate) => candidate.memberIds.includes(bot.id)),
  );
  const leader = state.bots.find((bot) => bot.id === team.leaderBotId);
  const room = team.roomId ? state.groups.find((group) => group.id === team.roomId) : undefined;

  const run = async (task: () => Promise<{ team?: Team; group?: unknown }>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await task();
      if (result.team) onChanged(result.team);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const rename = () => {
    const name = window.prompt(t("Team name"), team.name);
    if (!name?.trim() || name.trim() === team.name) return;
    void run(async () => api(`/api/teams/${team.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name.trim() }),
    }));
  };

  const makeLeader = (botId: string) => {
    void run(async () => api(`/api/teams/${team.id}`, {
      method: "PATCH",
      body: JSON.stringify({ leaderBotId: botId }),
    }));
  };

  const addMember = () => {
    if (!addBotId) return;
    void run(async () => {
      const result = await api(`/api/teams/${team.id}/members`, {
        method: "POST",
        body: JSON.stringify({ botId: addBotId }),
      });
      setAddBotId("");
      return result;
    });
  };

  const removeMember = (botId: string) => {
    const bot = state.bots.find((candidate) => candidate.id === botId);
    if (!bot || !window.confirm(t("Remove {name} from this team?", { name: bot.name }))) return;
    void run(async () => api(`/api/teams/${team.id}/members/${botId}`, { method: "DELETE" }));
  };

  const createRoom = () => {
    void run(async () => {
      const result = await api(`/api/teams/${team.id}/room`, { method: "POST" });
      if (result.group) dispatch({ type: "groupPatched", group: result.group });
      return result;
    });
  };

  return (
    <section className="rounded-xl border border-hairline/40 bg-card p-3.5">
      <header className="flex items-start gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-raised text-ink-secondary">
          <Users size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[14px] font-semibold text-ink">{team.name}</h3>
            <button
              onClick={rename}
              disabled={busy}
              aria-label={t("Rename team")}
              title={t("Rename team")}
              className="rounded p-1 text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
            >
              <Pencil size={11} />
            </button>
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-secondary">
            {leader ? `${t("Leader")}: ${leader.name}` : t("No leader")}
            {` · ${t("{count} members", { count: members.length })}`}
          </div>
        </div>
        <button
          onClick={() => {
            if (!window.confirm(t("Delete the team “{name}”? Bots become ungrouped.", { name: team.name }))) return;
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                await api(`/api/teams/${team.id}`, { method: "DELETE" });
                dispatch({ type: "teamDeleted", teamId: team.id });
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
              } finally {
                setBusy(false);
              }
            })();
          }}
          disabled={busy}
          aria-label={t("Delete team")}
          title={t("Delete team")}
          className="rounded-lg p-1.5 text-ink-secondary hover:bg-danger/10 hover:text-danger disabled:opacity-40"
        >
          <Trash2 size={13} />
        </button>
      </header>

      <div className="mt-2">
        {members.map((bot) => (
          <TeamMember
            key={bot.id}
            bot={bot}
            leader={bot.id === team.leaderBotId}
            onMakeLeader={() => makeLeader(bot.id)}
            onRemove={() => removeMember(bot.id)}
          />
        ))}
        {members.length === 0 && <div className="px-2 py-2 text-[12px] text-ink-secondary">{t("No members.")}</div>}
      </div>

      {available.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={addBotId}
            onChange={(event) => setAddBotId(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-hairline/40 bg-inset px-2 py-1.5 text-[11.5px] text-ink focus:outline-none"
            aria-label={t("Bot to add")}
          >
            <option value="">{t("Add a bot…")}</option>
            {available.map((bot) => (
              <option key={bot.id} value={bot.id}>{bot.name}</option>
            ))}
          </select>
          <button
            onClick={addMember}
            disabled={!addBotId || busy}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-raised px-2.5 py-1.5 text-[11.5px] text-ink hover:bg-raised-hover disabled:opacity-40"
          >
            <UserPlus size={12} /> {t("Add")}
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-hairline/40 pt-2">
        {room ? (
          <button
            onClick={() => {
              dispatch({ type: "select", id: room.id });
              onOpenRoom();
            }}
            className="flex items-center gap-1.5 text-[11.5px] text-accent hover:underline"
          >
            <DoorOpen size={13} /> {t("Open team room")} · {room.name}
          </button>
        ) : (
          <button
            onClick={createRoom}
            disabled={busy || members.length === 0}
            className="flex items-center gap-1.5 text-[11.5px] text-ink-secondary hover:text-ink disabled:opacity-40"
          >
            <Plus size={13} /> {t("Create team room")}
          </button>
        )}
        {busy && <Loader2 size={13} className="animate-spin text-ink-secondary" />}
      </div>
      {error && <div className="mt-2 text-[11.5px] text-danger">{error}</div>}
    </section>
  );
}

export function TeamsPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [creatorBotId, setCreatorBotId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const ungrouped = state.bots.filter(
    (bot) => !bot.hidden && !state.teams.some((team) => team.memberIds.includes(bot.id)),
  );

  useEffect(() => {
    if (creatorBotId && !ungrouped.some((bot) => bot.id === creatorBotId)) setCreatorBotId("");
    if (!creatorBotId && ungrouped[0]) setCreatorBotId(ungrouped[0].id);
  }, [creatorBotId, ungrouped]);

  const create = async () => {
    if (!name.trim() || !creatorBotId) return;
    setBusy(true);
    setError(null);
    try {
      const { team } = await api("/api/teams", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), creatorBotId }),
      });
      dispatch({ type: "teamPatched", team });
      setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="teams-title"
        className="flex max-h-[min(780px,90vh)] w-full max-w-[660px] flex-col overflow-hidden rounded-2xl border border-hairline/60 bg-panel shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline/40 px-5 py-4">
          <div>
            <h2 id="teams-title" className="text-[17px] font-semibold text-ink">{t("Teams")}</h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">
              {t("Create teams with an ungrouped bot as leader. Members can join one team at a time; a new leader must be chosen before the current one leaves.")}
            </p>
          </div>
          <button onClick={onClose} aria-label={t("Close")} className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink">
            <X size={18} />
          </button>
        </header>

        <div className="border-b border-hairline/40 px-5 py-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-secondary">{t("Create a team")}</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("Team name")}
              className="min-w-0 flex-1 rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[12.5px] text-ink placeholder:text-ink-secondary focus:outline-none"
            />
            <select
              value={creatorBotId}
              onChange={(event) => setCreatorBotId(event.target.value)}
              className="min-w-0 rounded-lg border border-hairline/40 bg-inset px-2.5 py-2 text-[12px] text-ink focus:outline-none sm:w-[190px]"
              aria-label={t("Team leader")}
            >
              <option value="">{ungrouped.length ? t("Choose a bot…") : t("No ungrouped bots")}</option>
              {ungrouped.map((bot) => (
                <option key={bot.id} value={bot.id}>{bot.name}</option>
              ))}
            </select>
            <button
              onClick={() => void create()}
              disabled={busy || !name.trim() || !creatorBotId}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12px] font-medium text-white hover:brightness-110 disabled:opacity-40"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} {t("Create team")}
            </button>
          </div>
          {error && <div className="mt-2 text-[11.5px] text-danger">{error}</div>}
          {ungrouped.length === 0 && (
            <div className="mt-2 text-[11.5px] text-ink-secondary">
              {t("Every bot is already in a team. Leave a team before creating another.")}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {state.teams.length === 0 && (
            <div className="py-12 text-center text-[13px] text-ink-secondary">{t("No teams yet.")}</div>
          )}
          {state.teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onChanged={(next) => dispatch({ type: "teamPatched", team: next })}
              onOpenRoom={onClose}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
