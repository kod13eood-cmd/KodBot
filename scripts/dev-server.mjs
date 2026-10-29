// Dev-only launcher for the harness. The packaged app receives a hosted
// connected-apps broker token from Electron; a separately started dev server
// does not, which used to leave Connected apps permanently "unavailable".
// This wrapper registers one broker installation per developer machine,
// caches the token in the data dir (0600), and passes it to the server.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_BROKER_URL = "https://openmausbot-composio.milindsoni201.workers.dev";
const DATA_DIR = process.env.OC_DATA_DIR ?? join(homedir(), ".opencrew");
const CACHE_FILE = join(DATA_DIR, "dev-composio-broker.json");
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const BROKER_URL = (process.env.OC_COMPOSIO_BROKER_URL?.trim() || DEFAULT_BROKER_URL).replace(/\/$/, "");

function describe(error) {
  return error instanceof Error ? error.message : String(error);
}

async function cachedInstallation() {
  let cached;
  try {
    cached = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return null;
  }
  if (cached?.url !== BROKER_URL || !TOKEN_PATTERN.test(cached?.token ?? "")) return null;
  try {
    const check = await fetch(`${BROKER_URL}/v1/me`, {
      headers: { authorization: `Bearer ${cached.token}` },
      signal: AbortSignal.timeout(8_000),
    });
    // Only a definitive auth failure discards the identity. A transient
    // outage should not strand already-authorized accounts elsewhere.
    if (check.ok) return cached;
    if (check.status !== 401) return cached;
  } catch {
    return cached;
  }
  return null;
}

async function registerInstallation() {
  const response = await fetch(`${BROKER_URL}/v1/installations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`);
  if (!TOKEN_PATTERN.test(body?.token ?? "") || typeof body?.installationId !== "string") {
    throw new Error("the connected-apps service returned invalid credentials");
  }
  const cached = {
    url: BROKER_URL,
    token: body.token,
    installationId: body.installationId,
    createdAt: Date.now(),
  };
  mkdirSync(dirname(CACHE_FILE), { recursive: true });
  const temporary = `${CACHE_FILE}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(cached, null, 2), { mode: 0o600 });
  renameSync(temporary, CACHE_FILE);
  return cached;
}

let broker = null;
if (!process.env.COMPOSIO_API_KEY?.trim()) {
  const presetToken = process.env.OC_COMPOSIO_BROKER_TOKEN?.trim();
  try {
    broker = TOKEN_PATTERN.test(presetToken ?? "")
      ? { url: BROKER_URL, token: presetToken }
      : (await cachedInstallation()) ?? (await registerInstallation());
    console.log(`connected apps: dev broker ready (${broker.installationId ?? "preset token"})`);
  } catch (error) {
    console.warn(`connected apps: dev broker unavailable — ${describe(error)}`);
  }
}

const env = { ...process.env };
if (broker) {
  env.OC_COMPOSIO_BROKER_URL = broker.url;
  env.OC_COMPOSIO_BROKER_TOKEN = broker.token;
}

const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "server/index.ts", ...process.argv.slice(2)],
  { stdio: "inherit", env },
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 1));
