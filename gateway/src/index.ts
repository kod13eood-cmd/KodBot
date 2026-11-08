// Gateway entry point. The existing single-user harness is untouched; this
// process owns the public auth boundary and (in Phase 2) the per-user
// harness processes behind it.
import { mkdirSync } from "node:fs";

import { AuthService } from "./auth.ts";
import { loadGatewayConfig } from "./config.ts";
import { HarnessManager } from "./harness.ts";
import { createGatewayServer } from "./server.ts";
import { GatewayStore } from "./store.ts";

const config = loadGatewayConfig();
mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
mkdirSync(config.tenantsDir, { recursive: true, mode: 0o700 });
const store = new GatewayStore(config.dataDir);
const auth = new AuthService(store, config);
const harnesses = new HarnessManager(config);
const server = createGatewayServer({ config, store, auth, harnesses });

server.listen(config.port, config.host, () => {
  console.log(`KodBot gateway on http://${config.host}:${config.port}`);
  console.log(`public origin: ${config.publicOrigin}`);
  console.log(`control data:  ${config.dataDir}`);
  console.log(`tenant root:   ${config.tenantsDir}`);
  console.log(`owner data:    ${config.ownerDataDir}`);
  if (config.ownerHarnessPort > 0) {
    console.log(`owner harness: existing port ${config.ownerHarnessPort}`);
  }
  if (config.bootstrap && store.countUsers() === 0) {
    console.log("bootstrap is enabled: the first registration becomes the owner");
  }
});

const prune = setInterval(() => store.pruneExpired(), 10 * 60_000);
prune.unref();

function shutdown(signal: string) {
  console.log(`gateway stopping (${signal})`);
  harnesses.stopAll();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
