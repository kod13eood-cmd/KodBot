import { useEffect, useState } from "react";
import { Copy, KeyRound, MailPlus, RefreshCw, ShieldCheck, Trash2, UserX } from "lucide-react";

import { api, useStore } from "@/state/store";
import { useI18n } from "@/lib/i18n";
import { copyText } from "@/lib/clipboard";
import { Card } from "./SettingsPrimitives";

interface AdminUser {
  id: string;
  email: string;
  role: "owner" | "member";
  createdAt: number;
  disabledAt: number | null;
}

interface AdminInvite {
  id: string;
  email: string | null;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
}

function when(at: number, locale: string): string {
  return new Date(at).toLocaleString(locale === "bg" ? "bg-BG" : undefined);
}

export function AdminSection() {
  const { state } = useStore();
  const { t, locale } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDays, setInviteDays] = useState("7");
  const [code, setCode] = useState<{ email: string | null; code: string; expiresAt: number } | null>(null);
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [userBody, inviteBody] = await Promise.all([
        api("/api/admin/users"),
        api("/api/admin/invites"),
      ]);
      setUsers(userBody.users ?? []);
      setInvites(inviteBody.invites ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (state.authUser?.role !== "owner") return null;

  const resetPassword = async (user: AdminUser) => {
    if (busy) return;
    // Resetting invalidates every session, including this one when the owner
    // resets their own password. Warn before the screen silently bounces to
    // the login page on the next request.
    if (
      user.role === "owner" &&
      !window.confirm(t("Resetting the owner password signs out this session too. Continue?"))
    ) {
      return;
    }
    setBusy(`password:${user.id}`);
    setError(null);
    setNotice(null);
    try {
      const body = await api(`/api/admin/users/${user.id}/password`, { method: "POST", body: "{}" });
      setCredential({ email: user.email, password: body.password });
      // No reload here: a reload of the owner's own reset would 401 before the
      // temporary password could be copied.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const toggleDisabled = async (user: AdminUser) => {
    const next = user.disabledAt === null;
    if (next && !window.confirm(t("Disable {email}? Their sessions will be signed out.", { email: user.email }))) return;
    setBusy(`disabled:${user.id}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/admin/users/${user.id}/disabled`, {
        method: "POST",
        body: JSON.stringify({ disabled: next }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const signOutSessions = async (user: AdminUser) => {
    if (!window.confirm(t("Sign out every session for {email}?", { email: user.email }))) return;
    setBusy(`sessions:${user.id}`);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/admin/users/${user.id}/sessions`, { method: "DELETE" });
      setNotice(t("Sessions signed out for {email}.", { email: user.email }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const createInvite = async () => {
    setBusy("invite");
    setError(null);
    setNotice(null);
    try {
      const body = await api("/api/admin/invites", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim() || undefined, days: Number(inviteDays) }),
      });
      setCode({ email: body.email, code: body.code, expiresAt: body.expiresAt });
      setInviteEmail("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const revokeInvite = async (invite: AdminInvite) => {
    if (!window.confirm(t("Revoke this invite?"))) return;
    setBusy(`invite:${invite.id}`);
    setError(null);
    try {
      await api(`/api/admin/invites/${invite.id}`, { method: "DELETE" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const pendingInvites = invites.filter((invite) => !invite.usedAt && invite.expiresAt > Date.now());

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={t("Admin")}
        subtitle={t("Owner-only controls for the hosted KodBot gateway. Members never see these screens.")}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] text-ink-secondary">
            <ShieldCheck size={15} className="text-accent" />
            {t("Signed in as the owner.")}
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-raised px-3 py-1.5 text-[12.5px] text-ink hover:bg-raised-hover disabled:opacity-50"
          >
            <RefreshCw size={13} /> {t("Refresh")}
          </button>
        </div>
        {error && <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</div>}
        {notice && <div className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-[12.5px] text-success">{notice}</div>}
      </Card>

      {credential && (
        <Card title={t("Temporary password")} subtitle={t("Share it with {email} once, then ask them to change it.", { email: credential.email })}>
          <div className="flex items-center gap-2 rounded-lg bg-inset px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-ink">{credential.password}</code>
            <button
              onClick={() => void copyText(credential.password)}
              className="shrink-0 rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
              title={t("Copy")}
            >
              <Copy size={14} />
            </button>
          </div>
          <button onClick={() => setCredential(null)} className="mt-2 text-[12px] text-ink-secondary hover:text-ink">
            {t("Done")}
          </button>
        </Card>
      )}

      {code && (
        <Card title={t("Invite code")} subtitle={t("Send this to {email} or to the person you want to invite.", { email: code.email ?? t("the invited person") })}>
          <div className="flex items-center gap-2 rounded-lg bg-inset px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-ink">{code.code}</code>
            <button
              onClick={() => void copyText(code.code)}
              className="shrink-0 rounded-md p-1.5 text-ink-secondary hover:bg-raised hover:text-ink"
              title={t("Copy")}
            >
              <Copy size={14} />
            </button>
          </div>
          <div className="mt-2 text-[12px] text-ink-secondary">
            {t("Expires {when}.", { when: when(code.expiresAt, locale) })}
          </div>
          <button onClick={() => setCode(null)} className="mt-2 text-[12px] text-ink-secondary hover:text-ink">
            {t("Done")}
          </button>
        </Card>
      )}

      <Card title={t("Users")} subtitle={t("Accounts on this gateway. Only the owner can administer them.")}>
        {loading ? (
          <div className="text-[13px] text-ink-secondary">{t("Loading…")}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((user) => (
              <div key={user.id} className="rounded-lg border border-hairline/40 bg-inset px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-ink">{user.email}</div>
                    <div className="mt-0.5 text-[11.5px] text-ink-secondary">
                      {user.role === "owner" ? t("Owner") : t("Member")} ·{" "}
                      {user.disabledAt ? t("Disabled") : t("Active")} · {t("Created {when}", { when: when(user.createdAt, locale) })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => void resetPassword(user)}
                      disabled={busy !== null}
                      className="flex items-center gap-1 rounded-md bg-raised px-2 py-1 text-[11.5px] text-ink hover:bg-raised-hover disabled:opacity-50"
                    >
                      <KeyRound size={12} /> {t("Reset password")}
                    </button>
                    {user.role !== "owner" && (
                      <button
                        onClick={() => void toggleDisabled(user)}
                        disabled={busy !== null}
                        className="flex items-center gap-1 rounded-md bg-raised px-2 py-1 text-[11.5px] text-ink hover:bg-raised-hover disabled:opacity-50"
                      >
                        <UserX size={12} /> {user.disabledAt ? t("Enable") : t("Disable")}
                      </button>
                    )}
                    <button
                      onClick={() => void signOutSessions(user)}
                      disabled={busy !== null}
                      className="rounded-md bg-raised px-2 py-1 text-[11.5px] text-ink-secondary hover:bg-raised-hover hover:text-ink disabled:opacity-50"
                    >
                      {t("Sign out sessions")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t("Invites")} subtitle={t("KodBot is invite-only. Create a one-time code; it is shown once.")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-[12px] text-ink-secondary">
            {t("Email (optional)")}
            <input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder={t("any email")}
              className="mt-1 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
            />
          </label>
          <label className="w-full text-[12px] text-ink-secondary sm:w-28">
            {t("Days")}
            <select
              value={inviteDays}
              onChange={(event) => setInviteDays(event.target.value)}
              className="mt-1 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink focus:border-hairline focus:outline-none"
            >
              <option value="1">1</option>
              <option value="7">7</option>
              <option value="30">30</option>
            </select>
          </label>
          <button
            onClick={() => void createInvite()}
            disabled={busy !== null}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12.5px] font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            <MailPlus size={13} /> {t("Create invite")}
          </button>
        </div>

        <div className="mt-4 text-[12.5px] font-medium text-ink">{t("Pending invites")}</div>
        {pendingInvites.length === 0 ? (
          <div className="mt-1 text-[12px] text-ink-secondary">{t("No pending invites.")}</div>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-2 rounded-lg bg-inset px-3 py-2">
                <div className="min-w-0 text-[12px]">
                  <div className="truncate text-ink">{invite.email ?? t("Any email")}</div>
                  <div className="text-[11px] text-ink-secondary">{t("Expires {when}", { when: when(invite.expiresAt, locale) })}</div>
                </div>
                <button
                  onClick={() => void revokeInvite(invite)}
                  disabled={busy !== null}
                  className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-danger hover:bg-raised disabled:opacity-50"
                >
                  <Trash2 size={12} /> {t("Revoke")}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
