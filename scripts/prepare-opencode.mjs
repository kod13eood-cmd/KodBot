// Fetch the pinned OpenCode binary for a target platform into an extraResources
// directory. Run by the package scripts before electron-builder; the binary is
// never committed. KodBot updates it with app releases — the engine must not
// self-update, because ACP behaviour, permissions, and model catalogues change
// between versions and every update needs the app's test cycle.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

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

// A staged directory is for one target only; a leftover binary from a prior
// cross-build must not ride along in the installer.
rmSync(join(out, binary === "opencode.exe" ? "opencode" : "opencode.exe"), { force: true });

if (existsSync(target) && !force) {
  const size = Math.round(statSync(target).size / 1024 / 1024);
  console.log(`OpenCode ${version} already staged for ${platform}/${arch} (${size} MB) — use --force to refetch`);
  process.exit(0);
}

/** Read one exact file out of an npm tarball without a system tar binary.
 * npm tarballs are gzip + POSIX ustar; the paths we need are short, so the
 * 100-byte name field is enough and PAX/long-name records can be skipped. */
function extractTarGzFile(tarball, wanted, destination) {
  const tar = gunzipSync(readFileSync(tarball));
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const path = prefix ? `${prefix}/${name}` : name;
    const sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeText, 8) || 0;
    const dataStart = offset + 512;
    if (path === wanted) {
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, tar.subarray(dataStart, dataStart + size));
      return;
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  throw new Error(`The ${tarball} archive has no ${wanted}`);
}

async function fetchTarball(packageName, version, destination) {
  const metaUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${version}`;
  const metaResponse = await fetch(metaUrl, { signal: AbortSignal.timeout(20_000) });
  if (!metaResponse.ok) throw new Error(`npm registry metadata for ${packageName} answered HTTP ${metaResponse.status}`);
  const meta = await metaResponse.json();
  const tarball = meta.dist?.tarball;
  const integrity = meta.dist?.integrity;
  if (typeof tarball !== "string" || typeof integrity !== "string") {
    throw new Error(`npm registry metadata for ${packageName} has no tarball integrity`);
  }
  console.log(`Fetching ${packageName}@${version} for ${platform}/${arch}…`);
  const response = await fetch(tarball, {
    signal: AbortSignal.timeout(300_000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${tarball} answered HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const [algorithm, expected] = integrity.split("-");
  const actual = createHash(algorithm).update(bytes).digest("base64");
  if (actual !== expected) throw new Error(`Integrity mismatch for ${packageName}@${version}`);
  writeFileSync(destination, bytes);
}

const packageName = opencodePackageName(platform, arch);
const scratch = mkdtempSync(join(tmpdir(), "kodbot-opencode-"));
try {
  const tarball = join(scratch, "opencode.tgz");
  await fetchTarball(packageName, version, tarball);

  const scratchPackage = join(scratch, "package");
  extractTarGzFile(tarball, "package/package.json", join(scratchPackage, "package.json"));
  const packageJson = JSON.parse(readFileSync(join(scratchPackage, "package.json"), "utf8"));
  if (packageJson.version !== version) {
    throw new Error(`Expected OpenCode ${version}, npm produced ${packageJson.version}`);
  }

  mkdirSync(out, { recursive: true });
  extractTarGzFile(tarball, `package/bin/${binary}`, target);
  if (process.platform !== "win32") chmodSync(target, 0o755);
  copyFileSync(join(ROOT, "LICENSES", "OpenCode-MIT.txt"), join(out, "LICENSE"));
  const size = Math.round(statSync(target).size / 1024 / 1024);
  console.log(`Staged OpenCode ${version} at ${target} (${size} MB)`);

  // Only run the binary on its own platform. A cross-fetch for a Windows
  // installer must not try to execute the .exe on Linux (and vice versa).
  if (process.platform === platform) {
    const reported = execFileSync(target, ["--version"], { encoding: "utf8" }).trim();
    if (!reported.includes(version)) {
      throw new Error(`Bundled OpenCode reported ${reported}, expected ${version}`);
    }
    console.log(`Verified ${reported}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
