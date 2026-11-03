// Quoted replies. The user can point at an earlier message — usually a bot
// answer they are reading while the next turn already runs — and the model
// must know which answer the new question belongs to.
//
// The quote is an excerpt, not a copy: transcripts stay small and a reply
// cannot smuggle an unbounded wall of text into every later prompt.
import type { MessageReply } from "./store.ts";

export const REPLY_EXCERPT_MAX = 600;

/** One line, bounded, so a reply quote cannot dominate the turn. */
export function replyExcerpt(text: string, max = REPLY_EXCERPT_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** The line a driver sees before the user's new text. */
export function replyContext(reply: MessageReply): string {
  const who = reply.role === "bot" ? "assistant" : "user";
  const name = reply.role === "bot" && reply.fromName ? ` (${reply.fromName})` : "";
  return `[Replying to the ${who}'s earlier message${name}: "${reply.text || "(no text)"}"]`;
}
