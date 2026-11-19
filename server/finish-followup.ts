export const FINISH_RETRY_PROMPT =
  "Continue the unfinished work from the last turn. Finish the remaining steps. Do not repeat a command that was denied. If you are blocked, stop and say what a person must decide.";

export type FinishFollowUp =
  | { kind: "none" }
  | { kind: "retry"; prompt: string }
  | { kind: "ask"; title: string; subtitle: string };

/** An assistant reply that stopped on work it had not done. A finished
 * summary that happens to contain a list is not an open list. */
export function looksOpenList(text: string): boolean {
  const body = text.trim();
  if (!body) return false;
  if (/\[ \]/.test(body)) return true;
  return /\b(next steps|remaining steps|left to do|still to do|остава)\b/i.test(body)
    && /(?:^|\n)\s*(?:[-*]|\d+[.)])\s+\S/.test(body);
}

/** One later turn when a bot that works alone stops on a list or a
 * denied tool. The second time, the person gets a card. */
export function finishFollowUp(input: {
  workAlone: boolean;
  cancelled: boolean;
  denied: boolean;
  openList: boolean;
  alreadyRetried: boolean;
}): FinishFollowUp {
  if (!input.workAlone || input.cancelled || (!input.denied && !input.openList)) return { kind: "none" };
  if (input.alreadyRetried) {
    return {
      kind: "ask",
      title: "This still needs you",
      subtitle: "One follow-up already tried the rest. A person has to decide the next step.",
    };
  }
  return { kind: "retry", prompt: FINISH_RETRY_PROMPT };
}
