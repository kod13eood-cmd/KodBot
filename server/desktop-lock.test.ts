import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { acquireDesktopLock, desktopLockHeld } from "./desktop-lock.ts";

const scratch = mkdtempSync(join(tmpdir(), "kodbot-desktop-lock-"));
const lockPath = join(scratch, "desktop.lock");

afterEach(() => {
  rmSync(lockPath, { recursive: true, force: true });
});

describe("shared desktop lock", () => {
  it("serialises two turns and releases for the waiter", async () => {
    const first = await acquireDesktopLock(lockPath);
    expect(desktopLockHeld(lockPath)).toBe(true);

    let waited = false;
    const second = acquireDesktopLock(lockPath, {
      timeoutMs: 1_000,
      pollMs: 10,
      onWait: () => {
        waited = true;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(waited).toBe(true);

    first.release();
    const held = await second;
    expect(desktopLockHeld(lockPath)).toBe(true);
    held.release();
    expect(desktopLockHeld(lockPath)).toBe(false);
  });

  it("breaks a lock left by a dead bridge", async () => {
    mkdirSync(lockPath, { mode: 0o700 });
    writeFileSync(
      join(lockPath, "owner.json"),
      JSON.stringify({ pid: 999_999_999, token: "dead", startedAt: Date.now() }),
    );
    writeFileSync(join(lockPath, "heartbeat"), String(Date.now() - 120_000));

    expect(desktopLockHeld(lockPath)).toBe(false);
    const lock = await acquireDesktopLock(lockPath, { pollMs: 5, staleMs: 50 });
    expect(desktopLockHeld(lockPath)).toBe(true);
    lock.release();
  });

  it("times out instead of hanging forever", async () => {
    const lock = await acquireDesktopLock(lockPath);
    await expect(
      acquireDesktopLock(lockPath, { timeoutMs: 30, pollMs: 5 }),
    ).rejects.toThrow("timed out waiting");
    lock.release();
  });
});
