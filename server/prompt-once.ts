/** Standing instructions for engines that have no real system channel.

 * Those engines used to receive the whole persona, guide, and product
 * contracts in front of every user message. A resumed session already
 * holds that text, and repeating it as the user's words crowds out the
 * task. Send the stable layer once, on the first turn of a session.
 *
 * `update` is the layer that changes between turns: memory, the page
 * list, and instructions that belong to this message (a tagged teammate,
 * a webhook). It rides every turn, including a warm one and a session/load.
 * Nothing here writes a file into the user's project.
 */
export function userPrompt(
  system: string | undefined,
  text: string,
  resumed: boolean,
  update?: string,
): string {
  const standing = resumed ? "" : (system?.trim() ?? "");
  const fresh = update?.trim() ?? "";
  const head = [standing, fresh].filter(Boolean).join("\n\n");
  if (!head) return text;
  return `${head}\n\n${text}`;
}

/** Drivers with a real system channel send both layers on every call.
 * Claude's flag, the API Grok system message, and a Box prompt do not
 * keep a warm session that already holds the stable text. */
export function channelSystem(system: string | undefined, update?: string): string | undefined {
  const text = [system?.trim(), update?.trim()].filter(Boolean).join("\n\n");
  return text || undefined;
}

/** Join the pieces that must be present on a resumed turn. Empty pieces drop out. */
export function changingSystem(parts: Array<string | undefined>): string | undefined {
  const text = parts.map((part) => part?.trim() ?? "").filter(Boolean).join("\n\n");
  return text || undefined;
}
