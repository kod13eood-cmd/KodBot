import type { Message } from "./store.ts";

const TRACE_LIMIT = 12;
const LINE_LIMIT = 160;

/** A short diary of recent tool chips for a session that has to start
 * over. Screen frames stay out: a replay is text, not a screenshot. */
export function toolTrace(messages: Message[], excludeId?: string): string {
  const lines: string[] = [];
  for (const message of messages) {
    if (message.id === excludeId) continue;
    if (message.kind !== "activity" || !message.tool?.name) continue;
    const name = message.tool.name.replace(/\s+/g, " ").trim().slice(0, LINE_LIMIT);
    if (!name || name.startsWith("error:")) continue;
    const mark = message.tool.ok === false ? "failed" : "ok";
    lines.push(`${mark} ${name}`);
  }
  const recent = lines.slice(-TRACE_LIMIT);
  if (!recent.length) return "";
  return ["[Recent tool activity, newest last:]", ...recent].join("\n");
}
