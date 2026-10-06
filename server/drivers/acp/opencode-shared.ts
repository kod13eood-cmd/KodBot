// Shared OpenCode helpers. Both the Go-only engine (opencode-go.ts) and the
// unified Zen+Go engine (opencode.ts) run the maintained OpenCode CLI over its
// ACP stdio interface and reuse this module for catalog discovery, credential
// detection, local-inject config injection, and error classification.
//
// Zen and Go are two catalogs behind the same CLI and the same
// OPENCODE_API_KEY. The provider is carried in the model id (`opencode/<id>`
// vs `opencode-go/<id>`), so one unified engine can merge both catalogs and
// still select the exact model over ACP's `session/set_config_option`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { decodeInjectId, hostApiKey, localHost } from "../local-inject.ts";
import type { ModelCatalog, ProviderErrorCode } from "../../contracts.ts";

/** Zen provider id — models are addressed as `opencode/<id>`. */
export const OPENCODE_PROVIDER_ID = "opencode";
/** Go provider id — models are addressed as `opencode-go/<id>`. */
export const OPENCODE_GO_PROVIDER_ID = "opencode-go";

export type OpenCodeGroup = "Zen" | "Go";

/** Public, catalogue-only model endpoints. Both are non-billable. */
export const OPENCODE_CATALOG_URLS = {
  zen: "https://opencode.ai/zen/v1/models",
  go: "https://opencode.ai/zen/go/v1/models",
} as const;

const MODEL_ID = /^[a-z0-9][a-z0-9._-]*$/i;

/** Last-good catalog per endpoint, kept for the process lifetime. */
const lastCatalog = new Map<string, ModelCatalog>();

export function resetOpenCodeCatalogCache(url?: string) {
  if (url) lastCatalog.delete(url);
  else lastCatalog.clear();
}

