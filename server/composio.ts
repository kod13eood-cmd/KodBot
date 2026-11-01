// A project API key (ak_…) creates/reuses one Composio Session. That
// Session owns connection state, auth links and the MCP endpoint.
import { saveConfig, type AppConfig } from "./config.ts";
import { randomUUID } from "node:crypto";
import { SPAWNED_PROXIES } from "./proxy-paths.ts";

const DEFAULT_BACKEND_ORIGIN = "https://backend.composio.dev";

function apiBase() {
  return (process.env.OC_COMPOSIO_API ?? `${DEFAULT_BACKEND_ORIGIN}/api/v3.1`).replace(/\/$/, "");
}

function toolkitBase() {
  return (process.env.OC_COMPOSIO_TOOLKITS_API ?? `${DEFAULT_BACKEND_ORIGIN}/api/v3`).replace(/\/$/, "");
}

interface SessionResponse {
  session_id: string;
  mcp: { type: "http" | "sse"; url: string };
  config?: { user_id?: string };
}

export interface ComposioMcpIntegration {
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface IntegrationContext {
  harnessUrl: string;
  commsToken: string;
  botId: string;
  threadId: string;
}

function brokerAccess(): { url: string; token: string } | null {
  const url = process.env.OC_COMPOSIO_BROKER_URL?.trim().replace(/\/$/, "");
  const token = process.env.OC_COMPOSIO_BROKER_TOKEN?.trim();
  if (!url || !token) return null;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("The connected-apps service must use HTTPS");
  }
  return { url, token };
}

export function connectionMode(cfg: AppConfig): "managed" | "self-hosted" | "unavailable" {
  if (brokerAccess()) return "managed";
  return cfg.composio?.apiKey ? "self-hosted" : "unavailable";
}

export function configured(cfg: AppConfig): boolean {
  return connectionMode(cfg) !== "unavailable";
}

