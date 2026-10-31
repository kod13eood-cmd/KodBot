// Jev ("System One") — OpenCode Zen's structured-decision model.
//
// Jev never writes prose. It scores typed questions about a piece of text and
// returns values plus probabilities (yes/no, one-of-N, rubric). That makes it
// useful for triage, routing, classification, urgency and sentiment, and a
// poor fit for the chat model picker. Agents reach it through the jev MCP
// proxy instead.
//
// The CLI at ~/.local/bin/jev uses the same endpoint and reads the OpenCode
// login. Here the harness owns the request so the key never reaches the agent
// process, and so every driver gets the same validation and error shape.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { AppConfig } from "./config.ts";

export const JEV_MODELS = ["jev-1.13-free", "jev-1.13"] as const;
export type JevModel = (typeof JEV_MODELS)[number];

export type JevQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type JevQuestions = Record<string, JevQuestion>;

/** Ready-made question sets for the common decisions. Agents can pass one of
 * these instead of spelling out the questions every time. */
export const JEV_PRESETS = {
  triage: {
    is_urgent: { type: "noul", instructions: "Does this require urgent attention?" },
    department: {
      type: "choice",
      instructions: "Which team should handle this?",
      criteria: {
        support: "General customer support",
        billing: "Charges, invoices, or payment problems",
        engineering: "A product bug or technical failure",
        sales: "Pricing, plans, or a new purchase",
      },
    },
    frustration: {
      type: "score",
      instructions: "How frustrated is the person writing this?",
      criteria: ["Calm", "Frustrated", "Very angry"],
    },
  },
  bug: {
    is_bug: { type: "noul", instructions: "Is this a bug report?" },
    severity: {
      type: "score",
      instructions: "How severe is the failure?",
      criteria: ["Cosmetic", "Minor", "Major", "Critical"],
    },
    component: {
      type: "choice",
      instructions: "Which component is most likely involved?",
      criteria: {
        ui: "Frontend or user interface",
        api: "Backend API or service",
        data: "Database or stored data",
        docs: "Documentation or setup instructions",
        other: "Unclear or something else",
      },
    },
  },
  sentiment: {
    sentiment: {
      type: "choice",
      instructions: "What is the overall sentiment?",
      criteria: { positive: "Positive", neutral: "Neutral", negative: "Negative" },
    },
    urgent: { type: "noul", instructions: "Is an urgent response needed?" },
  },
} satisfies Record<string, JevQuestions>;

export type JevPreset = keyof typeof JEV_PRESETS;

const DEFAULT_ENDPOINT = "https://opencode.ai/zen/v1/systemone";
const QUESTION_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_STATE_CHARS = 20_000;
const MAX_QUESTIONS = 20;

/** HTTP status carried on errors so the internal route can answer sensibly. */
export interface JevError extends Error {
  status?: number;
}

function fail(message: string, status = 400): never {
  const error = new Error(message) as JevError;
  error.status = status;
  throw error;
}

/** The app's OpenCode key, falling back to the CLI's login file so a machine
 * that can run `opencode` can use Jev without re-entering the key. */
function openCodeKey(cfg: AppConfig): string | undefined {
  const configured = cfg.opencodeGo?.apiKey?.trim();
  if (configured) return configured;
  try {
    const auth = JSON.parse(
      readFileSync(join(homedir(), ".local", "share", "opencode", "auth.json"), "utf8"),
    ) as Record<string, { key?: unknown }>;
    for (const provider of ["opencode", "opencode-go"]) {
      const key = auth?.[provider]?.key;
      if (typeof key === "string" && key.trim()) return key.trim();
    }
  } catch {
    /* no CLI login: the app key is the only path */
  }
  return undefined;
}

export function jevConfigured(cfg: AppConfig): boolean {
  return Boolean(openCodeKey(cfg));
}

