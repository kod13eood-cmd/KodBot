import type { RoutineInput } from "./routines.ts";

export const ROUTINE_SAVE_LABEL = "Save as a paused routine";
export const ROUTINE_SKIP_LABEL = "Not now";

export interface RoutineOffer {
  title: string;
  subtitle: string;
  saveLabel: string;
  skipLabel: string;
  draft: RoutineInput;
}

/** Tomorrow at 09:00 on this machine. The draft stores the instant; the
 * card lets the person move it before anything is saved. */
export function suggestedOnceAt(now: number): number {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.getTime();
}

function routineName(prompt: string): string {
  const line = prompt.trim().split(/\r?\n/).find((part) => part.trim()) ?? "";
  return line.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** A finished multi-step turn can become a routine. The draft is paused:
 * saving it does not arm the clock. */
export function routineOffer(input: {
  ok: boolean;
  toolSteps: number;
  prompt: string;
  botId: string;
  now: number;
  unfinished: boolean;
  automated: boolean;
}): RoutineOffer | null {
  const prompt = input.prompt.trim();
  if (!input.ok || input.unfinished || input.automated || input.toolSteps < 2 || !prompt) return null;
  const name = routineName(prompt);
  if (!name) return null;
  return {
    title: "Save this as a routine?",
    subtitle: "Edit the prompt and the time. It stays paused until you turn it on.",
    saveLabel: ROUTINE_SAVE_LABEL,
    skipLabel: ROUTINE_SKIP_LABEL,
    draft: {
      name,
      prompt: prompt.slice(0, 4_000),
      botId: input.botId,
      runOn: "crew",
      enabled: false,
      schedule: { type: "once", at: suggestedOnceAt(input.now) },
    },
  };
}
