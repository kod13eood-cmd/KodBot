// Windows user PATH registration for the bundled OpenCode CLI. The app ships
// the binary inside its own install directory, so a fresh Solo install would
// otherwise only find it through the harness's OC_EXTRA_PATH. Adding that
// directory to the *user* PATH makes `opencode` work in a new cmd/PowerShell
// window too. This is idempotent and needs no administrator rights.
import { execFile } from "node:child_process";

/** Split a Windows PATH value and compare entries case-insensitively. */
export function pathContains(pathValue, dir) {
  const wanted = String(dir ?? "").trim().toLowerCase();
  if (!wanted) return false;
  return String(pathValue ?? "")
    .split(";")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .includes(wanted);
}

/** Append an entry once, preserving the existing order. */
export function appendPathEntry(pathValue, dir) {
  const current = String(pathValue ?? "").trim();
  if (!dir || pathContains(current, dir)) return current;
  return current ? `${current.replace(/;+$/, "")};${dir}` : dir;
}

/**
 * Ensure the bundled OpenCode directory is on the current user's PATH.
 * Runs PowerShell in the user context and broadcasts the environment change
 * through .NET, so new terminals see it without an admin prompt or a restart
 * of Explorer. Returns {changed:false} on non-Windows, on error, or when the
 * entry was already present.
 */
export function registerWindowsUserPath(
  dir,
  { platform = process.platform, env = process.env, run = execFile } = {},
) {
  if (platform !== "win32" || !dir) return Promise.resolve({ changed: false, reason: "not-applicable" });
  const script = [
    "$dir = $env:KODBOT_PATH_ENTRY.Trim()",
    "$current = [Environment]::GetEnvironmentVariable('Path','User')",
    "if ($null -eq $current) { $current = '' }",
    "$found = $false",
    "foreach ($part in $current.Split(';')) {",
    "  if ($part.Trim() -ieq $dir) { $found = $true; break }",
    "}",
    "if (-not $found) {",
    "  $next = if ([string]::IsNullOrWhiteSpace($current)) { $dir } else { $current.TrimEnd([char]59) + ';' + $dir }",
    "  [Environment]::SetEnvironmentVariable('Path', $next, 'User')",
    "  Write-Output 'added'",
    "} else { Write-Output 'present' }",
  ].join("\n");
  return new Promise((resolve) => {
    run(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        timeout: 20_000,
        env: { ...env, KODBOT_PATH_ENTRY: dir },
      },
      (error, stdout) => {
        if (error) {
          resolve({ changed: false, error: error instanceof Error ? error.message : String(error) });
          return;
        }
        if (env.PATH) env.PATH = appendPathEntry(env.PATH, dir);
        resolve({ changed: String(stdout ?? "").trim() === "added" });
      },
    );
  });
}
