// Operator CLI. Invite-only means the owner can create accounts without an
// email provider; pass the one-time code out of band.
import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { stdin, stdout } from "node:process";
import { mkdirSync } from "node:fs";

import { AuthService } from "./auth.ts";
import { loadGatewayConfig } from "./config.ts";
import { hashPassword } from "./password.ts";
import { GatewayStore } from "./store.ts";

function usage(): never {
  console.log(`KodBot gateway admin

  owner --email <email> [--password <password>] [--data-dir <dir>]
  invite --email <email> [--days 7]
  passwd --email <email> [--password <password>]
  users
  devices --email <email>
  revoke-device --email <email> --id <deviceId>

Environment:
  OC_GATEWAY_DATA_DIR, OC_GATEWAY_TENANTS_DIR, OC_GATEWAY_OWNER_DATA_DIR
  OC_GATEWAY_CLI_PASSWORD (non-interactive password)
`);
  process.exit(1);
}

function args(argv: string[]): { command: string; flags: Map<string, string> } {
  const [command = "", ...rest] = argv;
  const flags = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) continue;
    const name = item.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(name, next);
      index += 1;
    } else {
      flags.set(name, "1");
    }
  }
  return { command, flags };
}

async function password(flags: Map<string, string>, prompt: string): Promise<string> {
  const inline = flags.get("password");
  const env = process.env.OC_GATEWAY_CLI_PASSWORD;
  if (inline) return inline;
  if (env) return env;
  if (!stdin.isTTY) throw new Error("Pass --password or set OC_GATEWAY_CLI_PASSWORD");
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`${prompt}: `);
  rl.close();
  return answer;
}

const { command, flags } = args(process.argv.slice(2));
if (!command) usage();

const config = loadGatewayConfig();
mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
const store = new GatewayStore(config.dataDir);
const auth = new AuthService(store, config);

try {
  if (command === "owner") {
    const email = flags.get("email");
    if (!email) usage();
    if (store.countUsers() > 0) throw new Error("an owner/account already exists; use invite/passwd instead");
    const value = await password(flags, "Owner password");
    const dataDir = flags.get("data-dir") || config.ownerDataDir;
    const user = store.createUser({
      id: randomUUID(),
      email,
      passwordHash: await hashPassword(value),
      role: "owner",
      dataDir,
      now: Date.now(),
    });
    console.log(`owner created: ${user.email}`);
    console.log(`data directory: ${user.dataDir}`);
  } else if (command === "invite") {
    const email = flags.get("email");
    if (!email) usage();
    const days = Number(flags.get("days") || "7");
    const owner = store.listUsers().find((user) => user.role === "owner");
    const result = auth.createInvite({
      email,
      createdBy: owner?.id,
      ttlMs: Number.isFinite(days) && days > 0 ? days * 86_400_000 : undefined,
    });
    console.log(`invite for ${email}:`);
    console.log(result.code);
    console.log(`expires: ${new Date(result.expiresAt).toISOString()}`);
  } else if (command === "passwd") {
    const email = flags.get("email");
    if (!email) usage();
    const value = await password(flags, "New password");
    await auth.setPassword(email, value);
    console.log(`password updated for ${email}; existing sessions were signed out`);
  } else if (command === "users") {
    for (const user of store.listUsers()) {
      console.log(`${user.role}\t${user.email}\t${user.dataDir}\t${new Date(user.createdAt).toISOString()}`);
    }
  } else if (command === "devices") {
    const email = flags.get("email");
    if (!email) usage();
    const user = store.findUserByEmail(email);
    if (!user) throw new Error(`no such user: ${email}`);
    for (const device of auth.listDevices(user.id)) {
      console.log(`${device.id}\t${device.name}\tlast ${new Date(device.lastSeenAt).toISOString()}${device.revokedAt ? "\trevoked" : ""}`);
    }
  } else if (command === "revoke-device") {
    const email = flags.get("email");
    const id = flags.get("id");
    if (!email || !id) usage();
    const user = store.findUserByEmail(email);
    if (!user) throw new Error(`no such user: ${email}`);
    if (!auth.revokeDevice(user.id, id)) throw new Error("no such active device");
    console.log(`revoked ${id}`);
  } else {
    usage();
  }
} finally {
  store.close();
}
