// Fetch the pinned OpenCode binary for a target platform into an extraResources
// directory. Run by the package scripts before electron-builder; the binary is
// never committed. KodBot updates it with app releases — the engine must not
// self-update, because ACP behaviour, permissions, and model catalogues change
// between versions and every update needs the app's test cycle.
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  OPENCODE_BUNDLED_VERSION,
  opencodeBinaryName,
  opencodePackageName,
} from "./opencode-package.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
};
const force = args.includes("--force");
const platform = value("--platform", process.platform);
const arch = value("--arch", process.arch);
const version = value("--version", OPENCODE_BUNDLED_VERSION);
const out = resolve(ROOT, value("--out", "resources/opencode"));
const binary = opencodeBinaryName(platform);
const target = join(out, binary);

if (existsSync(target) && !force) {
  const size = Math.round(statSync(target).size / 1024 / 1024);
  console.log(`OpenCode ${version} already staged for ${platform}/${arch} (${size} MB) — use --force to refetch`);
  process.exit(0);
}

const packageName = opencodePackageName(platform, arch);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const scratch = mkdtempSync(join(tmpdir(), "kodbot-opencode-"));
try {
  console.log(`Fetching ${packageName}@${version} for ${platform}/${arch}…`);
  execFileSync(npm, ["pack", `${packageName}@${version}`, "--pack-destination", scratch, "--silent"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "inherit"],
  });
  const tarball = readdirSync(scratch).find((entry) => entry.endsWith(".tgz"));
  if (!tarball) throw new Error(`npm pack produced no tarball for ${packageName}`);
  execFileSync("tar", ["-xzf", join(scratch, tarball), "-C", scratch], { stdio: "inherit" });

  const packageJson = JSON.parse(readFileSync(join(scratch, "package", "package.json"), "utf8"));
  if (packageJson.version !== version) {
    throw new Error(`Expected OpenCode ${version}, npm pack produced ${packageJson.version}`);
  }
  const source = join(scratch, "package", "bin", binary);
  if (!existsSync(source)) throw new Error(`The ${packageName} tarball has no bin/${binary}`);

  mkdirSync(out, { recursive: true });
  copyFileSync(source, target);
  chmodSync(target, 0o755);
  copyFileSync(join(ROOT, "LICENSES", "OpenCode-MIT.txt"), join(out, "LICENSE"));
  const size = Math.round(statSync(target).size / 1024 / 1024);
  console.log(`Staged OpenCode ${version} at ${target} (${size} MB)`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
