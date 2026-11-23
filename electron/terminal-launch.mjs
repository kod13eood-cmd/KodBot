import { execFile } from "node:child_process";

/** Resolve only after the launcher really spawns or reports an error. */
function launch(executable, args, options, run = execFile) {
  return new Promise((resolve) => {
    let child;
    try {
      child = run(executable, args, options);
    } catch {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (ok) child.unref?.();
      resolve(ok);
    };
    child.once("spawn", () => finish(true));
    child.once("error", () => finish(false));
  });
}

/** Open a blank terminal. Installer text is deliberately not accepted here,
 * so renderer-controlled input can never become a process argument. */
export async function openBlankTerminal(platform = process.platform, run = execFile) {
  if (platform === "darwin") {
    return launch(
      "osascript",
      ["-e", 'tell application "Terminal" to activate'],
      undefined,
      run,
    );
  }
  if (platform === "win32") {
    return launch("powershell.exe", ["-NoExit"], { windowsHide: false }, run);
  }
  if (platform === "linux") {
    for (const terminal of ["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"]) {
      if (await launch(terminal, [], undefined, run)) return true;
    }
  }
  return false;
}

/** Run a trusted command in a visible terminal. The command must be built in
 * the main process (for example, the bundled OpenCode sign-in path); never
 * pass renderer-controlled text here. */
export async function openTerminalCommand(command, platform = process.platform, run = execFile) {
  if (!command) return false;
  if (platform === "darwin") {
    return launch(
      "osascript",
      ["-e", `tell application "Terminal" to do script ${JSON.stringify(command)}`],
      undefined,
      run,
    );
  }
  if (platform === "win32") {
    return launch("powershell.exe", ["-NoExit", "-Command", command], { windowsHide: false }, run);
  }
  if (platform === "linux") {
    for (const [terminal, args] of [
      ["x-terminal-emulator", ["-e", "sh", "-lc", command]],
      ["gnome-terminal", ["--", "sh", "-lc", command]],
      ["konsole", ["-e", "sh", "-lc", command]],
      ["xterm", ["-e", "sh", "-lc", command]],
    ]) {
      if (await launch(terminal, args, undefined, run)) return true;
    }
  }
  return false;
}
