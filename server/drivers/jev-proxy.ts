// Jev MCP proxy — gives any MCP-capable agent one tool, `jev_decide`, for
// structured decisions about text (triage, routing, classification, urgency,
// sentiment). It is deliberately not a chat model: Jev returns typed answers
// and probabilities, never prose.
//
// The harness owns the Zen key and request validation; this proxy only carries
// the tool call over localhost with the same per-process token as the agents
// proxy.
import readline from "node:readline";

const HARNESS = process.env.OC_HARNESS_URL ?? "http://127.0.0.1:8799";
const TOKEN = process.env.OC_COMMS_TOKEN ?? "";

const QUESTION_TYPES = ["noul", "choice", "score"] as const;
const MODELS = ["jev-1.13-free", "jev-1.13"] as const;
const PRESETS = ["triage", "bug", "sentiment"] as const;

const TOOLS = [
  {
    name: "jev_decide",
    description:
      "Use Jev for a structured decision about a piece of text: triage, routing, urgency, classification, sentiment, or a rubric score. Jev returns typed answers with probabilities, not prose — do not use it to write or rewrite text. Send `state` plus either a `preset` (triage, bug, sentiment) for the common cases, or a `questions` object for a custom decision. Question types: noul = yes/no probability, choice = one of named criteria, score = rubric index.",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          description: "The text to judge. Keep the raw message or document here; do not add instructions to it.",
        },
        preset: {
          type: "string",
          enum: PRESETS,
          description:
            "Ready-made decision: triage (urgent/team/frustration), bug (is_bug/severity/component), or sentiment (positive-neutral-negative/urgent). Use this OR questions.",
        },
        questions: {
          type: "object",
          description:
            "Custom questions keyed by an id. Each value is { type: noul|choice|score, instructions, criteria? }. choice criteria is an object of key -> description; score criteria is an array of labels.",
          additionalProperties: {
            type: "object",
            properties: {
              type: { type: "string", enum: QUESTION_TYPES },
              instructions: { type: "string" },
              criteria: {
                oneOf: [{ type: "array", items: { type: "string" } }, { type: "object", additionalProperties: { type: "string" } }],
              },
            },
            required: ["type", "instructions"],
          },
        },
        model: {
          type: "string",
          enum: MODELS,
          description: "jev-1.13-free (default) or jev-1.13 (paid).",
        },
      },
      required: ["state"],
    },
  },
];

type Json = Record<string, unknown>;
const send = (msg: Json) => process.stdout.write(JSON.stringify(msg) + "\n");
const ok = (id: unknown, result: unknown) => send({ jsonrpc: "2.0", id, result });
const rpcErr = (id: unknown, code: number, message: string) => send({ jsonrpc: "2.0", id, error: { code, message } });
const textResult = (id: unknown, text: string, isError = false) =>
  ok(id, { content: [{ type: "text", text }], isError });

async function callTool(args: Json): Promise<{ text: string; isError?: boolean }> {
  const state = typeof args.state === "string" ? args.state.trim() : "";
  if (!state) return { text: "jev_decide needs non-empty `state` text.", isError: true };
  const body: Record<string, unknown> = { state };
  if (typeof args.preset === "string" && args.preset.trim()) body.preset = args.preset.trim();
  if (args.questions && typeof args.questions === "object") body.questions = args.questions;
  if (!body.preset && !body.questions) {
    return { text: "jev_decide needs either a `preset` or a `questions` object.", isError: true };
  }
  if (typeof args.model === "string" && args.model.trim()) body.model = args.model.trim();

  const res = await fetch(`${HARNESS}/api/internal/jev`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(65_000),
  });
  const payload = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) {
    return { text: String(payload.error ?? `Jev request failed (HTTP ${res.status})`), isError: true };
  }
  return { text: JSON.stringify(payload, null, 2) };
}

async function handle(msg: Json) {
  const id = msg.id;
  const method = msg.method as string | undefined;
  if (!method) return;
  const params = (msg.params ?? {}) as Json;
  switch (method) {
    case "initialize":
      ok(id, {
        protocolVersion: (params.protocolVersion as string) ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "kodbot-jev", version: "1.0.0" },
      });
      return;
    case "notifications/initialized":
    case "notifications/cancelled":
      return;
    case "ping":
      ok(id, {});
      return;
    case "tools/list":
      ok(id, { tools: TOOLS });
      return;
    case "tools/call": {
      const name = params.name as string;
      if (name !== "jev_decide") return rpcErr(id, -32602, `Unknown tool: ${name}`);
      try {
        const { text, isError } = await callTool((params.arguments ?? {}) as Json);
        textResult(id, text, isError);
      } catch (error) {
        textResult(id, (error as Error).message, true);
      }
      return;
    }
    default:
      if (id !== undefined) rpcErr(id, -32601, `Method not found: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const text = line.trim();
  if (!text) return;
  let msg: Json;
  try {
    msg = JSON.parse(text) as Json;
  } catch {
    return;
  }
  void handle(msg).catch((error) => {
    if (msg.id !== undefined) rpcErr(msg.id, -32603, (error as Error).message);
  });
});
rl.on("close", () => process.exit(0));
