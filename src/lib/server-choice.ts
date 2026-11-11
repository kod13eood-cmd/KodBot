/** First-run server choice. The desktop main process owns the real setting;
 * this only decides whether the install still needs an explicit choice. */

export interface ServerChoiceState {
  configured?: boolean;
}

/** True only when the main process explicitly reports that no local/remote
 * choice has been saved yet. Older builds omit `configured`, so they keep the
 * current behaviour and never block the app. */
export function serverChoiceRequired(state: ServerChoiceState | null | undefined): boolean {
  return state?.configured === false;
}

/** Match the address the main process will store: trimmed, no trailing slash. */
export function normalizeRemoteAddress(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