async function brokerRequest(path: string, init?: RequestInit): Promise<Response> {
  const broker = brokerAccess();
  if (!broker) throw new Error("The connected-apps service is unavailable");
  return fetch(`${broker.url}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${broker.token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });
}

function projectHeaders(apiKey: string, json = false) {
  return {
    "x-api-key": apiKey,
    ...(json ? { "content-type": "application/json" } : {}),
  };
}

async function responseError(res: Response, fallback: string) {
  const raw = await res.text().catch(() => "");
  try {
    const body = JSON.parse(raw);
    return String(body?.message ?? body?.error?.message ?? body?.error ?? fallback);
  } catch {
    return raw.trim().slice(0, 300) || fallback;
  }
}

function trustedAuthUrl(value: unknown, slug: string): string {
  if (typeof value !== "string") throw new Error(`Connected-apps service returned no authorization link for ${slug}`);
  const url = new URL(value);
  if (url.protocol !== "https:" || (url.hostname !== "composio.dev" && !url.hostname.endsWith(".composio.dev"))) {
    throw new Error("Connected-apps service returned an untrusted authorization link");
  }
  return url.toString();
}

async function getProjectSession(apiKey: string, sessionId: string): Promise<SessionResponse | null> {
  const res = await fetch(`${apiBase()}/tool_router/session/${encodeURIComponent(sessionId)}`, {
    headers: projectHeaders(apiKey),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await responseError(res, `Composio session: HTTP ${res.status}`));
  return (await res.json()) as SessionResponse;
}

/** Validate a project key and return one reusable Session for this install. */
export async function prepareProjectSession(
  apiKey: string,
  current?: { apiKey?: string; userId?: string; sessionId?: string },
): Promise<{ apiKey: string; userId: string; sessionId: string }> {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("Enter a Composio project API key");
  if (!trimmed.startsWith("ak_")) throw new Error("Composio project API keys start with ak_");

  if (trimmed === current?.apiKey && current.sessionId) {
    const existing = await getProjectSession(trimmed, current.sessionId);
    if (existing) {
      return {
        apiKey: trimmed,
        userId: existing.config?.user_id ?? current.userId ?? `opencrew_${randomUUID()}`,
        sessionId: existing.session_id,
      };
    }
  }

  const userId = current?.userId ?? `opencrew_${randomUUID()}`;
  const res = await fetch(`${apiBase()}/tool_router/session`, {
    method: "POST",
    headers: projectHeaders(trimmed, true),
    body: JSON.stringify({
      user_id: userId,
      manage_connections: {
        enable: true,
        enable_wait_for_connections: true,
        enable_connection_removal: true,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(await responseError(res, `Composio rejected this key (HTTP ${res.status})`));
  const session = (await res.json()) as SessionResponse;
  if (!session.session_id || !session.mcp?.url) throw new Error("Composio created an incomplete Session");
  return { apiKey: trimmed, userId, sessionId: session.session_id };
}

async function ensureProjectSession(cfg: AppConfig): Promise<SessionResponse> {
  const composio = cfg.composio;
  if (!composio?.apiKey) throw new Error("No Composio project key configured");
  if (composio.sessionId) {
    const existing = await getProjectSession(composio.apiKey, composio.sessionId);
    if (existing) return existing;
  }
  // A missing/deleted session is recreated and its non-secret identifiers are
  // persisted so an edited config/env setup does not recreate it every launch.
  const prepared = await prepareProjectSession(composio.apiKey, composio);
  composio.userId = prepared.userId;
  composio.sessionId = prepared.sessionId;
  saveConfig({ composio: { userId: prepared.userId, sessionId: prepared.sessionId } });
  const created = await getProjectSession(composio.apiKey, prepared.sessionId);
  if (!created) throw new Error("Composio Session disappeared after creation");
  return created;
}

export async function mcpIntegration(
  cfg: AppConfig,
  context: IntegrationContext,
): Promise<ComposioMcpIntegration | null> {
  if (!configured(cfg)) return null;
  return {
    command: process.execPath,
    args: [SPAWNED_PROXIES.connectors],
    env: {
      ELECTRON_RUN_AS_NODE: "1",
      // The provider-facing bridge receives only this boot's loopback token.
      // Project/broker credentials stay in the harness process, so a coding
      // agent that prints its environment cannot export a durable secret.
      OC_CONNECTOR_UPSTREAM_URL: `${context.harnessUrl}/api/internal/connectors/mcp`,
      OC_CONNECTOR_UPSTREAM_HEADERS: JSON.stringify({ authorization: `Bearer ${context.commsToken}` }),
      OC_HARNESS_URL: context.harnessUrl,
      OC_COMMS_TOKEN: context.commsToken,
      OC_BOT_ID: context.botId,
      OC_THREAD_ID: context.threadId,
    },
  };
}

export async function relayMcp(
  cfg: AppConfig,
  payload: unknown,
  transportSessionId?: string,
): Promise<{ status: number; bytes: Uint8Array; contentType: string; transportSessionId?: string }> {
  const broker = brokerAccess();
  let url: string;
  const headers = new Headers({
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  });
  if (transportSessionId) headers.set("mcp-session-id", transportSessionId);
  if (broker) {
    url = `${broker.url}/v1/mcp`;
    headers.set("authorization", `Bearer ${broker.token}`);
  } else {
    if (!cfg.composio?.apiKey) throw new Error("Connected apps are unavailable");
    const session = await ensureProjectSession(cfg);
    url = session.mcp.url;
    headers.set("x-api-key", cfg.composio.apiKey);
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10 * 60_000),
  });
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > 20 * 1024 * 1024) throw new Error("Connected-app response exceeded 20 MB");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("Connected-app response exceeded 20 MB");
  return {
    status: response.status,
    bytes,
    contentType: response.headers.get("content-type") ?? "application/json",
    transportSessionId: response.headers.get("mcp-session-id") ?? undefined,
  };
}

/** Connection status per service slug: { slack: { connected, status, accounts } }. */
export async function connectionStatus(cfg: AppConfig, slugs: string[]) {
  if (brokerAccess() || !cfg.composio?.apiKey) {
    const response = await brokerRequest(`/v1/connectors?${new URLSearchParams({ services: slugs.join(",") })}`);
    if (!response.ok) throw new Error(await responseError(response, `Connected apps: HTTP ${response.status}`));
    const body = (await response.json()) as {
      services?: Record<
        string,
        {
          connected: boolean;
          pending?: boolean;
          status?: string;
          accounts?: Array<{ id?: string; status?: string; alias?: string }>;
        }
      >;
    };
    return body.services ?? {};
  }
  const session = await ensureProjectSession(cfg);
  const params = new URLSearchParams({ limit: "50" });
  if (slugs.length) params.set("toolkits", slugs.join(","));
  const userId = session.config?.user_id ?? cfg.composio.userId;
  const [res, accounts] = await Promise.all([
    fetch(`${apiBase()}/tool_router/session/${encodeURIComponent(session.session_id)}/toolkits?${params}`, {
      headers: projectHeaders(cfg.composio.apiKey),
      signal: AbortSignal.timeout(15_000),
    }),
    // Session toolkits only include an account once it is usable. Read the
    // account lifecycle too so the UI can distinguish an OAuth flow that is
    // still waiting in the browser from one that expired or failed. Scoped
    // keys may omit connected-account read permission, so this is additive:
    // the normal session result remains the fallback.
    userId
      ? fetch(
          `${apiBase()}/connected_accounts?${new URLSearchParams({ limit: "50", user_ids: userId })}`,
          { headers: projectHeaders(cfg.composio.apiKey), signal: AbortSignal.timeout(15_000) },
        )
          .then(async (accountRes) => {
            if (!accountRes.ok) return [];
            const accountBody = (await accountRes.json()) as {
              items?: Array<{
                id?: string;
                toolkit?: { slug?: string };
                status?: string;
                alias?: string;
                updated_at?: string;
              }>;
            };
            return Array.isArray(accountBody?.items) ? accountBody.items : [];
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  if (!res.ok) throw new Error(await responseError(res, `Composio toolkits: HTTP ${res.status}`));
  const body = (await res.json()) as {
    items?: Array<{ slug?: string; is_no_auth?: boolean; connected_account?: { id?: string; status?: string } }>;
  };
  const bySlug = new Map((body.items ?? []).map((item) => [item.slug?.toLowerCase(), item]));
  const accountsBySlug = new Map<
    string,
    Array<{ id?: string; status?: string; alias?: string; updated_at?: string }>
  >();
  for (const account of accounts) {
    const slug = account.toolkit?.slug?.toLowerCase();
    if (!slug || !slugs.some((candidate) => candidate.toLowerCase() === slug)) continue;
    const list = accountsBySlug.get(slug) ?? [];
    list.push(account);
    accountsBySlug.set(slug, list);
  }
  return Object.fromEntries(
    slugs.map((slug) => {
      const item = bySlug.get(slug.toLowerCase());
      const serviceAccounts = accountsBySlug.get(slug.toLowerCase()) ?? [];
      const state =
        item?.connected_account?.status
        ?? (item?.is_no_auth ? "ACTIVE" : serviceAccounts[0]?.status ?? "not_connected");
      return [
        slug,
        {
          connected: item?.is_no_auth === true || /^active$/i.test(state),
          pending: /^(initiated|initializing|pending)$/i.test(state),
          status: state,
          accounts: serviceAccounts.map((account) => ({
            id: account.id,
            status: account.status,
            alias: account.alias,
          })),
        },
      ];
    }),
  );
}

/** Delete one connected account by id. The managed broker does not expose
 * per-account deletion yet; callers should hide that action in managed mode. */
export async function removeAccount(cfg: AppConfig, slug: string, accountId: string) {
  if (brokerAccess() || !cfg.composio?.apiKey) {
    throw new Error("The managed connected-apps service can only remove the app connection.");
  }
  const session = await ensureProjectSession(cfg);
  const userId = session.config?.user_id ?? cfg.composio.userId;
  if (userId) {
    const params = new URLSearchParams({ limit: "50", toolkits: slug, user_ids: userId });
    const list = await fetch(`${apiBase()}/connected_accounts?${params}`, {
      headers: projectHeaders(cfg.composio.apiKey),
      signal: AbortSignal.timeout(15_000),
    });
    if (list.ok) {
      const body = (await list.json()) as { items?: Array<{ id?: string; toolkit?: { slug?: string } }> };
      const owned = (body.items ?? []).some(
        (item) => item.id === accountId && item.toolkit?.slug?.toLowerCase() === slug.toLowerCase(),
      );
      if (!owned) throw new Error("That account is not connected to this service.");
    }
  }
  const removed = await fetch(
    `${apiBase()}/connected_accounts/${encodeURIComponent(accountId)}?revoke_on_delete=true`,
    { method: "DELETE", headers: projectHeaders(cfg.composio.apiKey), signal: AbortSignal.timeout(30_000) },
  );
  if (!removed.ok) throw new Error(await responseError(removed, `Composio disconnect: HTTP ${removed.status}`));
  return { removed: 1 };
}

/** Disconnect a service: remove every connected account for the slug. The
 * managed broker deletes one account per call, so keep going until none are
 * left. The cap is a safety net, not an expected account count. */
export async function removeService(cfg: AppConfig, slug: string) {
  let removed = 0;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await removeServiceOnce(cfg, slug);
    if (!result.removed) break;
    removed += result.removed;
  }
  return { removed };
}

async function removeServiceOnce(cfg: AppConfig, slug: string) {
  if (brokerAccess() || !cfg.composio?.apiKey) {
    const response = await brokerRequest(`/v1/connectors/${encodeURIComponent(slug)}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await responseError(response, `Connected apps: HTTP ${response.status}`));
    return response.json() as Promise<{ removed: number }>;
  }
  const session = await ensureProjectSession(cfg);
  const params = new URLSearchParams({ limit: "50", toolkits: slug });
  const list = await fetch(
    `${apiBase()}/tool_router/session/${encodeURIComponent(session.session_id)}/toolkits?${params}`,
    { headers: projectHeaders(cfg.composio.apiKey), signal: AbortSignal.timeout(15_000) },
  );
  if (!list.ok) throw new Error(await responseError(list, `Composio toolkits: HTTP ${list.status}`));
  const body = (await list.json()) as { items?: Array<{ slug?: string; connected_account?: { id?: string } }> };
  const id = body.items?.find((item) => item.slug?.toLowerCase() === slug.toLowerCase())?.connected_account?.id;
  if (!id) return { removed: 0 };
  const removed = await fetch(
    `${apiBase()}/connected_accounts/${encodeURIComponent(id)}?revoke_on_delete=true`,
    { method: "DELETE", headers: projectHeaders(cfg.composio.apiKey), signal: AbortSignal.timeout(30_000) },
  );
  if (!removed.ok) throw new Error(await responseError(removed, `Composio disconnect: HTTP ${removed.status}`));
  return { removed: 1 };
}

