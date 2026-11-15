// Automation workers can write a long report, a page, and narration. The
// owner's main chat should receive only the small block the worker was asked
// to end with, not that whole transcript. Keep the parser separate so the
// marker contract is testable without booting the harness.

export interface AutomationSummary {
  summary: string;
  /** Only present when the worker actually needs a human decision. */
  needs?: string;
}

const NOTHING = /^(nothing|none|n\/a|няма|нищо)[.!]?$/i;

export function extractAutomationSummary(text: string): AutomationSummary | null {
  // Models often bold the markers as **SUMMARY:** / **NEEDS YOU:**. Strip
  // emphasis before matching so the same contract works either way.
  const plain = text.replace(/\*\*|__/g, "");
  const match = plain.match(
    /(?:^|\n)[ \t]*SUMMARY[ \t]*:?[ \t]*\n?([\s\S]*?)(?:\n[ \t]*NEEDS YOU[ \t]*:[ \t]*([\s\S]*))?[ \t]*$/i,
  );
  if (!match) return null;
  const summary = match[1].trim();
  if (!summary) return null;
  const needs = match[2]?.trim();
  return {
    summary,
    ...(needs && !NOTHING.test(needs) ? { needs } : {}),
  };
}
