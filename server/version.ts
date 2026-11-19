// The harness version, shown in Settings → About. The bundled server gets it
// injected at build time (scripts/bundle-server.mjs); dev and tests read the
// package file next to the source tree.
import { readFileSync } from "node:fs";

export const APP_VERSION = (() => {
  const injected = process.env.OC_APP_VERSION?.trim();
  if (injected) return injected;
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version?: unknown;
    };
    return typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : "dev";
  } catch {
    return "dev";
  }
})();
