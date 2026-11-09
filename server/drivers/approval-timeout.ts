/** Resolve the configured approval wait at request time. A function keeps a
 * settings change live without rebuilding the provider fleet (and killing
 * turns that may be parked on a card). 0 means wait without a timer. */
export type ApprovalTimeout = number | (() => number) | undefined;

export function resolveApprovalTimeoutMs(value: ApprovalTimeout, fallback = 15 * 60_000): number {
  const raw = typeof value === "function" ? value() : value;
  return raw === undefined ? fallback : Math.max(0, Math.round(raw));
}