export function labelForModel(id: string): string {
  return id
    .split(/[-_.]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Bare model id with any provider prefix removed. */
export function stripProviderPrefix(id: string): string {
  const slash = id.indexOf("/");
  return slash === -1 ? id : id.slice(slash + 1);
}

// Free / stealth models whose ids do not carry a "-free" suffix. The live
// catalog is authoritative; this list only seeds the offline fallback and the
// Free badge. Mutable by design — free lineups change.
export const KNOWN_FREE_MODEL_IDS: readonly string[] = [
  "big-pickle",
  "space-bunny-free",
  "longcat-2.5-preview-free",
  "jev-1.13-free",
];

export function isFreeModelId(id: string): boolean {
  const bare = stripProviderPrefix(id).toLowerCase();
  return bare.endsWith("-free") || KNOWN_FREE_MODEL_IDS.includes(bare);
}

// Curated "best free" preference order (bare ids, best first). The free lineup
// mutates, so this is a heuristic: the first present wins; otherwise any model
// flagged free; otherwise the catalog default. Re-rank here if quality shifts.
export const FREE_PREFERENCE: readonly string[] = [
  "nemotron-3-ultra-free",
  "mimo-v2.6-flash-free",
  "big-pickle",
  "mimo-v2.5-free",
  "longcat-2.5-preview-free",
  "space-bunny-free",
  "nemotron-3.5-lightning-free",
  "ling-3.1-flash-free",
  "ling-3.0-flash-fin-free",
  "fledge-alpha-free",
  "muse-spark-1.3-contributor-free",
  "jev-1.13-free",
];

/** The best available free model id, or undefined when none is free. */
export function pickBestFreeModel(options: ModelCatalog["options"]): string | undefined {
  for (const bare of FREE_PREFERENCE) {
    const hit = options.find((option) => stripProviderPrefix(option.id).toLowerCase() === bare);
    if (hit) return hit.id;
  }
  return options.find((option) => option.free)?.id;
}

function catalogIds(payload: unknown): string[] {
  const records = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : payload && typeof payload === "object" && Array.isArray((payload as { models?: unknown }).models)
        ? (payload as { models: unknown[] }).models
        : [];
  return records
    .map((record) =>
      typeof record === "string"
        ? record
        : record && typeof record === "object"
          ? (record as { id?: unknown }).id
          : undefined,
    )
    .filter((id): id is string => typeof id === "string" && MODEL_ID.test(id));
}

export interface OpenCodeProviderSpec {
  url: string;
  providerId: string;
  group: OpenCodeGroup;
  /** Pinned options kept visible when the live catalog is unreachable. */
  fallback: ModelCatalog;
  fetcher?: typeof fetch;
}

/**
 * Fetch one OpenCode provider catalog and normalize it to provider-qualified
 * ids tagged with their group and free status. All discovered models are
 * OFFICIAL (not `custom`); local-inject adds `custom` rows separately.
 *
 * Fail-safe: short timeout, shape validation, last-good cache, pinned
 * fallback. Never makes a paid inference request.
 */
export async function fetchOpenCodeProviderModels(spec: OpenCodeProviderSpec): Promise<ModelCatalog> {
  const fetcher = spec.fetcher ?? fetch;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    timeout.unref?.();
    try {
      const response = await fetcher(spec.url, { signal: controller.signal });
      if (!response.ok) throw new Error(`catalog HTTP ${response.status}`);
      const ids = catalogIds(await response.json());
      if (!ids.length) throw new Error("catalog contained no valid models");
      const options: ModelCatalog["options"] = [];
      const seen = new Set<string>();
      for (const id of ids) {
        const full = `${spec.providerId}/${id}`;
        if (seen.has(full)) continue;
        seen.add(full);
        options.push({
          id: full,
          label: labelForModel(id),
          group: spec.group,
          ...(isFreeModelId(id) ? { free: true } : {}),
        });
      }
      for (const option of spec.fallback.options) {
        if (seen.has(option.id)) continue;
        seen.add(option.id);
        options.push({ ...option });
      }
      const catalog: ModelCatalog = { default: spec.fallback.default, options };
      lastCatalog.set(spec.url, catalog);
      return catalog;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return lastCatalog.get(spec.url) ?? spec.fallback;
  }
}

export const stripForeignProviderKeys = (env: Record<string, string | undefined>) => {
  for (const key of [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "XAI_API_KEY",
    "KIMI_API_KEY",
    "MOONSHOT_API_KEY",
  ]) delete env[key];
};

export function opencodeConfigDir(env: Record<string, string | undefined>): string {
  const home = env.HOME || env.USERPROFILE || homedir();
  return join(env.XDG_CONFIG_HOME || join(home, ".config"), "opencode");
}

/** Upsert an openai-compatible provider so OpenCode can select host/model. */
export function ensureOpenCodeInjectModel(
  modelId: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const inject = decodeInjectId(modelId);
  if (!inject) return modelId;
  const host = localHost(inject.host);
  if (!host) return modelId;

  const native = `${inject.host}/${inject.model}`;
  const dir = opencodeConfigDir(env);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "opencode.json");
  let config: Record<string, unknown> = { $schema: "https://opencode.ai/config.json" };
  if (existsSync(path)) {
    try {
      config = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    } catch {
      // Malformed user config — inject into a fresh object rather than fail the turn.
    }
  }
  const providers =
    config.provider && typeof config.provider === "object" && !Array.isArray(config.provider)
      ? { ...(config.provider as Record<string, unknown>) }
      : {};
  const previous = providers[inject.host];
  const existing =
    previous && typeof previous === "object" && !Array.isArray(previous)
      ? { ...(previous as Record<string, unknown>) }
      : {
          npm: "@ai-sdk/openai-compatible",
          name: host.label,
          options: {},
          models: {},
        };
  const options =
    existing.options && typeof existing.options === "object" && !Array.isArray(existing.options)
      ? { ...(existing.options as Record<string, unknown>) }
      : {};
  options.baseURL = host.baseUrl;
  if (!options.apiKey) options.apiKey = hostApiKey(host, env);
  const models =
    existing.models && typeof existing.models === "object" && !Array.isArray(existing.models)
      ? { ...(existing.models as Record<string, unknown>) }
      : {};
  if (!models[inject.model]) {
    models[inject.model] = { name: `${inject.model} (${host.label})` };
  }
  providers[inject.host] = {
    ...existing,
    npm: existing.npm || "@ai-sdk/openai-compatible",
    name: existing.name || host.label,
    options,
    models,
  };
  config.provider = providers;
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
  return native;
}

export function storedAuthPath(env: Record<string, string | undefined>) {
  const home = env.HOME || env.USERPROFILE || homedir();
  const dataRoot = env.XDG_DATA_HOME
    || (process.platform === "darwin"
      ? join(home, "Library", "Application Support")
      : process.platform === "win32"
        ? env.LOCALAPPDATA || join(home, "AppData", "Local")
        : join(home, ".local", "share"));
  return join(dataRoot, "opencode", "auth.json");
}

/** True when the CLI's own auth store holds a key for any of the providers. */
export function hasStoredOpenCodeAuth(
  env: Record<string, string | undefined>,
  providerIds: readonly string[],
): boolean {
  const candidates: string[] = [];
  if (env.OPENCODE_AUTH_CONTENT) candidates.push(env.OPENCODE_AUTH_CONTENT);
  try {
    candidates.push(readFileSync(storedAuthPath(env), "utf8"));
  } catch {
    // A missing or unreadable file simply means there is no ambient login.
  }
  return candidates.some((raw) => {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return providerIds.some((providerId) => {
        const auth = parsed[providerId];
        return Boolean(auth && typeof auth === "object" && (auth as { key?: unknown }).key);
      });
    } catch {
      return false;
    }
  });
}

/** Normalize OpenCode's provider-native failures without matching prose. */
export function classifyOpenCodeError(error: unknown): ProviderErrorCode | undefined {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = value.code;
  if (code === -32000) return "invalid_credentials";
  if (code === "AUTH_REQUIRED" || code === "INVALID_API_KEY" || code === "UNAUTHORIZED") return "invalid_credentials";
  if (code === "SUBSCRIPTION_INACTIVE") return "inactive_subscription";
  if (code === "QUOTA_EXCEEDED" || code === "REGION_RESTRICTED") return "quota_or_region_restriction";
  if (code === "UPSTREAM_UNAVAILABLE" || code === "SERVICE_UNAVAILABLE") return "upstream_outage";
  if (code === "MODEL_CATALOG_UNAVAILABLE") return "model_catalog_outage";
  return undefined;
}
