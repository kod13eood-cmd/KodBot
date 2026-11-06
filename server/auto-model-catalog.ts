// Model routing needs a live catalog, but probing every provider can take
// seconds. Cache the successful result and cap how long a send waits for a
// fresh probe; the probe keeps running and warms the cache for the next turn.
export interface AutoModelCatalogOptions {
  /** How long a successful snapshot stays fresh. */
  ttlMs?: number;
  /** Maximum time a caller waits before using its current selection. */
  timeoutMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

export function createAutoModelCatalog<T>(
  probe: () => Promise<T>,
  options: AutoModelCatalogOptions = {},
): () => Promise<T | null> {
  const ttlMs = options.ttlMs ?? 60_000;
  const timeoutMs = options.timeoutMs ?? 2_000;
  const now = options.now ?? Date.now;
  let cached: { at: number; value: T } | null = null;
  let inFlight: Promise<T | null> | null = null;

  return () => {
    if (cached && now() - cached.at < ttlMs) return Promise.resolve(cached.value);
    if (!inFlight) {
      inFlight = probe()
        .then((value) => {
          cached = { at: now(), value };
          return value;
        })
        .catch(() => null)
        .finally(() => {
          inFlight = null;
        });
    }
    return Promise.race([
      inFlight,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  };
}
