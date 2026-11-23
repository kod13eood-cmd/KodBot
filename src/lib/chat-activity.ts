import type { Message } from "@/state/store";

/** Activity chips that carry meaning to a person, not only engine detail.
 * Comm handoffs and delegation results stay visible in the calm view; raw
 * tool calls and auto-approvals do not. */
const USER_FACING = /^(?:Delegated to\b|Messaged\b|Message from\b|@.+\b(?:replied|finished)\b|Delegated work finished\b|\d+ queued delegations? dropped\b)/i;

export function isUserFacingActivity(message: Message): boolean {
  if (message.kind !== "activity" || !message.tool) return false;
  if (message.tool.name.startsWith("error:")) return true;
  if (message.comm) return true;
  return USER_FACING.test(message.tool.name.trim());
}

/** Developer mode shows every chip; the calm view keeps only user-facing
 * handoffs and errors (errors are handled separately as ErrorRow). */
export function shouldShowActivity(message: Message, devMode: boolean): boolean {
  return devMode || isUserFacingActivity(message);
}

/** The newest activity in the current turn, for the single calm progress
 * line. Errors are excluded; they have their own card. */
export function latestProgress(messages: Message[], since: number): Message | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.at < since) continue;
    if (message.kind !== "activity" || !message.tool) continue;
    if (message.tool.name.startsWith("error:")) continue;
    return message;
  }
  return undefined;
}

/** A human phrase for the calm progress line. `spoken` is the server's
 * narration; comm/delegation chips are already human-readable. Raw tool names
 * return undefined so the caller can fall back to “Working…”, never argv. */
export function progressLabel(message: Message | undefined): string | undefined {
  if (!message?.tool) return undefined;
  if (message.tool.spoken) return message.tool.spoken;
  if (message.comm || USER_FACING.test(message.tool.name.trim())) return message.tool.name;
  return undefined;
}

/** What the bot is doing, as one short human beat. The UI owns the localized
 * copy and the icon; this module only classifies the activity so the calm
 * line never shows a raw tool name or argv. */
export type ProgressAction =
  | "thinking"
  | "searching"
  | "reading"
  | "writing"
  | "editing"
  | "running"
  | "asking"
  | "computer"
  | "writing-text"
  | "working";

/** MCP tools arrive as `mcp__server__tool`; the server already strips this
 * for narration, and the classifier must do the same to recognize actions. */
export function normalizeToolName(name: string): string {
  return name.replace(/^mcp__[^_]+__/, "").trim();
}

const TOOL_ACTIONS: ReadonlyArray<readonly [RegExp, ProgressAction]> = [
  [/^(?:bash|shell|terminal|run_command|execute|computer_exec)$/i, "running"],
  [/^(?:read|read_file|view|cat|head|tail)$/i, "reading"],
  [/^(?:write|write_file|create_file)$/i, "writing"],
  [/^(?:edit|apply_patch|str_replace|multiedit|patch)$/i, "editing"],
  [/^(?:grep|search|glob|find|web_?search|websearch)$/i, "searching"],
  [/^(?:web_?fetch|fetch)$/i, "reading"],
  [/^(?:screenshot|click|type_text|press_key|scroll|computer_batch|launch_app|get_desktop_state|list_windows|get_window_state|browser_|open_url)/i, "computer"],
  [/^(?:list_bots|ask_bot|delegate_bot|message_bot|ask_peer)/i, "asking"],
];

/** Spoken narration is English and comes from the server's `narrateTool`;
 * recognize its verbs so the calm line matches what call mode reads. */
const PHRASE_ACTIONS: ReadonlyArray<readonly [RegExp, ProgressAction]> = [
  [/\bsearch/i, "searching"],
  [/\bediting?\b/i, "editing"],
  [/\bwrit(?:e|ing)\b/i, "writing"],
  [/\bread(?:ing)?\b/i, "reading"],
  [/\brun(?:ning)?\b|\bcommand\b/i, "running"],
  [/\bask(?:ing)?\b|\bchecking who\b|\bdelegat/i, "asking"],
  [/\b(?:computer|screen|browser|click|typing|opening a page)\b/i, "computer"],
  [/\bthink/i, "thinking"],
];

function actionFromToolName(name: string): ProgressAction | undefined {
  const bare = normalizeToolName(name);
  for (const [pattern, action] of TOOL_ACTIONS) {
    if (pattern.test(bare)) return action;
  }
  return undefined;
}

function actionFromPhrase(phrase: string): ProgressAction | undefined {
  for (const [pattern, action] of PHRASE_ACTIONS) {
    if (pattern.test(phrase)) return action;
  }
  return undefined;
}

/** The prompt that started the current turn. Queued messages sit in the same
 * transcript but belong to a future turn: letting one reset the timer (or a
 * regenerate) would point at work the bot has not started yet. */
export function latestUserPrompt(messages: Message[]): Message | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user" && message.kind === "text" && !message.queued) return message;
  }
  return undefined;
}

/** Classify the turn's latest activity for the single calm status line.
 *
 * The caller passes only an activity that is newer than the last settled text
 * (an old tool chip must not label a bot that has moved on to writing), and
 * `writing` only while deltas are actually arriving. A pause for a tool call
 * — or for thinking — then changes the label instead of leaving a blinking
 * caret with no explanation. */
export function progressAction(
  message: Message | undefined,
  options: { writing?: boolean; reasoning?: boolean } = {},
): ProgressAction {
  if (message?.tool) {
    const name = message.tool.name.trim();
    // handoffs and delegation results are meaningful even in the calm view
    if (message.comm || USER_FACING.test(normalizeToolName(name))) return "asking";
    const fromPhrase = message.tool.spoken ? actionFromPhrase(message.tool.spoken) : undefined;
    if (fromPhrase) return fromPhrase;
    const fromTool = actionFromToolName(name);
    if (fromTool) return fromTool;
  }
  if (options.writing) return "writing-text";
  if (options.reasoning) return "thinking";
  return message?.tool ? "working" : "thinking";
}
