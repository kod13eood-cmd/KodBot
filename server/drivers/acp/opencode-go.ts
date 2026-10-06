// OpenCode Go subscription/API product through the maintained OpenCode CLI's
// ACP stdio interface. The generic protocol runtime lives in core.ts; the
// shared credential/catalog/error helpers live in opencode-shared.ts.
//
// This Go-only engine is kept for backwards compatibility and existing
// configs. New installs should prefer the unified `opencode` engine
// (opencode.ts), which offers Zen and Go models — including the free ones —
// from a single picker entry.
import { mergeLocalInject } from "../local-inject.ts";
import { createAcpDriver, type AcpSupport } from "./core.ts";
import {
  OPENCODE_GO_PROVIDER_ID,
  classifyOpenCodeError,
  ensureOpenCodeInjectModel,
  hasStoredOpenCodeAuth,
  labelForModel,
  stripForeignProviderKeys,
} from "./opencode-shared.ts";
import type { ModelCatalog } from "../../contracts.ts";

const CATALOG_URL = "https://opencode.ai/zen/go/v1/models";
const STATIC_MODELS: ModelCatalog = {
  default: "opencode-go/minimax-m3",
  options: [
    { id: "opencode-go/minimax-m3", label: "Minimax M3" },
    { id: "opencode-go/kimi-k3", label: "Kimi K3" },
    { id: "opencode-go/glm-5.2", label: "GLM 5.2" },
  ],
};

let lastSuccessfulCatalog: ModelCatalog | null = null;

export function resetOpenCodeGoModelCache() {
  lastSuccessfulCatalog = null;
}

export async function fetchOpenCodeGoModels(fetcher: typeof fetch = fetch): Promise<ModelCatalog> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    timeout.unref?.();
    try {
      const response = await fetcher(CATALOG_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`catalog HTTP ${response.status}`);
      const payload = await response.json() as unknown;
      const records = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
          ? (payload as { data: unknown[] }).data
          : [];
      const ids = records
        .map((record) => record && typeof record === "object" ? (record as { id?: unknown }).id : undefined)
        .filter((id): id is string => typeof id === "string" && /^[a-z0-9][a-z0-9._-]*$/i.test(id));
      if (!ids.length) throw new Error("catalog contained no valid models");
      const options = STATIC_MODELS.options.map((option) => ({ ...option }));
      const seen = new Set(options.map((option) => option.id));
      for (const id of ids) {
        const full = `opencode-go/${id}`;
        if (seen.has(full)) continue;
        seen.add(full);
        options.push({ id: full, label: labelForModel(id), custom: true });
      }
      const catalog = { default: STATIC_MODELS.default, options } satisfies ModelCatalog;
      lastSuccessfulCatalog = catalog;
      return catalog;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return lastSuccessfulCatalog ?? STATIC_MODELS;
  }
}

const support = (fetcher: typeof fetch): AcpSupport => ({
  driverKind: "opencodeGo",
  displayName: "OpenCode Go",
  models: STATIC_MODELS,
  defaultCli: "opencode",
  nativeSource: "opencode-go.acp",
  loginNote: "OpenCode Go is not configured — add an OPENCODE_API_KEY in OpenCrew settings",
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
  isAuthenticated: (env) => Boolean(env.OPENCODE_API_KEY) || hasStoredOpenCodeAuth(env, [OPENCODE_GO_PROVIDER_ID]),
  classifyError: classifyOpenCodeError,
  resolveModels: async (environment) => mergeLocalInject(await fetchOpenCodeGoModels(fetcher), environment),
  buildPromptText: (turn) => turn.system ? `${turn.system}\n\n${turn.text}` : turn.text,
});

export function createOpenCodeGoDriver(fetcher: typeof fetch = fetch) {
  return createAcpDriver(support(fetcher));
}

/** @deprecated Use classifyOpenCodeError from opencode-shared.ts. */
export const classifyOpenCodeGoError = classifyOpenCodeError;

export const OpenCodeGoDriver = createOpenCodeGoDriver();

// Re-exported for the local-inject tests, which historically imported it here.
export { ensureOpenCodeInjectModel };
