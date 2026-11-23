import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { openBlankTerminal, openTerminalCommand } from "./terminal-launch.mjs";

function launcher(outcomes) {
  const calls = [];
  const run = (executable, args, options) => {
    calls.push({ executable, args, options });
    const child = new EventEmitter();
    child.unref = () => {};
    const outcome = outcomes.shift() ?? "spawn";
    queueMicrotask(() => {
      if (outcome === "throw") child.emit("error", new Error("missing terminal"));
      else child.emit("spawn");
    });
    return child;
  };
  return { calls, run };
}

describe("blank terminal launcher", () => {
  it("opens Terminal on macOS without a command argument", async () => {
    const fake = launcher(["spawn"]);
    await expect(openBlankTerminal("darwin", fake.run)).resolves.toBe(true);
    expect(fake.calls).toEqual([
      {
        executable: "osascript",
        args: ["-e", 'tell application "Terminal" to activate'],
        options: undefined,
      },
    ]);
  });

  it("opens a blank PowerShell window on Windows", async () => {
    const fake = launcher(["spawn"]);
    await expect(openBlankTerminal("win32", fake.run)).resolves.toBe(true);
    expect(fake.calls[0]).toMatchObject({ executable: "powershell.exe", args: ["-NoExit"] });
  });

  it("tries the next Linux terminal after an asynchronous launch error", async () => {
    const fake = launcher(["throw", "spawn"]);
    await expect(openBlankTerminal("linux", fake.run)).resolves.toBe(true);
    expect(fake.calls.map((call) => call.executable)).toEqual([
      "x-terminal-emulator",
      "gnome-terminal",
    ]);
    expect(fake.calls.every((call) => call.args.length === 0)).toBe(true);
  });

  it("returns false when no Linux terminal launches", async () => {
    const fake = launcher(["throw", "throw", "throw", "throw"]);
    await expect(openBlankTerminal("linux", fake.run)).resolves.toBe(false);
  });

  it("returns false when the launcher throws synchronously", async () => {
    const run = () => {
      throw new Error("launch failed");
    };
    await expect(openBlankTerminal("darwin", run)).resolves.toBe(false);
  });
});

describe("trusted terminal command launcher", () => {
  it("runs the command in PowerShell on Windows", async () => {
    const fake = launcher(["spawn"]);
    await expect(
      openTerminalCommand('& "C:\\Program Files\\KodBot\\opencode.exe" auth login', "win32", fake.run),
    ).resolves.toBe(true);
    expect(fake.calls[0]).toMatchObject({
      executable: "powershell.exe",
      args: ["-NoExit", "-Command", '& "C:\\Program Files\\KodBot\\opencode.exe" auth login'],
    });
  });

  it("escapes the command for Terminal on macOS", async () => {
    const fake = launcher(["spawn"]);
    await expect(openTerminalCommand("'/opt/KodBot/opencode' auth login", "darwin", fake.run)).resolves.toBe(true);
    expect(fake.calls[0].args[1]).toContain("do script");
    expect(fake.calls[0].args[1]).toContain("auth login");
  });

  it("tries Linux terminals and reports failure honestly", async () => {
    const fake = launcher(["spawn"]);
    await expect(openTerminalCommand("opencode auth login", "linux", fake.run)).resolves.toBe(true);
    expect(fake.calls[0].executable).toBe("x-terminal-emulator");
    expect(fake.calls[0].args).toEqual(["-e", "sh", "-lc", "opencode auth login"]);

    const none = launcher(["throw", "throw", "throw", "throw"]);
    await expect(openTerminalCommand("opencode auth login", "linux", none.run)).resolves.toBe(false);
  });

  it("does nothing for an empty command", async () => {
    const fake = launcher([]);
    await expect(openTerminalCommand("", "win32", fake.run)).resolves.toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});
