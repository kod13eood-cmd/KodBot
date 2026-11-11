import { spawn } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { CONTAINER, CUA_EXECUTABLE, CUA_SOCKET } from "./container-computer.ts";
import { acquireDesktopLock, desktopLockHeld } from "./desktop-lock.ts";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

// The fake Docker executable below is a POSIX shell script. The production
// bridge remains portable; only this byte-for-byte process fixture is gated.
const posixOnly = describe.skipIf(process.platform === "win32");

posixOnly("Local VM Cua MCP bridge", () => {
  const runBridge = (
    input: string,
    bin: string,
    extraEnv: Record<string, string> = {},
  ): Promise<{ code: number | null; stdout: string; stderr: string }> =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL("./container-mcp.ts", import.meta.url)), "docker", CONTAINER, CUA_SOCKET],
        {
          env: { ...process.env, OC_EXTRA_PATH: bin, NODE_NO_WARNINGS: "1", ...extraEnv },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
      child.stdin.end(input);
    });

  it("passes MCP bytes unchanged to cua-driver mcp over the container runtime", async () => {
    const bin = await mkdtemp(join(tmpdir(), "kodbot-container-mcp-"));
    temporary.push(bin);
    const fakeDocker = join(bin, "docker");
    await writeFile(
      fakeDocker,
      "#!/bin/sh\nprintf 'ARGS:%s\\n' \"$*\" >&2\ncat\n",
      { mode: 0o700 },
    );
    await chmod(fakeDocker, 0o700);

    const input = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n';
    const result = await runBridge(input, bin);

    expect(result.code).toBe(0);
    expect(result.stdout).toBe(input);
    expect(result.stderr).toContain(
      `ARGS:exec -i -u cua -e HOME=/home/cua -e DISPLAY=:1 -e CUA_DRIVER_INSTALL_CHANNEL=python_package ` +
        `-e CUA_DRIVER_RS_TELEMETRY_ENABLED=0 ${CONTAINER} ` +
        `${CUA_EXECUTABLE} mcp --socket ${CUA_SOCKET}`,
    );
  });

  it("holds the shared desktop for a computer tool call and releases it on exit", async () => {
    const bin = await mkdtemp(join(tmpdir(), "kodbot-container-mcp-"));
    temporary.push(bin);
    const lock = join(bin, "desktop.lock");
    const fakeDocker = join(bin, "docker");
    await writeFile(fakeDocker, "#!/bin/sh\ncat\n", { mode: 0o700 });
    await chmod(fakeDocker, 0o700);

    const input = '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"get_desktop_state"}}\n';
    const result = await runBridge(input, bin, { OC_VM_DESKTOP_LOCK: lock });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe(input);
    expect(desktopLockHeld(lock)).toBe(false);
  });

  it("times out waiting for a desktop another bridge holds", async () => {
    const bin = await mkdtemp(join(tmpdir(), "kodbot-container-mcp-"));
    temporary.push(bin);
    const lock = join(bin, "desktop.lock");
    const fakeDocker = join(bin, "docker");
    await writeFile(fakeDocker, "#!/bin/sh\ncat\n", { mode: 0o700 });
    await chmod(fakeDocker, 0o700);
    const owner = await acquireDesktopLock(lock, { pollMs: 5 });
    try {
      const input = '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"click"}}\n';
      const result = await runBridge(input, bin, { OC_VM_DESKTOP_LOCK: lock, OC_VM_DESKTOP_WAIT_MS: "50" });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("timed out waiting for the shared Local VM desktop");
    } finally {
      owner.release();
    }
  });
});
