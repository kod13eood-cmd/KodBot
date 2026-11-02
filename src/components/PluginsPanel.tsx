// Connected apps marketplace, backed by Composio Sessions. Catalog comes
// from /api/connectors/catalog — the full toolkit list with logos when a
// Composio API key is configured, a curated set otherwise. Icons resolve
// logo → favicon → monogram.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { api, useStore } from "@/state/store";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";

interface ToolkitCard {
  slug: string;
  label: string;
  blurb: string;
  description?: string;
  logo: string | null;
  domain: string | null;
}

export interface ConnectorAccount {
  id: string;
  status?: string;
  alias?: string;
  label?: string;
}

interface AccountIdentityState {
  identity?: string | null;
  reason?: string;
  loading?: boolean;
}

export interface ConnectorStatus {
  connected: boolean;
  pending?: boolean;
  status?: string;
  accounts?: ConnectorAccount[];
}



export function mergeCurrentConnectorStatus(
  current: Record<string, ConnectorStatus>,
  incoming: Record<string, ConnectorStatus>,
  latestGenerations: ReadonlyMap<string, number>,
  requestGenerations: ReadonlyMap<string, number>,
) {
  const next = { ...current };
  for (const [slug, state] of Object.entries(incoming)) {
    if ((latestGenerations.get(slug) ?? 0) !== (requestGenerations.get(slug) ?? 0)) continue;
    next[slug] = state;
  }
  return next;
}

