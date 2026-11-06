import { afterEach, describe, expect, it, vi } from "vitest";

import { createAutoModelCatalog } from "./auto-model-catalog.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("auto-model catalog cache", () => {
  it("returns the cached snapshot without re-probing inside the TTL", async () => {
    let calls = 0;
    let now = 1_000;
    const read = createAutoModelCatalog(
      async () => {
        calls += 1;
        return ["snapshot"];
      },
      { ttlMs: 5_000, timeoutMs: 100, now: () => now },
    );

    await expect(read()).resolves.toEqual(["snapshot"]);
    now += 4_999;
    await expect(read()).resolves.toEqual(["snapshot"]);
    expect(calls).toBe(1);
  });

  it("re-probes after the TTL", async () => {
    let calls = 0;
    let now = 1_000;
    const read = createAutoModelCatalog(
      async () => {
        calls += 1;
        return [calls];
      },
      { ttlMs: 5_000, timeoutMs: 100, now: () => now },
    );

    await expect(read()).resolves.toEqual([1]);
    now += 5_001;
    await expect(read()).resolves.toEqual([2]);
    expect(calls).toBe(2);
  });

  it("returns null when the probe is slower than the send budget, then warms the cache", async () => {
    vi.useFakeTimers();
    let release: (value: string[]) => void = () => {};
    let calls = 0;
    const read = createAutoModelCatalog(
      () => {
        calls += 1;
        return new Promise<string[]>((resolve) => {
          release = resolve;
        });
      },
      { ttlMs: 60_000, timeoutMs: 2_000 },
    );

    const first = read();
    await vi.advanceTimersByTimeAsync(2_001);
    await expect(first).resolves.toBeNull();
    expect(calls).toBe(1);

    release(["warm"]);
    await vi.runAllTimersAsync();
    await expect(read()).resolves.toEqual(["warm"]);
    expect(calls).toBe(1);
  });

  it("treats a failed probe as no routing data", async () => {
    const read = createAutoModelCatalog(
      async () => {
        throw new Error("catalog offline");
      },
      { ttlMs: 60_000, timeoutMs: 100 },
    );
    await expect(read()).resolves.toBeNull();
  });
});
