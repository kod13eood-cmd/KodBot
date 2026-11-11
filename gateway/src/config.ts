// Gateway configuration. The gateway is the only public listener; every
// tenant harness stays on loopback with its own data directory.
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface GatewayConfig {
  /** Control-plane SQLite + logs. Never a tenant data directory. */
  dataDir: string;
  /** New users get <tenantsDir>/<userId>. */
  tenantsDir: string;
  /** The existing single-user state becomes the owner's tenant. */
  ownerDataDir: string;
  host: string;
  port: number;
  publicOrigin: string;
  /** Existing harness port for the owner during the transition; 0 = spawn. */
  ownerHarnessPort: number;
  staticDir: string;
  serverBundle: string;
  secureCookies: boolean;
  /** Trust X-Forwarded-For from a local reverse proxy (Caddy/nginx). */
  trustProxy: boolean;
  /** Let the first registration create the owner without an invite. Use once. */
  bootstrap: boolean;
  allowedHosts: string[];
  sessionTtlMs: number;
  inviteTtlMs: number;
  pairingTtlMs: number;
  maxPairingAttempts: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const dataDir = resolve(
    env.OC_GATEWAY_DATA_DIR?.trim() || join(homedir(), ".kodbot-gateway"),
  );
  const tenantsDir = resolve(
    env.OC_GATEWAY_TENANTS_DIR?.trim() || join(homedir(), ".kodbot-tenants"),
  );
  const ownerDataDir = resolve(
    env.OC_GATEWAY_OWNER_DATA_DIR?.trim() || join(homedir(), ".kodbot"),
  );
  const port = Number(env.OC_GATEWAY_PORT || 8780);
  const publicOrigin = (env.OC_GATEWAY_PUBLIC_ORIGIN?.trim() || `http://localhost:${port}`).replace(/\/$/, "");
  const allowedHosts = new Set<string>();
  for (const entry of (env.OC_GATEWAY_ALLOWED_HOSTS ?? "").split(",")) {
    const host = entry.trim().toLowerCase();
    if (host) allowedHosts.add(host);
  }
  try {
    allowedHosts.add(new URL(publicOrigin).host.toLowerCase());
  } catch {
    throw new Error(`OC_GATEWAY_PUBLIC_ORIGIN is not a URL: ${publicOrigin}`);
  }
  return {
    dataDir,
    tenantsDir,
    ownerDataDir,
    host: env.OC_GATEWAY_HOST?.trim() || "127.0.0.1",
    port,
    publicOrigin,
    ownerHarnessPort: Number(env.OC_GATEWAY_OWNER_HARNESS_PORT || 0),
    staticDir: resolve(env.OC_GATEWAY_STATIC_DIR?.trim() || "dist"),
    serverBundle: resolve(
      env.OC_GATEWAY_SERVER_BUNDLE?.trim() || "dist-server/index.js",
    ),
    secureCookies: env.OC_GATEWAY_SECURE_COOKIES === "1" || publicOrigin.startsWith("https:"),
    trustProxy: env.OC_GATEWAY_TRUST_PROXY === "1",
    bootstrap: env.OC_GATEWAY_BOOTSTRAP === "1",
    allowedHosts: [...allowedHosts],
    sessionTtlMs: Number(env.OC_GATEWAY_SESSION_TTL_MS || 30 * DAY),
    inviteTtlMs: Number(env.OC_GATEWAY_INVITE_TTL_MS || 7 * DAY),
    pairingTtlMs: Number(env.OC_GATEWAY_PAIRING_TTL_MS || 2 * 60_000),
    maxPairingAttempts: Number(env.OC_GATEWAY_PAIRING_ATTEMPTS || 5),
  };
}
