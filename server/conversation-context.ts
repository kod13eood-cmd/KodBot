// What a driver sees of the conversation. A page is a file artifact, but the
// message that announces it carries a bounded text view (title, path, excerpt)
// so a replaying provider can build on what it wrote instead of asking the
// user to paste the page back into the chat.
import type { Message } from "./store.ts";

export const TRANSCRIPT_TURNS = 40;
export const ROOM_CONTEXT_MESSAGES = 30;

export type TranscriptTurn = { role: "user" | "assistant"; text: string };

/** Settled text turns and page announcements that carry their excerpt. Option
 * cards, activity chips and screen frames are UI, not conversation: replaying
 * them would spend context on things the model never wrote as prose. */
function replays(m: Message): m is Message & { text: string } {
  return (m.kind === "text" || m.kind === "page") && Boolean(m.text);
}

/** The transcript for an API-backed driver: settled turns on the active
 * branch only, oldest first, capped. The user's new message is excluded — it
 * travels as the turn text itself. */
export function transcriptTurns(
  messages: Message[],
  excludeId?: string,
  limit = TRANSCRIPT_TURNS,
): TranscriptTurn[] {
  return messages
    .filter((m) => m.id !== excludeId)
    .filter(replays)
    .slice(-limit)
    .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), text: m.text }));
}

/** Recent room history as plain lines, for a member turn that starts on a
 * fresh session. Sender attribution comes from `from`, because a room thread
 * holds several bots. */
export function roomContext(messages: Message[], userName: string, limit = ROOM_CONTEXT_MESSAGES): string {
  return messages
    .filter(replays)
    .slice(-limit)
    .map((m) => `${m.role === "user" ? userName : (m.from?.name ?? "Bot")}: ${m.text}`)
    .join("\n");
}
