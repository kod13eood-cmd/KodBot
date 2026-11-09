// One shared Local VM desktop, but many bots. Turns may run in parallel; only
// the turn that actually calls a computer tool holds this lock, and it keeps
// it until the MCP bridge exits. That lets a bot answer a normal question while
// another bot is using the desktop, and serialises only real desktop work.

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface DesktopLockOptions {
  owner?: string;
  timeoutMs?: number;
  pollMs?: number;
  staleMs?: number;
  /** Called once when another live owner already holds the desktop. */
  onWait?: () => void;
}

export interface DesktopLock {
  release: () => void;
}

interface Owner {
  pid: number;
  token: string;
  owner?: string;
  startedAt: number;
}

function readOwner(path: string): { owner: Owner | null; heartbeatAt: number } {
  try {
    const owner = JSON.parse(readFileSync(join(path, "owner.json"), "utf8")) as Owner;
    const beat = Number(readFileSync(join(path, "heartbeat"), "utf8"));
    return { owner, heartbeatAt: Number.isFinite(beat) && beat > 0 ? beat : owner.startedAt };
  } catch {
    try {
      // The directory exists but owner.json is not written yet. Treat the
      // directory's mtime as a fresh heartbeat for a short grace period.
      return { owner: null, heartbeatAt: statSync(path).mtimeMs };
    } catch {
      return { owner: null, heartbeatAt: 0 };
    }
  }
}

function alive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function stale(path: string, heartbeatAt: number, staleMs: number): boolean {
  const { owner } = readOwner(path);
  if (owner && !alive(owner.pid)) return true;
  return Date.now() - heartbeatAt > staleMs;
}

/** True while a live bridge holds the desktop. Used by the idle timer and the
 * stop/remove routes so a running bot is never disconnected underneath it. */
export function desktopLockHeld(path: string, staleMs = 60_000): boolean {
  const current = readOwner(path);
  if (!current.heartbeatAt) return false;
  if (Date.now() - current.heartbeatAt > staleMs) return false;
  return !current.owner || alive(current.owner.pid);
}

function breakStale(path: string): void {
  const trash = `${path}.stale-${process.pid}-${randomUUID()}`;
  try {
    renameSync(path, trash);
    rmSync(trash, { recursive: true, force: true });
  } catch {
    // Another waiter won the race; retry the normal mkdir path.
  }
}

export async function acquireDesktopLock(
  path: string,
  options: DesktopLockOptions = {},
): Promise<DesktopLock> {
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const pollMs = options.pollMs ?? 200;
  const staleMs = options.staleMs ?? 60_000;
  const token = randomUUID();
  const owner: Owner = {
    pid: process.pid,
    token,
    ...(options.owner ? { owner: options.owner.slice(0, 120) } : {}),
    startedAt: Date.now(),
  };
  const deadline = Date.now() + timeoutMs;
  let announced = false;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });

  for (;;) {
    try {
      mkdirSync(path, { mode: 0o700 });
      writeFileSync(join(path, "owner.json"), JSON.stringify(owner), { mode: 0o600 });
      writeFileSync(join(path, "heartbeat"), String(Date.now()), { mode: 0o600 });
      const beat = setInterval(() => {
        try {
          const latest = readOwner(path).owner;
          if (latest?.token === token) writeFileSync(join(path, "heartbeat"), String(Date.now()));
        } catch {
          // Released or replaced; the heartbeat has nothing left to protect.
        }
      }, 5_000);
      beat.unref?.();
      return {
        release: () => {
          clearInterval(beat);
          try {
            const latest = readOwner(path).owner;
            if (latest?.token === token) rmSync(path, { recursive: true, force: true });
          } catch {
            // Already released.
          }
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }

    const current = readOwner(path);
    if (stale(path, current.heartbeatAt, staleMs)) {
      breakStale(path);
      continue;
    }
    if (!announced) {
      announced = true;
      options.onWait?.();
    }
    if (Date.now() > deadline) {
      throw new Error("timed out waiting for the shared Local VM desktop");
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
