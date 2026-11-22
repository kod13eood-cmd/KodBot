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
