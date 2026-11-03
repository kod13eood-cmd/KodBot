// Open approval/question cards on a thread. Pure so the composer, the call
// views, and the app-wide "needs you" bar all read the transcript the same
// way — an answered or auto-dismissed card is no longer pending.
import type { Message } from "@/state/store";

export interface Pending {
  message: Message;
  requestId: string;
  /** empty for a question; permissions name the tool being requested */
  tool: string;
  /** the narrow grant "always allow" writes, computed server-side */
  allowKey?: string;
  detail: string;
  held?: string;
}

/** Every open request card, permission or question, oldest first. */
export function pendingRequests(messages: Message[]): Pending[] {
  return messages
    .filter((m) => m.kind === "options" && m.card?.requestId && !m.card.answered && !m.card.dismissed)
    .map((m) => ({
      message: m,
      requestId: m.card!.requestId!,
      tool: m.card!.tool ?? "",
      allowKey: m.card!.allowKey,
      detail: m.card!.subtitle,
      held: m.card!.held,
    }));
}

/** Permission approvals only — the composer takes over for these. A question
 * is answered in its own option card, not with Allow/Deny. */
export function pendingApprovals(messages: Message[]): Pending[] {
  return pendingRequests(messages).filter((pending) => pending.tool !== "");
}
