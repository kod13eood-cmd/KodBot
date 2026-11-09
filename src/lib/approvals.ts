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
  /** what the command/tool will do, in plain language */
  explanation?: string;
  /** why this action needs approval and what may go wrong */
  risk?: string;
  riskLevel?: "low" | "medium" | "high";
  /** task context for a request raised inside a longer job */
  purpose?: string;
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
      explanation: m.card!.explanation,
      risk: m.card!.risk,
      riskLevel: m.card!.riskLevel,
      purpose: m.card!.purpose,
    }));
}

/** Permission approvals only — the composer takes over for these. A question
 * is answered in its own option card, not with Allow/Deny. */
export function pendingApprovals(messages: Message[]): Pending[] {
  return pendingRequests(messages).filter((pending) => pending.tool !== "");
}
