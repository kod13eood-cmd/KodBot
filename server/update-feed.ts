// The desktop updater feed is a public directory under the data root. Keep
// the surface to the files electron-updater actually asks for: Linux and
// Windows manifests, installers, AppImages, debs, and blockmaps. Anything
// else stays unreachable even if it lands in the directory.
const STABLE = new Set([
  "latest.yml",
  "latest-linux.yml",
  "KodBot-setup.exe",
  "KodBot.deb",
  "KodBot.AppImage",
]);

const VERSIONED =
  /^KodBot-[0-9A-Za-z][0-9A-Za-z._-]*-(?:setup\.exe(?:\.blockmap)?|amd64\.deb|x86_64\.AppImage)$/;

export function updateFileAllowed(name: string): boolean {
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) return false;
  return STABLE.has(name) || VERSIONED.test(name);
}

export function updateFileType(name: string): string {
  if (name.endsWith(".yml")) return "text/yaml; charset=utf-8";
  if (name.endsWith(".deb")) return "application/vnd.debian.binary-package";
  if (name.endsWith(".exe")) return "application/vnd.microsoft.portable-executable";
  return "application/octet-stream";
}