function validateQuestions(value: unknown): JevQuestions {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("questions must be an object mapping question ids to specs");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) fail("ask at least one question");
  if (entries.length > MAX_QUESTIONS) fail(`at most ${MAX_QUESTIONS} questions per request`);

  const out: JevQuestions = {};
  for (const [id, raw] of entries) {
    if (!QUESTION_ID.test(id)) fail(`question id "${id}" is invalid`);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(`question "${id}" must be an object`);
    const spec = raw as Record<string, unknown>;
    if (typeof spec.instructions !== "string" || !spec.instructions.trim()) {
      fail(`question "${id}" needs non-empty instructions`);
    }
    if (spec.instructions.length > 500) fail(`question "${id}" instructions are too long`);
    const instructions = spec.instructions.trim();

    if (spec.type === "noul") {
      out[id] = { type: "noul", instructions };
    } else if (spec.type === "choice") {
      if (!spec.criteria || typeof spec.criteria !== "object" || Array.isArray(spec.criteria)) {
        fail(`choice question "${id}" needs a criteria object`);
      }
      const criteria = Object.entries(spec.criteria as Record<string, unknown>);
      if (criteria.length < 2 || criteria.length > 50) fail(`choice question "${id}" needs 2-50 options`);
      const clean: Record<string, string> = {};
      for (const [key, label] of criteria) {
        if (!QUESTION_ID.test(key)) fail(`choice key "${key}" in "${id}" is invalid`);
        if (typeof label !== "string" || !label.trim() || label.length > 200) {
          fail(`choice label for "${key}" in "${id}" is invalid`);
        }
        clean[key] = label.trim();
      }
      out[id] = { type: "choice", instructions, criteria: clean };
    } else if (spec.type === "score") {
      if (!Array.isArray(spec.criteria)) fail(`score question "${id}" needs a criteria array`);
      if (spec.criteria.length < 2 || spec.criteria.length > 20) {
        fail(`score question "${id}" needs 2-20 labels`);
      }
      const criteria = spec.criteria.map((label) => {
        if (typeof label !== "string" || !label.trim() || label.length > 100) {
          fail(`score label in "${id}" is invalid`);
        }
        return label.trim();
      });
      out[id] = { type: "score", instructions, criteria };
    } else {
      fail(`question "${id}" type must be noul, choice, or score`);
    }
  }
  return out;
}

export function jevModel(value: unknown): JevModel {
  if (value === undefined || value === null || value === "") return "jev-1.13-free";
  if (typeof value === "string" && (JEV_MODELS as readonly string[]).includes(value)) return value as JevModel;
  fail(`model must be one of ${JEV_MODELS.join(", ")}`);
}

export function jevRequest(value: unknown): { state: string; questions: JevQuestions; model: JevModel } {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("request body must be an object");
  const body = value as Record<string, unknown>;
  if (typeof body.state !== "string" || !body.state.trim()) fail("state must be non-empty text");
  if (body.state.length > MAX_STATE_CHARS) fail(`state is limited to ${MAX_STATE_CHARS} characters`);
  const preset = typeof body.preset === "string" ? body.preset.trim() : "";
  if (preset && body.questions !== undefined) fail("use either preset or questions, not both");
  if (preset && !(preset in JEV_PRESETS)) fail(`preset must be one of ${Object.keys(JEV_PRESETS).join(", ")}`);
  return {
    state: body.state,
    questions: preset ? (JEV_PRESETS[preset as JevPreset] as JevQuestions) : validateQuestions(body.questions),
    model: jevModel(body.model),
  };
}

export interface JevResult {
  model: string;
  answers: Record<string, unknown>;
  usage?: Record<string, unknown>;
}

/** Ask Jev once. `fetcher` is injectable so the contract can be tested without
 * a live OpenCode Zen call. */
export async function askJev(
  cfg: AppConfig,
  state: string,
  questions: JevQuestions,
  model: JevModel = "jev-1.13-free",
  fetcher: typeof fetch = fetch,
): Promise<JevResult> {
  const key = openCodeKey(cfg);
  if (!key) {
    fail("Jev needs an OpenCode Zen key. Add it in Settings → Engines → OpenCode, or run `opencode auth login`.", 400);
  }

  let response: Response;
  try {
    response = await fetcher(process.env.OC_JEV_URL?.trim() || DEFAULT_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        // Cloudflare's bot rule rejects the default undici UA with 1010.
        "user-agent": "KodBot/1.0 (+https://github.com/kod13eood-cmd/KodBot)",
      },
      body: JSON.stringify({ model, state, questions }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    fail(`Jev request failed: ${error instanceof Error ? error.message : String(error)}`, 502);
  }

  const text = await response.text();
  if (!response.ok) {
    fail(`Jev request failed (HTTP ${response.status}): ${text.slice(0, 300)}`, 502);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail("Jev returned invalid JSON", 502);
  }
  if (!parsed || typeof parsed !== "object") fail("Jev returned an unexpected response", 502);
  return parsed as JevResult;
}
