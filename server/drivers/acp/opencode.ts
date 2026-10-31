// Unified OpenCode engine: one picker entry over the maintained OpenCode
// CLI's ACP stdio interface, merging the Zen and Go model catalogs (including
// the free models) behind a single provider. Zen and Go share one
// OPENCODE_API_KEY; the provider is carried in the model id
// (`opencode/<id>` vs `opencode-go/<id>`), so selection still lands on the
// exact model over ACP's `session/set_config_option`.
//
// The Go-only engine (opencode-go.ts) remains registered for backwards
// compatibility; this is the engine new installs should use.
import { mergeLocalInject } from "../local-inject.ts";
import { createAcpDriver, type AcpSupport } from "./core.ts";
import {
  OPENCODE_CATALOG_URLS,
  OPENCODE_GO_PROVIDER_ID,
  OPENCODE_PROVIDER_ID,
  classifyOpenCodeError,
  ensureOpenCodeInjectModel,
  fetchOpenCodeProviderModels,
  hasStoredOpenCodeAuth,
  pickBestFreeModel,
  stripForeignProviderKeys,
} from "./opencode-shared.ts";
import type { ModelCatalog } from "../../contracts.ts";

// Pinned fallbacks per provider: a known free model plus Grok, so the picker
// still offers something useful (and free) when both catalogs are offline.
const ZEN_FALLBACK: ModelCatalog = {
  default: "opencode/big-pickle",
  options: [
    { id: "opencode/big-pickle", label: "Big Pickle", group: "Zen", free: true },
    { id: "opencode/grok-4.7", label: "Grok 4.7", group: "Zen" },
    { id: "opencode/grok-4.6", label: "Grok 4.6", group: "Zen" },
  ],
};

const GO_FALLBACK: ModelCatalog = {
  default: "opencode-go/space-bunny-free",
  options: [
    { id: "opencode-go/space-bunny-free", label: "Space Bunny Free", group: "Go", free: true },
    { id: "opencode-go/longcat-2.5-preview-free", label: "Longcat 2.5 Preview Free", group: "Go", free: true },
    { id: "opencode-go/grok-4.7", label: "Grok 4.7", group: "Go" },
  ],
};

/**
 * Merge catalogs into one, deduping by full model id (first catalog wins).
 * The default is the best available free model, falling back to the first
 * catalog's default. Official rows keep their group/free tags; local-inject
 * appends `custom` rows afterwards.
 */
export function mergeOpenCodeCatalogs(catalogs: readonly ModelCatalog[]): ModelCatalog {
  const options: ModelCatalog["options"] = [];
  const seen = new Set<string>();
  for (const catalog of catalogs) {
    for (const option of catalog.options) {
      if (seen.has(option.id)) continue;
      seen.add(option.id);
      options.push({ ...option });
    }
  }
  const defaultId =
    pickBestFreeModel(options)
    ?? catalogs.find((catalog) => catalog.options.length)?.default
    ?? options[0]?.id
    ?? "";
  return { default: defaultId, options };
}

const support = (fetcher: typeof fetch): AcpSupport => ({
  driverKind: "opencode",
  displayName: "OpenCode",
  models: mergeOpenCodeCatalogs([ZEN_FALLBACK, GO_FALLBACK]),
  defaultCli: "opencode",
  nativeSource: "opencode.acp",
  loginNote: "OpenCode is not configured — add an OPENCODE_API_KEY in KodBot settings",
  install: {
    command: {
      darwin: "npm install -g opencode-ai",
      linux: "npm install -g opencode-ai",
      win32: "npm install -g opencode-ai",
    },
    docsUrl: "https://opencode.ai/docs/",
    signInCommand: "opencode auth login",
    needsNode: true,
  },
  spawnArgs: () => ["acp"],
  credentialEnv: ["OPENCODE_API_KEY"],
  selectModel: { configId: "model" },
  resolveTurnModel: (model, env) => (model ? ensureOpenCodeInjectModel(model, env) : model),
  transformEnv: stripForeignProviderKeys,
  pickAuthMethod: () => null,
  authFailure: "continue",
  isAuthenticated: (env) =>
    Boolean(env.OPENCODE_API_KEY)
    || hasStoredOpenCodeAuth(env, [OPENCODE_PROVIDER_ID, OPENCODE_GO_PROVIDER_ID]),
  classifyError: classifyOpenCodeError,
  resolveModels: async (environment) => {
    const [zen, go] = await Promise.all([
      fetchOpenCodeProviderModels({
        url: OPENCODE_CATALOG_URLS.zen,
        providerId: OPENCODE_PROVIDER_ID,
        group: "Zen",
        fallback: ZEN_FALLBACK,
        fetcher,
      }),
      fetchOpenCodeProviderModels({
        url: OPENCODE_CATALOG_URLS.go,
        providerId: OPENCODE_GO_PROVIDER_ID,
        group: "Go",
        fallback: GO_FALLBACK,
        fetcher,
      }),
    ]);
    return mergeLocalInject(mergeOpenCodeCatalogs([zen, go]), environment);
  },
  buildPromptText: (turn) => turn.system ? `${turn.system}\n\n${turn.text}` : turn.text,
});

export function createOpenCodeDriver(fetcher: typeof fetch = fetch) {
  return createAcpDriver(support(fetcher));
}

export const OpenCodeDriver = createOpenCodeDriver();
