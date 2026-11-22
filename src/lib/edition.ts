/** KodBot editions are a property of the server this window is talking to,
 * not a separate build:
 *
 * - **Solo** — a local or personal harness with no account. Free, MIT, and
 *   everything stays where the harness runs.
 * - **Business** — an organization gateway with accounts. The same app,
 *   signed in, with shared teams and organization administration.
 *
 * "Business" is therefore detected from a signed-in gateway account rather
 * than stored as a second flag that could disagree with the server. */

export type KodBotEdition = "solo" | "business";

export function editionOf(authUser: unknown): KodBotEdition {
  return authUser ? "business" : "solo";
}

/** Loopback pages are the only browser origin that gets the first-run
 * Solo/Business question. A remote personal harness already answers where it
 * is; an organization gateway answers with its login page. */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/** Browser first-run: ask only on loopback, only once, and never over a
 * signed-in organization account. The desktop has its own main-process
 * choice (server-connection.json) and never reaches this path. */
export function browserEditionChoiceRequired(input: {
  hostname: string;
  authUser: unknown;
  soloChosen: boolean;
}): boolean {
  return isLoopbackHost(input.hostname) && !input.authUser && !input.soloChosen;
}

const SOLO_KEY = "kodbot.soloChosen";

export function soloEditionChosen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SOLO_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberSoloEdition(): void {
  try {
    window.localStorage.setItem(SOLO_KEY, "1");
  } catch {
    /* private browsing can deny storage; the in-memory choice still applies */
  }
}
