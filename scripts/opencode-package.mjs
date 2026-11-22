/** Platform mapping for the OpenCode binary that ships with KodBot.
 *
 * The binary is fetched at package time from the official npm platform
 * package and lives in resources/opencode. It is pinned: KodBot updates it
 * with app releases, never by self-update. x64 builds use the baseline
 * package so older CPUs without AVX2 can still run it; arm64 uses the
 * standard build.
 */

export const OPENCODE_BUNDLED_VERSION = "1.19.6";

const PLATFORM_NAMES = {
  linux: "linux",
  darwin: "darwin",
  win32: "windows",
};

/** npm package that contains the executable for this target. */
export function opencodePackageName(platform, arch) {
  const mapped = PLATFORM_NAMES[platform];
  if (!mapped) throw new Error(`OpenCode has no package for platform ${platform}`);
  if (arch !== "x64" && arch !== "arm64") {
    throw new Error(`OpenCode has no package for arch ${arch}`);
  }
  const baseline = arch === "x64" ? "-baseline" : "";
  return `opencode-${mapped}-${arch}${baseline}`;
}

export function opencodeBinaryName(platform) {
  return platform === "win32" ? "opencode.exe" : "opencode";
}
