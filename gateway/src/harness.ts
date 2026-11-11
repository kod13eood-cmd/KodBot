// One isolated single-user harness per account. The gateway is the only
// public listener; each child binds loopback and keeps its own data dir.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { request, type IncomingMessage, type ServerResponse } from "node:http";

import type { GatewayConfig } from "./config.ts";
import type { UserRecord } from "./store.ts";

export interface Harness {
  userId: string;
  port: number;
  /** Null for the owner's pre-existing harness in transitional deployments. */
  child: ChildProcess | null;
  managed: boolean;
  startedAt: number;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error("no free port"))));
    });
  });
}

export class HarnessManager {
  private pending = new Map<string, Promise<Harness>>();
  private running = new Map<string, Harness>();

  constructor(private readonly config: GatewayConfig) {}

  async ensure(user: UserRecord): Promise<Harness> {
    if (user.role === "owner" && this.config.ownerHarnessPort > 0) {
      const existing = this.running.get(user.id);
      if (existing) return existing;
      // Transitional deployment: the owner's single-user harness already runs
      // on 8799. Do not start a second process on the same data directory.
      const harness: Harness = {
        userId: user.id,
        port: this.config.ownerHarnessPort,
        child: null,
        managed: false,
        startedAt: Date.now(),
      };
      this.running.set(user.id, harness);
      return harness;
    }
    const existing = this.running.get(user.id);
    if (existing && (!existing.managed || existing.child?.exitCode === null)) return existing;
    const inFlight = this.pending.get(user.id);
    if (inFlight) return inFlight;
    const promise = this.start(user).finally(() => {
      if (this.pending.get(user.id) === promise) this.pending.delete(user.id);
    });
    this.pending.set(user.id, promise);
    return promise;
  }

  private async start(user: UserRecord): Promise<Harness> {
    if (!existsSync(this.config.serverBundle)) {
      throw new Error(`harness bundle not found: ${this.config.serverBundle}`);
    }
    mkdirSync(user.dataDir, { recursive: true, mode: 0o700 });
    let port = await freePort();
    let webhookPort = await freePort();
    for (let attempt = 0; webhookPort === port && attempt < 5; attempt += 1) {
      webhookPort = await freePort();
    }

    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith("OC_GATEWAY_")) delete env[key];
    }
    delete env.OC_DATA_DIR;
    delete env.OC_PORT;
    delete env.OC_HOST;
    delete env.OC_WEBHOOK_PORT;
    delete env.OC_STATIC_DIR;
    delete env.OC_ALLOWED_HOSTS;
    env.OC_DATA_DIR = user.dataDir;
    env.OC_HOST = "127.0.0.1";
    env.OC_PORT = String(port);
    env.OC_WEBHOOK_PORT = String(webhookPort);
    env.OC_STATIC_DIR = "";
    env.OC_ALLOWED_HOSTS = "127.0.0.1,localhost";
    if (user.role !== "owner") {
      // Managed connected apps are provisioned per installation, not per
      // KodBot user. New tenants stay off the owner's Composio identity
      // until the broker supports per-user installations.
      delete env.OC_COMPOSIO_BROKER_URL;
      delete env.OC_COMPOSIO_BROKER_TOKEN;
    }

    const child = spawn(process.execPath, [this.config.serverBundle], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stderr: string[] = [];
    child.stderr?.on("data", (chunk: Buffer) => {
      const line = chunk.toString("utf8").trimEnd();
      if (!line) return;
      stderr.push(line);
      if (stderr.length > 20) stderr.shift();
    });
    child.stdout?.on("data", () => {
      /* drain; provider output belongs to the tenant, not the gateway log */
    });

    const harness: Harness = { userId: user.id, port, child, managed: true, startedAt: Date.now() };
    let healthy = false;
    const exited = new Promise<never>((_, reject) => {
      child.once("exit", (code, signal) => {
        this.running.delete(user.id);
        if (!healthy) {
          reject(new Error(`harness for ${user.email} exited (${code ?? signal ?? "unknown"})${stderr.length ? `: ${stderr.at(-1)}` : ""}`));
        }
      });
    });
    // The race below owns the first rejection; a later exit after a healthy
    // start must not surface as an unhandled rejection.
    exited.catch(() => {});

    this.running.set(user.id, harness);
    try {
      await Promise.race([this.waitReady(port, child), exited]);
      healthy = true;
      return harness;
    } catch (error) {
      if (child.exitCode === null) child.kill("SIGTERM");
      this.running.delete(user.id);
      throw error;
    }
  }

  private async waitReady(port: number, child: ChildProcess): Promise<void> {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`harness exited with ${child.exitCode}`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
          signal: AbortSignal.timeout(1_000),
        });
        if (response.ok) return;
      } catch {
        /* not listening yet */
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`harness did not become healthy on port ${port}`);
  }

  stopAll(): void {
    for (const harness of this.running.values()) {
      if (!harness.managed) continue;
      try {
        harness.child?.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
    this.running.clear();
    this.pending.clear();
  }
}

/** Stream a request to a tenant harness. The gateway has already
 * authenticated the caller; the harness only sees a loopback request. */
export function proxyToHarness(req: IncomingMessage, res: ServerResponse, port: number): void {
  const headers: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (!value) continue;
    if (["host", "cookie", "authorization", "origin", "referer", "x-forwarded-for", "x-forwarded-proto", "connection", "transfer-encoding"].includes(name.toLowerCase())) {
      continue;
    }
    headers[name] = value;
  }
  headers.host = `127.0.0.1:${port}`;
  const upstream = request(
    {
      hostname: "127.0.0.1",
      port,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const responseHeaders: Record<string, string | string[]> = {};
      for (const [name, value] of Object.entries(upstreamRes.headers)) {
        if (!value) continue;
        if (["connection", "keep-alive", "transfer-encoding"].includes(name.toLowerCase())) continue;
        responseHeaders[name] = value;
      }
      res.writeHead(upstreamRes.statusCode ?? 502, responseHeaders);
      res.flushHeaders();
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    res.writeHead(502, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ error: `tenant harness unavailable: ${error.message}` }));
  });
  res.on("close", () => {
    if (!res.writableEnded) upstream.destroy();
  });
  req.pipe(upstream);
}
