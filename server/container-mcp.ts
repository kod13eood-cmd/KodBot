// Transparent stdio bridge into Cua Driver's official MCP server inside the
// Local VM. This process defines no tools and parses no MCP payloads, with one
// exception: a `tools/call` acquires the shared desktop lock before it is
// forwarded. The lock is held until this bridge exits, so desktop work from
// different bots is serialised while ordinary chat turns run in parallel.
import { spawn } from "node:child_process";
import { once } from "node:events";

import { acquireDesktopLock, type DesktopLock } from "./desktop-lock.ts";
import { augmentedPath } from "./env-path.ts";

const [runtime, container, socket] = process.argv.slice(2);
if (!runtime || !["docker", "podman", "container"].includes(runtime)) {
  process.stderr.write("invalid Local VM runtime\n");
  process.exit(2);
}
if (!container || !/^[a-zA-Z0-9_.-]+$/.test(container) || !socket?.startsWith("/run/user/1000/")) {
  process.stderr.write("invalid Local VM connection\n");
  process.exit(2);
}

const lockPath = process.env.OC_VM_DESKTOP_LOCK?.trim();
const owner = process.env.OC_VM_DESKTOP_OWNER?.trim() || undefined;
const configuredWait = Number(process.env.OC_VM_DESKTOP_WAIT_MS);
const waitMs = Number.isFinite(configuredWait) && configuredWait > 0 ? configuredWait : undefined;

const child = spawn(
  runtime,
  [
    "exec",
    "-i",
    "-u",
    "cua",
    "-e",
    "HOME=/home/cua",
    "-e",
    "DISPLAY=:1",
    "-e",
    "CUA_DRIVER_INSTALL_CHANNEL=python_package",
    "-e",
    "CUA_DRIVER_RS_TELEMETRY_ENABLED=0",
    container,
    "/usr/local/libexec/kodbot/cua-driver",
    "mcp",
    "--socket",
    socket,
  ],
  {
    env: { ...process.env, PATH: augmentedPath() },
    stdio: ["pipe", "pipe", "pipe"],
  },
);

let lock: DesktopLock | null = null;
let buffer = "";
let ending = false;
let queue: Promise<void> = Promise.resolve();

function releaseLock(): void {
  lock?.release();
  lock = null;
}

function isToolCall(line: string): boolean {
  try {
    const message = JSON.parse(line) as { method?: unknown };
    return message?.method === "tools/call";
  } catch {
    return false;
  }
}

async function ensureLock(): Promise<void> {
  if (!lockPath || lock) return;
  lock = await acquireDesktopLock(lockPath, {
    ...(owner ? { owner } : {}),
    ...(waitMs ? { timeoutMs: waitMs } : {}),
    onWait: () => process.stderr.write("KodBot: waiting for the shared Local VM desktop…\n"),
  });
}

function enqueue(line: string): void {
  if (!line.trim()) return;
  queue = queue
    .then(async () => {
      if (isToolCall(line)) await ensureLock();
      if (!child.stdin.write(`${line}\n`)) await once(child.stdin, "drain");
    })
    .catch((error) => {
      process.stderr.write(
        `Local VM bridge: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      releaseLock();
      child.kill("SIGTERM");
      process.exit(1);
    });
}

function finishInput(): void {
  if (ending) return;
  ending = true;
  if (buffer.trim()) {
    enqueue(buffer.replace(/\r$/, ""));
    buffer = "";
  }
  void queue.then(() => {
    releaseLock();
    child.stdin.end();
  });
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  let newline: number;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline).replace(/\r$/, "");
    buffer = buffer.slice(newline + 1);
    enqueue(line);
  }
});
process.stdin.on("end", finishInput);
process.stdin.on("close", finishInput);

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on("error", (error) => {
  process.stderr.write(`could not connect to Cua Driver: ${error.message}\n`);
  releaseLock();
  process.exit(1);
});
child.on("close", (code, signal) => {
  if (signal) process.stderr.write(`Cua Driver connection ended with ${signal}\n`);
  releaseLock();
  process.exit(code ?? 1);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    releaseLock();
    child.kill(signal);
  });
}
process.on("exit", releaseLock);