/** Mint a browser auth link for one service. Returns { url } or throws. */
export async function authorizeService(cfg: AppConfig, slug: string) {
  if (brokerAccess() || !cfg.composio?.apiKey) {
    const response = await brokerRequest(`/v1/connectors/${encodeURIComponent(slug)}/authorize`, { method: "POST" });
    if (!response.ok) throw new Error(await responseError(response, `Connected apps: HTTP ${response.status}`));
    const body = (await response.json()) as { url?: string };
    return { url: trustedAuthUrl(body.url, slug) };
  }
  const session = await ensureProjectSession(cfg);
  const res = await fetch(`${apiBase()}/tool_router/session/${encodeURIComponent(session.session_id)}/link`, {
    method: "POST",
    headers: projectHeaders(cfg.composio.apiKey, true),
    body: JSON.stringify({ toolkit: slug }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(await responseError(res, `Composio authorization: HTTP ${res.status}`));
  const body = (await res.json()) as { redirect_url?: string };
  return { url: trustedAuthUrl(body.redirect_url, slug) };
}

// ── marketplace catalog ────────────────────────────────────────────────
export interface ToolkitCard {
  slug: string;
  label: string;
  blurb: string;
  logo: string | null;
  /** used for the client-side favicon fallback when logo is null/broken */
  domain: string | null;
}

// Curated fallback — the services agentcal's connectors page ships plus the
// long marketplace tail. Logos resolve client-side:
// logo → favicon(domain) → monogram.
const CURATED: ToolkitCard[] = [
  { slug: "slack", label: "Slack", blurb: "Post updates and read channels", domain: "slack.com", logo: null },
  { slug: "github", label: "GitHub", blurb: "Issues, pull requests, and code", domain: "github.com", logo: null },
  { slug: "gmail", label: "Gmail", blurb: "Read and send email", domain: "gmail.com", logo: null },
  { slug: "googlecalendar", label: "Google Calendar", blurb: "Read and create events", domain: "calendar.google.com", logo: null },
  { slug: "googlesheets", label: "Google Sheets", blurb: "Read and update spreadsheets", domain: "sheets.google.com", logo: null },
  { slug: "googledocs", label: "Google Docs", blurb: "Read and write documents", domain: "docs.google.com", logo: null },
  { slug: "googledrive", label: "Google Drive", blurb: "Browse and manage files", domain: "drive.google.com", logo: null },
  { slug: "notion", label: "Notion", blurb: "Pages and databases", domain: "notion.so", logo: null },
  { slug: "linear", label: "Linear", blurb: "Issues and project tracking", domain: "linear.app", logo: null },
  { slug: "sentry", label: "Sentry", blurb: "Errors and alerts", domain: "sentry.io", logo: null },
  { slug: "posthog", label: "PostHog", blurb: "Analytics, feature flags, experiments", domain: "posthog.com", logo: null },
  { slug: "discord", label: "Discord", blurb: "Messages and channels", domain: "discord.com", logo: null },
  { slug: "x", label: "X (Twitter)", blurb: "Post and read on X", domain: "x.com", logo: null },
  { slug: "reddit", label: "Reddit", blurb: "Browse and post", domain: "reddit.com", logo: null },
  { slug: "zapier", label: "Zapier", blurb: "Connect 9,000+ apps", domain: "zapier.com", logo: null },
  { slug: "hubspot", label: "HubSpot", blurb: "CRM search & updates", domain: "hubspot.com", logo: null },
  { slug: "salesforce", label: "Salesforce", blurb: "CRM records and reports", domain: "salesforce.com", logo: null },
  { slug: "jira", label: "Jira", blurb: "Issues and sprints", domain: "atlassian.com", logo: null },
  { slug: "asana", label: "Asana", blurb: "Tasks and projects", domain: "asana.com", logo: null },
  { slug: "trello", label: "Trello", blurb: "Boards and cards", domain: "trello.com", logo: null },
  { slug: "dropbox", label: "Dropbox", blurb: "Files and folders", domain: "dropbox.com", logo: null },
  { slug: "airtable", label: "Airtable", blurb: "Bases and records", domain: "airtable.com", logo: null },
  { slug: "figma", label: "Figma", blurb: "Files and comments", domain: "figma.com", logo: null },
  { slug: "stripe", label: "Stripe", blurb: "Payments and customers", domain: "stripe.com", logo: null },
];

let toolkitCache: { at: number; cards: ToolkitCard[] } | null = null;

/**
 * Marketplace catalog. Tries the v3 toolkits API (official names,
 * descriptions, logos — cached 10 min); falls back to the curated list.
 */
export async function listToolkits(cfg: AppConfig): Promise<{ cards: ToolkitCard[]; source: "api" | "curated" }> {
  if (toolkitCache && Date.now() - toolkitCache.at < 10 * 60_000) {
    return { cards: toolkitCache.cards, source: "api" };
  }
  const backendKey = brokerAccess() ? undefined : cfg.composio?.apiKey;
  if (backendKey || brokerAccess()) {
    try {
      const res = backendKey
        ? await fetch(`${toolkitBase()}/toolkits?limit=500&sort_by=usage`, {
            headers: { "x-api-key": backendKey },
            signal: AbortSignal.timeout(15_000),
          })
        : await brokerRequest("/v1/catalog", { signal: AbortSignal.timeout(15_000) });
      if (res.ok) {
        const json: any = await res.json();
        const items = json.items ?? json.data ?? [];
        if (Array.isArray(items) && items.length) {
          const cards: ToolkitCard[] = items.map((t: any) => ({
            slug: (t.slug ?? t.key ?? t.name ?? "").toLowerCase(),
            label: t.name ?? t.slug ?? "",
            blurb: (t.meta?.description ?? t.description ?? "").slice(0, 90),
            logo: t.meta?.logo ?? t.logo ?? null,
            domain: null,
          }));
          toolkitCache = { at: Date.now(), cards };
          return { cards, source: "api" };
        }
      }
    } catch {
      /* fall through to curated */
    }
  }
  return { cards: CURATED, source: "curated" };
}

export async function toolkitCard(cfg: AppConfig, slug: string): Promise<ToolkitCard> {
  const normalized = slug.toLowerCase();
  const { cards } = await listToolkits(cfg);
  return cards.find((card) => card.slug.toLowerCase() === normalized)
    ?? CURATED.find((card) => card.slug === normalized)
    ?? {
      slug: normalized,
      label: normalized.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      blurb: "Connect this app so your bot can continue",
      logo: null,
      domain: null,
    };
}

export const CURATED_SLUGS = CURATED.map((c) => c.slug);
