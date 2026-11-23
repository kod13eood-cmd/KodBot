import { existsSync } from "node:fs";
import { join } from "node:path";

/** Where the packaged OpenCode binary lives, or null when this build has no
 * bundled engine (a dev checkout before `pnpm prepare:opencode`, or an older
 * app). Packaged builds put it in Resources/opencode; the source checkout
 * stages the same directory under resources/opencode. */
export function resolveBundledOpenCode({
  isPackaged,
  resourcesPath,
  appPath,
  exists = existsSync,
}) {
  const dir = isPackaged
    ? join(resourcesPath, "opencode")
    : join(appPath, "resources", "opencode");
  return exists(dir) ? dir : null;
}

/** The executable inside a staged engine directory. */
export function bundledOpenCodeBinary(dir, platform = process.platform) {
  if (!dir) return null;
  return join(dir, platform === "win32" ? "opencode.exe" : "opencode");
}
