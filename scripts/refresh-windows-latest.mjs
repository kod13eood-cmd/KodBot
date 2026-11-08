// Recompute the Windows updater manifest after SignPath changes the installer
// bytes. Signing invalidates both the sha512 and the size that electron-builder
// wrote for the unsigned file.
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";

const [installer, latest] = process.argv.slice(2);
if (!installer || !latest) {
  console.error("usage: node scripts/refresh-windows-latest.mjs <installer.exe> <latest.yml>");
  process.exit(2);
}

const bytes = readFileSync(installer);
const size = statSync(installer).size;
const sha512 = createHash("sha512").update(bytes).digest("base64");
const yaml = readFileSync(latest, "utf8")
  .replace(/^(\s*sha512:\s*).*$/gm, `$1${sha512}`)
  .replace(/^(\s*size:\s*).*$/gm, `$1${size}`);
writeFileSync(latest, yaml);

console.log(JSON.stringify({ installer, size, sha512 }));