function ServiceIcon({ card }: { card: ToolkitCard }) {
  // 0 = official logo, 1 = favicon by domain, 2 = monogram
  const [stage, setStage] = useState(card.logo ? 0 : card.domain ? 1 : 2);
  if (stage === 0 && card.logo) {
    return <img src={card.logo} alt="" className="size-11 rounded-xl object-contain" onError={() => setStage(1)} />;
  }
  if (stage === 1 && card.domain) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${card.domain}&sz=64`}
        alt=""
        className="size-11 rounded-xl object-contain"
        onError={() => setStage(2)}
      />
    );
  }
  return (
    <div className="flex size-11 items-center justify-center rounded-xl bg-raised text-[15px] font-semibold text-ink-secondary">
      {card.label.slice(0, 1).toUpperCase()}
    </div>
  );
}

function accountTone(status: string | undefined): string {
  if (/^active$/i.test(status ?? "")) return "bg-success/15 text-success";
  if (/^(initializing|initiated|pending)$/i.test(status ?? "")) return "bg-warning/15 text-warning";
  if (/^(expired|failed|revoked|error)$/i.test(status ?? "")) return "bg-danger/15 text-danger";
  return "bg-raised text-ink-secondary";
}

function accountStatusLabel(status: string | undefined, t: (source: string) => string): string {
  if (/^active$/i.test(status ?? "")) return t("Active");
  if (/^(expired|revoked)$/i.test(status ?? "")) return t("Expired — sign in again");
  if (/^(initializing|initiated|pending)$/i.test(status ?? "")) return t("Waiting for sign-in");
  if (/^(failed|error)$/i.test(status ?? "")) return t("Failed");
  return status || t("Unknown status");
}

function AccountRow({
  account,
  index,
  canRemove,
  busy,
  identityState,
  serviceLabel,
  onReconnect,
  onRemove,
  onSaveLabel,
}: {
  account: ConnectorAccount;
  index: number;
  canRemove: boolean;
  busy: boolean;
  identityState?: AccountIdentityState;
  serviceLabel: string;
  onReconnect: () => void;
  onRemove: () => void;
  onSaveLabel: (label: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState(account.label ?? "");
  const [saving, setSaving] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  useEffect(() => {
    setLabel(account.label ?? "");
    setLabelError(null);
  }, [account.id, account.label]);
  const identity = identityState?.identity?.trim() || "";
  const active = /^active$/i.test(account.status ?? "");
  const heading = account.label?.trim() || identity || `${t("Account")} ${index + 1}`;
  const save = async () => {
    setSaving(true);
    setLabelError(null);
    try {
      await onSaveLabel(label.trim());
    } catch (error) {
      setLabelError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-xl border border-hairline/40 bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13.5px] font-medium text-ink">{heading}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-medium", accountTone(account.status))}>
              {accountStatusLabel(account.status, t)}
            </span>
          </div>
          {identityState?.loading && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-secondary">
              <Loader2 size={11} className="animate-spin" /> {t("Checking the signed-in address…")}
            </div>
          )}
          {identity && (
            <div className="mt-0.5 truncate text-[11.5px] text-ink-secondary">
              {t("Signed in as")} <span className="font-medium text-ink">{identity}</span>
            </div>
          )}
          {!identity && !identityState?.loading && identityState?.reason && (
            <div className="mt-0.5 text-[11px] leading-relaxed text-warning">
              {t("Address unavailable: {reason}", { reason: identityState.reason })}
            </div>
          )}
          {!identity && !identityState?.loading && !identityState?.reason && !active && (
            <div className="mt-0.5 text-[11px] leading-relaxed text-ink-secondary/80">
              {t("The address is hidden until this account is active again.")}
            </div>
          )}
          <details className="mt-1.5">
            <summary className="cursor-pointer text-[10.5px] text-ink-secondary/60 hover:text-ink-secondary">
              {t("Technical details")}
            </summary>
            <div className="mt-1 space-y-0.5 break-all font-mono text-[10.5px] leading-relaxed text-ink-secondary/70">
              <div>{account.id}</div>
              {account.alias && <div>{account.alias}</div>}
            </div>
          </details>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!active && (
            <button
              type="button"
              onClick={onReconnect}
              disabled={busy || saving}
              className="flex items-center gap-1 rounded-lg bg-raised px-2 py-1.5 text-[11.5px] text-ink hover:bg-raised-hover disabled:opacity-40"
              title={t("Start a fresh sign-in. Remove this expired row after the new one works.")}
            >
              <RefreshCw size={12} /> {t("Sign in again")}
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    t("Remove the {service} account “{name}”? KodBot will lose access to it. You can connect it again later.", {
                      service: serviceLabel,
                      name: heading,
                    }),
                  )
                ) {
                  onRemove();
                }
              }}
              disabled={busy || saving}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] text-danger hover:bg-danger/10 disabled:opacity-40"
              title={t("Remove this account")}
              aria-label={t("Remove this account")}
            >
              <Trash2 size={13} /> {t("Remove")}
            </button>
          )}
        </div>
      </div>
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={account.alias || t("Add a friendly label")}
          maxLength={80}
          className="min-w-0 flex-1 rounded-lg border border-hairline/40 bg-inset px-2.5 py-1.5 text-[11.5px] text-ink placeholder:text-ink-secondary/70 focus:border-hairline focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || busy || label.trim() === (account.label ?? "")}
          className="rounded-lg bg-raised px-2.5 py-1.5 text-[11.5px] text-ink hover:bg-raised-hover disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : t("Save label")}
        </button>
      </form>
      {labelError && <div className="mt-1.5 text-[11px] text-danger">{labelError}</div>}
    </div>
  );
}

function AccountsHelp() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={t("About connected accounts")}
        aria-expanded={open}
        className="rounded-full p-0.5 text-ink-secondary/70 hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1.5 w-[320px] rounded-xl border border-hairline/60 bg-panel px-3 py-2.5 text-[11.5px] font-normal normal-case leading-relaxed tracking-normal text-ink-secondary shadow-2xl"
        >
          {t(
            "Each row is one connected account. Active means KodBot can use it. Expired means the sign-in has ended — remove that row, then connect the account again. Waiting for sign-in means the Google page is still open or unfinished. When the address is hidden, Google will reveal it after the account is active again.",
          )}
        </span>
      )}
    </span>
  );
}

function ServiceDetails({
  card,
  service,
  mode,
  busy,
  error,
  onClose,
  onConnect,
  onDisconnect,
  onRefresh,
  onRemoveAccount,
  onSaveLabel,
}: {
  card: ToolkitCard;
  service: ConnectorStatus | undefined;
  mode: "managed" | "self-hosted" | "unavailable";
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onRemoveAccount: (accountId: string) => void;
  onSaveLabel: (accountId: string, label: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const accounts = service?.accounts ?? [];
  const [identities, setIdentities] = useState<Record<string, AccountIdentityState>>({});
  const attemptedIdentities = useRef(new Set<string>());
  const accountKey = accounts.map((account) => `${account.id}:${account.status ?? ""}`).join("|");

  useEffect(() => {
    let alive = true;
    for (const account of accounts) {
      if (!/^active$/i.test(account.status ?? "") || attemptedIdentities.current.has(account.id)) continue;
      attemptedIdentities.current.add(account.id);
      setIdentities((current) => ({ ...current, [account.id]: { loading: true } }));
      void api(`/api/connectors/${encodeURIComponent(card.slug)}/accounts/${encodeURIComponent(account.id)}/identity`)
        .then((result: { identity?: string | null; reason?: string }) => {
          if (!alive) return;
          setIdentities((current) => ({
            ...current,
            [account.id]: { identity: result.identity ?? null, reason: result.reason },
          }));
        })
        .catch((error) => {
          if (!alive) return;
          setIdentities((current) => ({
            ...current,
            [account.id]: {
              identity: null,
              reason: error instanceof Error ? error.message : String(error),
            },
          }));
        });
    }
    return () => {
      alive = false;
    };
  }, [accountKey, card.slug]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-details-title"
        className="animate-pop-in flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-[600px] flex-col overflow-hidden rounded-[22px] border border-hairline/50 bg-panel shadow-2xl shadow-black/50"
      >
        <header className="flex items-start gap-3 border-b border-hairline/40 px-5 py-4">
          <ServiceIcon card={card} />
          <div className="min-w-0 flex-1">
            <h3 id="service-details-title" className="truncate text-[18px] font-semibold text-ink">
              {card.label}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-secondary">
              <span className={cn("rounded-full px-2 py-0.5 font-medium", accountTone(service?.status))}>
                {service?.status || (service?.connected ? t("Connected") : t("Not connected"))}
              </span>
              {accounts.length > 0 && <span>{t("{count} account(s)", { count: accounts.length })}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            autoFocus
            aria-label={t("Close details")}
            className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>
        {error && (
          <div role="alert" className="mx-5 mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-secondary">
              <span>{t("Accounts")}</span>
              <AccountsHelp />
            </div>
            <button
              onClick={onRefresh}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] text-ink-secondary hover:bg-raised hover:text-ink disabled:opacity-40"
            >
              <RefreshCw size={12} /> {t("Refresh")}
            </button>
          </div>
          {accounts.length ? (
            <div className="space-y-2">
              {accounts.map((account, index) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  index={index}
                  canRemove={mode !== "unavailable"}
                  busy={busy}
                  identityState={identities[account.id]}
                  serviceLabel={card.label}
                  onReconnect={onConnect}
                  onRemove={() => onRemoveAccount(account.id)}
                  onSaveLabel={(label) => onSaveLabel(account.id, label)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-hairline/50 px-4 py-8 text-center text-[12.5px] text-ink-secondary">
              {t("No account details are visible yet. Connect an account to see it here.")}
            </div>
          )}
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-secondary/80">
            {t("Labels are stored only in KodBot. Removing a row revokes KodBot's access to that connection; it does not delete the Google account.")}
          </p>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline/40 bg-panel/60 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onConnect}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <UserPlus size={14} /> {t("Add another account")}
            </button>
            <button
              onClick={onRefresh}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-raised px-3 py-2 text-[12.5px] text-ink hover:bg-raised-hover disabled:opacity-50"
            >
              <RefreshCw size={14} /> {t("Refresh")}
            </button>
          </div>
          <button
            onClick={onDisconnect}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            <Trash2 size={14} /> {t("Disconnect app")}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function PluginsPanel() {
  const { state, dispatch } = useStore();
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<ToolkitCard[] | null>(null);
  const [source, setSource] = useState<"api" | "curated">("curated");
  const [configured, setConfigured] = useState(true);
  const [mode, setMode] = useState<"managed" | "self-hosted" | "unavailable">("unavailable");
  const [status, setStatus] = useState<Record<string, ConnectorStatus>>({});
  const [pendingUrls, setPendingUrls] = useState<Record<string, string>>({});
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(state.pluginsQuery);
  const [tab, setTab] = useState<"marketplace" | "connected">("marketplace");
  const [detailsSlug, setDetailsSlug] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<{ card: ToolkitCard; x: number; y: number } | null>(null);

  const pollTimers = useRef(new Map<string, ReturnType<typeof setInterval>>());
  const statusGenerations = useRef(new Map<string, number>());

  // Global search opens this panel with the chosen app name.
  useEffect(() => {
    if (state.pluginsQuery) setSearch(state.pluginsQuery);
  }, [state.pluginsQuery]);

  const refreshStatus = useCallback((slugs: string[]): Promise<Record<string, ConnectorStatus>> => {
    if (!slugs.length) return Promise.resolve({});
    const requestGenerations = new Map(slugs.map((slug) => [slug, statusGenerations.current.get(slug) ?? 0]));
    setRefreshing(true);
    return api(`/api/connectors?services=${slugs.join(",")}`)
      .then((r) => {
        const services: Record<string, ConnectorStatus> = r.services ?? {};
        // A one-service OAuth poll must not erase every other app's state.
        // A request that began before Connect must also not erase the newer
        // local INITIATED state when its stale not_connected result arrives.
        setStatus((current) => mergeCurrentConnectorStatus(
          current,
          services,
          statusGenerations.current,
          requestGenerations,
        ));
        for (const [slug, state] of Object.entries(services)) {
          const isCurrent = (statusGenerations.current.get(slug) ?? 0) === (requestGenerations.get(slug) ?? 0);
          if (isCurrent && state.connected) setPendingUrls((current) => {
            if (!current[slug]) return current;
            const next = { ...current };
            delete next[slug];
            return next;
          });
        }
        return services;
      })
      .catch(() => ({}))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => () => {
    for (const timer of pollTimers.current.values()) clearInterval(timer);
    pollTimers.current.clear();
  }, []);

  useEffect(() => {
    let alive = true;
    api("/api/connectors/catalog")
      .then((r) => {
        if (!alive) return;
        setCards(r.cards ?? []);
        setSource(r.source ?? "curated");
        setConfigured(Boolean(r.configured));
        setMode(r.mode ?? "unavailable");
        if (r.configured) void refreshStatus((r.cards ?? []).map((c: ToolkitCard) => c.slug).slice(0, 40));
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [refreshStatus]);

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    if (!detailsSlug) (dialog?.querySelector<HTMLElement>("input") ?? focusable()[0] ?? dialog)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (detailsSlug) {
          setDetailsSlug(null);
          return;
        }
        dispatch({ type: "togglePlugins", open: false });
        return;
      }
      if (event.key !== "Tab" || !dialog || detailsSlug) return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      returnFocus?.focus();
    };
  }, [dispatch, detailsSlug]);

  const openConnectUrl = async (url: string) => {
    if (window.ogb?.openExternal) {
      await window.ogb.openExternal(url);
      return;
    }
    // Browser development fallback. If a popup blocker rejects the first
    // asynchronous open, the visible Continue button retries from a direct
    // user gesture using the URL retained in pendingUrls.
    const opened = window.open("", "_blank");
    if (!opened) throw new Error(t("Your browser blocked the connection page. Click Continue to open it."));
    // Open a same-origin blank page first so the OAuth origin never receives
    // an opener reference, while a real null remains a reliable blocked signal.
    opened.opener = null;
    opened.location.replace(url);
  };

  const startPolling = (slug: string) => {
    const old = pollTimers.current.get(slug);
    if (old) clearInterval(old);
    let tries = 0;
    const timer = setInterval(() => {
      void refreshStatus([slug]).then((services) => {
        const state = services[slug];
        if (++tries >= 24 || state?.connected || (state?.status && /^(expired|failed)$/i.test(state.status))) {
          clearInterval(timer);
          pollTimers.current.delete(slug);
        }
      });
    }, 5000);
    pollTimers.current.set(slug, timer);
  };

  const connect = async (slug: string) => {
    statusGenerations.current.set(slug, (statusGenerations.current.get(slug) ?? 0) + 1);
    setBusySlug(slug);
    setError(null);
    try {
      const { url } = await api(`/api/connectors/${slug}/authorize`, { method: "POST" });
      setPendingUrls((current) => ({ ...current, [slug]: url }));
      setStatus((current) => ({ ...current, [slug]: { connected: false, pending: true, status: "INITIATED" } }));
      startPolling(slug);
      await openConnectUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlug(null);
    }
  };

  const disconnect = (slug: string) => {
    setBusySlug(slug);
    api(`/api/connectors/${slug}`, { method: "DELETE" })
      .then(() => {
        setDetailsSlug(null);
        return refreshStatus([slug]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusySlug(null));
  };

  const removeAccount = (slug: string, accountId: string) => {
    setBusySlug(slug);
    setError(null);
    api(`/api/connectors/${slug}/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" })
      .then(() => refreshStatus([slug]))
      .catch((e) => setError(e.message))
      .finally(() => setBusySlug(null));
  };

  const saveAccountLabel = async (slug: string, accountId: string, label: string) => {
    await api(`/api/connectors/${slug}/accounts/${encodeURIComponent(accountId)}`, {
      method: "PATCH",
      body: JSON.stringify({ label }),
    });
    setStatus((current) => ({
      ...current,
      [slug]: {
        ...current[slug],
        accounts: current[slug]?.accounts?.map((account) =>
          account.id === accountId ? { ...account, label: label || undefined } : account,
        ),
      },
    }));
  };

  const matching = (cards ?? []).filter(
    (c) => !search || `${c.label} ${c.slug} ${c.blurb}`.toLowerCase().includes(search.toLowerCase()),
  );
  const visible = matching.filter(
    (card) =>
      tab === "marketplace" ||
      status[card.slug]?.connected ||
      (status[card.slug]?.accounts?.length ?? 0) > 0,
  );
  const connectedCount = Object.values(status).filter((service) => service.connected).length;
  const detailsCard = detailsSlug ? (cards ?? []).find((card) => card.slug === detailsSlug) : undefined;
  const detailsStatus = detailsSlug ? status[detailsSlug] : undefined;
  const close = () => dispatch({ type: "togglePlugins", open: false });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connected-apps-title"
        tabIndex={-1}
        className="animate-pop-in flex h-[min(780px,calc(100dvh-2rem))] w-full max-w-[1040px] flex-col overflow-hidden rounded-[24px] border border-hairline/50 bg-panel shadow-2xl shadow-black/50"
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-6 sm:px-8 sm:pt-7">
          <div>
            <h2 id="connected-apps-title" className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{t("Connected apps")}</h2>
            <p className="mt-1 text-[13px] text-ink-secondary">{t("Connect the apps your bots can use.")}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refreshStatus(matching.map((c) => c.slug).slice(0, 40))}
              className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"
              title={t("Refresh connection status")}
            >
              <RefreshCw size={17} className={cn(refreshing && "animate-spin")} />
            </button>
            <button
              onClick={close}
              aria-label={t("Close connected apps")}
              className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink"
            >
              <X size={21} />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-3 px-6 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex w-fit rounded-xl bg-raised/70 p-1" role="tablist" aria-label={t("Connected apps view")}>
            <button
              role="tab"
              aria-selected={tab === "marketplace"}
              onClick={() => setTab("marketplace")}
              className={cn(
                "rounded-lg px-4 py-2 text-[13.5px] transition-colors",
                tab === "marketplace" ? "bg-card text-ink shadow-sm" : "text-ink-secondary hover:text-ink",
              )}
            >
              {t("Marketplace")}
            </button>
            <button
              role="tab"
              aria-selected={tab === "connected"}
              onClick={() => setTab("connected")}
              className={cn(
                "rounded-lg px-4 py-2 text-[13.5px] transition-colors",
                tab === "connected" ? "bg-card text-ink shadow-sm" : "text-ink-secondary hover:text-ink",
              )}
            >
              {t("Connected tab")}{connectedCount > 0 ? ` ${connectedCount}` : ""}
            </button>
          </div>
          <label className="flex h-11 w-full items-center gap-2.5 rounded-xl bg-raised/70 px-3.5 sm:w-[320px]">
            <Search size={17} className="shrink-0 text-ink-secondary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Search apps")}
              aria-label={t("Search apps")}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-secondary focus:outline-none"
            />
          </label>
        </div>

        {!configured && (
          <div className="mx-6 mb-1 rounded-xl bg-warning/10 px-4 py-3 text-[13px] text-warning sm:mx-8">
            {t("Connected apps are temporarily unavailable. You can retry after restarting, or configure your own connection service.")}{" "}
            <button
              className="font-medium underline underline-offset-2"
              onClick={() => {
                close();
                dispatch({ type: "toggleAppSettings", open: true, section: "connections" });
              }}
            >
              {t("Open settings")}
            </button>
          </div>
        )}
        {configured && source === "curated" && mode === "self-hosted" && (
          <div className="mx-6 mb-1 text-[12px] text-ink-secondary sm:mx-8">
            {t("Showing featured apps.")}{" "}
            <button
              className="underline underline-offset-2 hover:text-ink"
              onClick={() => {
                close();
                dispatch({ type: "toggleAppSettings", open: true, section: "connections" });
              }}
            >
              {t("Update your Composio key")}
            </button>{" "}
            {t("for the full catalog.")}
          </div>
        )}
        {error && <div role="alert" className="mx-6 mt-2 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger sm:mx-8">{error}</div>}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-5 sm:px-8">
          {cards === null ? (
            <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-ink-secondary">
              <Loader2 size={14} className="animate-spin" /> {t("Loading catalog…")}
            </div>
          ) : (
            <div>
              <div className="mb-3 text-[12px] font-medium text-ink-secondary">
                {tab === "connected" ? t("Your connections") : search ? t("Search results") : t("Available apps")}
              </div>
              <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              {visible.map((card) => {
              const serviceStatus = status[card.slug];
              const connected = serviceStatus?.connected;
              const pending = serviceStatus?.pending;
              const failed = serviceStatus?.status && /^(expired|failed)$/i.test(serviceStatus.status);
              const accounts = serviceStatus?.accounts ?? [];
              const hasAccounts = accounts.length > 0;
              const showDetails = Boolean(connected || hasAccounts);
              const busy = busySlug === card.slug;
              return (
                <div
                  key={card.slug}
                  className="flex min-h-[88px] items-center gap-3 border-b border-hairline/35 px-1 py-4"
                >
                  <ServiceIcon card={card} />
                  <div
                    className="min-w-0 flex-1 cursor-help"
                    onMouseEnter={(event) => setHoveredCard({ card, x: event.clientX, y: event.clientY })}
                    onMouseMove={(event) => setHoveredCard({ card, x: event.clientX, y: event.clientY })}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-[14px] font-medium text-ink">{card.label}</div>
                      {connected && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                          <Check size={10} />
                          {accounts.length > 1 ? `${accounts.length}` : t("Connected")}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] text-ink-secondary">
                      {pending
                        ? t("Finish setup in your browser")
                        : failed
                          ? t("Authorization expired — open details")
                          : connected
                            ? t("{count} active account(s)", {
                                count: accounts.filter((account) => /^active$/i.test(account.status ?? "")).length || 1,
                              })
                            : hasAccounts
                              ? t("Accounts need attention — open details")
                              : card.blurb}
                    </div>
                  </div>
                  <button
                    disabled={!configured || busy}
                    onClick={() => {
                      if (showDetails) setDetailsSlug(card.slug);
                      else if (pending && pendingUrls[card.slug]) {
                        setError(null);
                        void openConnectUrl(pendingUrls[card.slug]).catch((e) => setError(e.message));
                      } else void connect(card.slug);
                    }}
                    className={cn(
                      "flex min-w-[88px] items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] transition-colors disabled:opacity-40",
                      showDetails
                        ? "bg-raised text-ink hover:bg-raised-hover"
                        : "bg-accent text-white hover:brightness-110",
                    )}
                    title={showDetails ? t("View account details") : undefined}
                  >
                    {busy ? (
                      <Loader2 size={13} className="mx-auto animate-spin" />
                    ) : showDetails ? (
                      <><Info size={14} /> {t("Details")} <ChevronRight size={13} /></>
                    ) : pending ? (
                      t("Continue")
                    ) : failed ? (
                      t("Retry")
                    ) : (
                      t("Connect")
                    )}
                  </button>
                </div>
              );
              })}
              </div>
            </div>
          )}
          {cards !== null && visible.length === 0 && (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <div className="text-[14px] font-medium text-ink">
                {tab === "connected" ? t("No connected apps yet") : t("No apps found")}
              </div>
              <div className="mt-1 text-[12.5px] text-ink-secondary">
                {tab === "connected" ? t("Connect an app from Marketplace and it will appear here.") : t("Try a different search.")}
              </div>
            </div>
          )}
        </div>
      </div>
      {detailsCard && (
        <ServiceDetails
          key={detailsCard.slug}
          card={detailsCard}
          service={detailsStatus}
          mode={mode}
          busy={busySlug === detailsCard.slug}
          error={error}
          onClose={() => setDetailsSlug(null)}
          onConnect={() => void connect(detailsCard.slug)}
          onDisconnect={() => {
            if (window.confirm(t("Disconnect every account for {name}?", { name: detailsCard.label }))) {
              disconnect(detailsCard.slug);
            }
          }}
          onRefresh={() => void refreshStatus([detailsCard.slug])}
          onRemoveAccount={(accountId) => removeAccount(detailsCard.slug, accountId)}
          onSaveLabel={(accountId, label) => saveAccountLabel(detailsCard.slug, accountId, label)}
        />
      )}
      {hoveredCard && (
        <div
          role="tooltip"
          style={{
            left: Math.max(12, Math.min(hoveredCard.x + 14, window.innerWidth - 352)),
            top: Math.max(12, Math.min(hoveredCard.y + 14, window.innerHeight - 280)),
          }}
          className="pointer-events-none fixed z-[80] w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-hairline/60 bg-panel px-3.5 py-3 text-left shadow-2xl shadow-black/50"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[13px] font-semibold text-ink">{hoveredCard.card.label}</div>
            {hoveredCard.card.domain && (
              <div className="shrink-0 text-[10.5px] text-ink-secondary/60">{hoveredCard.card.domain}</div>
            )}
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-secondary">
            {hoveredCard.card.description?.trim() || hoveredCard.card.blurb}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-secondary/70">
            {t("Connect this app to let bots use its tools.")}
          </p>
        </div>
      )}
    </div>
  );
}
