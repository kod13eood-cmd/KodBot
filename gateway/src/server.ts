// Gateway HTTP surface. Phase 1 owns auth, invites, devices, and the login
// page. Phase 2 adds the authenticated per-user harness proxy below the same
// auth boundary; until then non-auth API calls answer 503 instead of leaking
// an unauthenticated harness.
import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

import { AuthError, AuthService, type PublicUser } from "./auth.ts";
import type { GatewayConfig } from "./config.ts";
import { denyReason } from "./device-routes.ts";
import { HarnessManager, proxyToHarness } from "./harness.ts";
import { loginPage, type GatewayLang } from "./login-page.ts";
import type { GatewayStore } from "./store.ts";

const COOKIE = "kodbot_session";
const LANG_COOKIE = "kodbot_lang";
const MAX_BODY = 64 * 1024;
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".md": "text/markdown; charset=utf-8",
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function redirect(res: ServerResponse, location: string) {
  res.writeHead(303, { location, "cache-control": "no-store" });
  res.end();
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(req.headers.cookie ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

function gatewayLang(req: IncomingMessage, url: URL): GatewayLang {
  const requested = url.searchParams.get("lang");
  if (requested === "bg" || requested === "en") return requested;
  const saved = parseCookies(req)[LANG_COOKIE];
  if (saved === "bg" || saved === "en") return saved;
  return String(req.headers["accept-language"] ?? "").toLowerCase().startsWith("bg") ? "bg" : "en";
}

function bearer(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== "string") return undefined;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}

function sessionToken(req: IncomingMessage): string | undefined {
  return bearer(req) ?? parseCookies(req)[COOKIE];
}

function cookie(value: string, maxAge: number, secure: boolean): string {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}${secure ? "; Secure" : ""}`;
}

function clearCookie(secure: boolean): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

function readBody(req: IncomingMessage, maxSize = MAX_BODY): Promise<Buffer> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(Object.assign(new Error("body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function bodyObject(req: IncomingMessage, raw: Buffer): Record<string, string> {
  const type = String(req.headers["content-type"] ?? "");
  if (type.includes("application/json")) {
    try {
      const value = JSON.parse(raw.toString("utf8")) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, typeof item === "string" ? item : String(item ?? "")]),
      );
    } catch {
      throw Object.assign(new Error("invalid JSON body"), { status: 400 });
    }
  }
  return Object.fromEntries(new URLSearchParams(raw.toString("utf8")));
}

function wantsJson(req: IncomingMessage): boolean {
  return String(req.headers["content-type"] ?? "").includes("application/json")
    || String(req.headers.accept ?? "").includes("application/json");
}

function clientIp(req: IncomingMessage, config: GatewayConfig): string | undefined {
  if (config.trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
    if (first?.trim()) return first.trim();
  }
  return req.socket.remoteAddress ?? undefined;
}

function allowedHost(config: GatewayConfig, host: string | undefined): boolean {
  if (!host) return false;
  const value = host.trim().toLowerCase();
  if (config.allowedHosts.some((entry) => entry === value)) return true;
  let hostname = value;
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close < 0) return false;
    hostname = value.slice(1, close);
  } else {
    const firstColon = value.indexOf(":");
    const lastColon = value.lastIndexOf(":");
    if (firstColon >= 0 && firstColon === lastColon) hostname = value.slice(0, firstColon);
  }
  if (config.allowedHosts.some((entry) => entry === hostname)) return true;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0:0:0:0:0:0:0:1";
}

function allowedOrigin(config: GatewayConfig, origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (config.publicOrigin && origin.replace(/\/$/, "") === config.publicOrigin) return true;
    return allowedHost(config, url.host.toLowerCase());
  } catch {
    return false;
  }
}

export interface GatewayDeps {
  config: GatewayConfig;
  store: GatewayStore;
  auth: AuthService;
  /** Phase 2 routes authenticated API traffic to a per-user harness. */
  harnesses?: HarnessManager;
  /** Tests can serve without the static UI. */
  serveStatic?: boolean;
}

function ownerOf(req: IncomingMessage, auth: AuthService): PublicUser | null {
  const current = auth.session(sessionToken(req));
  return current?.user.role === "owner" ? current.user : null;
}

function adminPassword(): string {
  return `KodBot-${randomBytes(5).toString("hex")}!`;
}

export function createGatewayServer({ config, store, auth, harnesses, serveStatic = true }: GatewayDeps): Server {
  return createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const host = req.headers.host;
    if (!allowedHost(config, host)) {
      return json(res, 403, { error: "forbidden host" });
    }
    if (!allowedOrigin(config, typeof req.headers.origin === "string" ? req.headers.origin : undefined)) {
      return json(res, 403, { error: "forbidden origin" });
    }
    const url = new URL(req.url ?? "/", config.publicOrigin);
    const path = url.pathname;

    try {
      if (method === "GET" && path === "/api/health") {
        return json(res, 200, { app: "kodbot-gateway", ok: true });
      }

      if (method === "GET" && path === "/login") {
        const current = auth.session(sessionToken(req));
        if (current) return redirect(res, "/");
        const error = url.searchParams.get("error") ?? undefined;
        const mode = url.searchParams.get("mode") === "register" ? "register" : "login";
        const lang = gatewayLang(req, url);
        if (url.searchParams.get("lang")) {
          res.setHeader("set-cookie", `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`);
        }
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        return res.end(loginPage({ config, hasUsers: store.countUsers() > 0, error, mode, lang }));
      }

      if (method === "POST" && path === "/api/auth/login") {
        const body = bodyObject(req, await readBody(req));
        const issued = await auth.login({
          email: body.email ?? "",
          password: body.password ?? "",
          ip: clientIp(req, config),
          userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        });
        if (wantsJson(req)) return json(res, 200, { user: issued.user, token: issued.token });
        res.setHeader("set-cookie", cookie(issued.token, config.sessionTtlMs, config.secureCookies));
        return redirect(res, "/");
      }

      if (method === "POST" && path === "/api/auth/register") {
        const body = bodyObject(req, await readBody(req));
        if (body.confirm !== undefined && body.confirm !== body.password) {
          throw new AuthError(400, "Passwords do not match.");
        }
        const issued = await auth.register({
          email: body.email ?? "",
          password: body.password ?? "",
          invite: body.invite,
          ip: clientIp(req, config),
          userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        });
        if (wantsJson(req)) return json(res, 201, { user: issued.user, token: issued.token });
        res.setHeader("set-cookie", cookie(issued.token, config.sessionTtlMs, config.secureCookies));
        return redirect(res, "/");
      }

      // Explicit mobile login: always JSON, never a cookie.
      if (method === "POST" && path === "/api/auth/token") {
        const body = bodyObject(req, await readBody(req));
        const issued = await auth.login({
          email: body.email ?? "",
          password: body.password ?? "",
          ip: clientIp(req, config),
          userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        });
        return json(res, 200, { user: issued.user, token: issued.token });
      }

      if (method === "POST" && path === "/api/auth/logout") {
        const token = sessionToken(req);
        auth.logout(token);
        res.setHeader("set-cookie", clearCookie(config.secureCookies));
        if (wantsJson(req)) return json(res, 200, { ok: true });
        return redirect(res, "/login");
      }

      if (method === "GET" && path === "/api/auth/me") {
        const current = auth.session(sessionToken(req));
        if (!current) return json(res, 401, { error: "not signed in", login: "/login" });
        return json(res, 200, { user: current.user });
      }

      // Owner-only control plane. The owner is the gateway administrator;
      // members cannot list users, mint invites, reset passwords, or disable
      // accounts. These routes never reach a tenant harness.
      if (path.startsWith("/api/admin/")) {
        const owner = ownerOf(req, auth);
        if (!owner) return json(res, 403, { error: "owner access required" });
      }

      if (method === "GET" && path === "/api/admin/users") {
        return json(res, 200, {
          users: store.listUsers().map((user) => ({
            id: user.id,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            disabledAt: user.disabledAt,
          })),
        });
      }

      if (method === "GET" && path === "/api/admin/invites") {
        return json(res, 200, {
          invites: store.listInvites().map((invite) => ({
            id: invite.id,
            email: invite.email,
            createdAt: invite.createdAt,
            expiresAt: invite.expiresAt,
            usedAt: invite.usedAt,
          })),
        });
      }

      if (method === "POST" && path === "/api/admin/invites") {
        const body = bodyObject(req, await readBody(req));
        const email = typeof body.email === "string" ? body.email.trim() : "";
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          return json(res, 400, { error: "Enter a valid email address." });
        }
        const days = Number(body.days ?? 7);
        const ttlMs = Number.isFinite(days) && days > 0 ? Math.min(90, days) * 86_400_000 : undefined;
        const invite = auth.createInvite({ email: email || undefined, createdBy: ownerOf(req, auth)?.id, ttlMs });
        return json(res, 201, { code: invite.code, email: email || null, expiresAt: invite.expiresAt });
      }

      const adminInviteMatch = path.match(/^\/api\/admin\/invites\/([\w-]+)$/);
      if (adminInviteMatch && method === "DELETE") {
        if (!store.deleteInvite(adminInviteMatch[1])) return json(res, 404, { error: "no such pending invite" });
        return json(res, 200, { ok: true });
      }

      // Owner-published shared bot templates. Only the persona and the
      // redacted core memory are stored; turns still run in each member's
      // harness with their own key, so the gateway never executes a bot.
      if (method === "POST" && path === "/api/admin/shared-bots") {
        const body = bodyObject(req, await readBody(req, 320 * 1024));
        const name = String(body.name ?? "").trim();
        if (!name) return json(res, 400, { error: "name is required" });
        if (name.length > 100) return json(res, 400, { error: "name is too long" });
        const title = String(body.title ?? "").trim();
        if (title.length > 200) return json(res, 400, { error: "title is too long" });
        const description = String(body.description ?? "").trim();
        if (description.length > 4_000) return json(res, 400, { error: "description is too long" });
        const memory = typeof body.memory === "string" ? body.memory : "";
        if (Buffer.byteLength(memory, "utf8") > 256 * 1024) {
          return json(res, 400, { error: "memory is too large" });
        }
        const created = store.createSharedBot({
          id: randomUUID(),
          name,
          title: title || null,
          description: description || null,
          memory,
          createdBy: ownerOf(req, auth)?.id ?? null,
        });
        return json(res, 201, {
          bot: {
            id: created.id,
            name: created.name,
            title: created.title,
            description: created.description,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          },
        });
      }

      const adminSharedMatch = path.match(/^\/api\/admin\/shared-bots\/([\w-]+)$/);
      if (adminSharedMatch && method === "DELETE") {
        if (!store.deleteSharedBot(adminSharedMatch[1])) return json(res, 404, { error: "no such shared bot" });
        return json(res, 200, { ok: true });
      }

      const adminUserMatch = path.match(/^\/api\/admin\/users\/([\w-]+)(\/password|\/disabled|\/sessions)?$/);
      if (adminUserMatch) {
        const user = store.findUserById(adminUserMatch[1]);
        if (!user) return json(res, 404, { error: "no such user" });
        const action = adminUserMatch[2] ?? "";
        if (method === "POST" && action === "/password") {
          const body = bodyObject(req, await readBody(req));
          const requested = typeof body.password === "string" ? body.password : "";
          const password = requested.trim() || adminPassword();
          await auth.setPassword(user.email, password);
          return json(res, 200, { email: user.email, password });
        }
        if (method === "POST" && action === "/disabled") {
          const body = bodyObject(req, await readBody(req));
          const raw = String(body.disabled ?? "");
          if (raw !== "true" && raw !== "false") {
            return json(res, 400, { error: "disabled must be true or false" });
          }
          const disabled = raw === "true";
          if (user.role === "owner" && disabled) {
            return json(res, 409, { error: "the owner account cannot be disabled" });
          }
          store.setUserDisabled(user.id, disabled);
          if (disabled) store.deleteUserSessions(user.id);
          return json(res, 200, { ok: true, disabled });
        }
        if (method === "DELETE" && action === "/sessions") {
          store.deleteUserSessions(user.id);
          return json(res, 200, { ok: true });
        }
      }

      // Shared bot templates are readable by every signed-in member; the
      // gateway stores the persona and redacted memory only. Detail includes
      // memory because "install" copies it into the member's own bot.
      const sharedMatch = path.match(/^\/api\/shared-bots\/([\w-]+)$/);
      if (method === "GET" && (path === "/api/shared-bots" || sharedMatch)) {
        const current = auth.session(sessionToken(req));
        if (!current) return json(res, 401, { error: "not signed in", login: "/login" });
        if (path === "/api/shared-bots") return json(res, 200, { bots: store.listSharedBots() });
        if (!sharedMatch) return json(res, 404, { error: "no such shared bot" });
        const bot = store.getSharedBot(sharedMatch[1]);
        if (!bot) return json(res, 404, { error: "no such shared bot" });
        return json(res, 200, {
          bot: {
            id: bot.id,
            name: bot.name,
            title: bot.title,
            description: bot.description,
            memory: bot.memory,
            createdAt: bot.createdAt,
            updatedAt: bot.updatedAt,
          },
        });
      }

      if (path.startsWith("/api/admin/")) {
        return json(res, 404, { error: "not found" });
      }

      if (method === "POST" && path === "/api/device/pairing") {
        const current = auth.session(sessionToken(req));
        if (!current) return json(res, 401, { error: "not signed in", login: "/login" });
        const pairing = auth.openPairing(current.user.id);
        const publicUrl = new URL(config.publicOrigin);
        const hosts = [...new Set([
          publicUrl.origin,
          ...config.allowedHosts.map((host) => `${publicUrl.protocol}//${host}`),
        ])];
        const qr = `kodbot://pair?address=${encodeURIComponent(publicUrl.origin)}&token=${encodeURIComponent(pairing.token)}&name=${encodeURIComponent("KodBot")}&hosts=${encodeURIComponent(hosts.join(","))}`;
        return json(res, 200, { ...pairing, qr, hosts, serverName: "KodBot" });
      }

      // Unauthenticated by design: this is the one route a phone hits before
      // it has a device token. It is rate-limited in AuthService.
      if (method === "POST" && path === "/api/pair") {
        const body = bodyObject(req, await readBody(req));
        const credential = body.credential ?? body.code ?? "";
        const issued = auth.redeemPairing(credential, body.deviceName, clientIp(req, config));
        const publicUrl = new URL(config.publicOrigin);
        return json(res, 200, {
          token: issued.token,
          serverName: "KodBot",
          hosts: [...new Set([
            publicUrl.origin,
            ...config.allowedHosts.map((host) => `${publicUrl.protocol}//${host}`),
          ])],
        });
      }

      if (method === "GET" && path === "/api/devices") {
        const current = auth.session(sessionToken(req));
        if (!current) return json(res, 401, { error: "not signed in", login: "/login" });
        return json(res, 200, { devices: auth.listDevices(current.user.id) });
      }

      const deviceMatch = path.match(/^\/api\/devices\/([\w-]+)$/);
      if (deviceMatch && method === "DELETE") {
        const current = auth.session(sessionToken(req));
        if (!current) return json(res, 401, { error: "not signed in", login: "/login" });
        if (!auth.revokeDevice(current.user.id, deviceMatch[1])) {
          return json(res, 404, { error: "no such device" });
        }
        return json(res, 200, { ok: true });
      }

      if (path.startsWith("/api/")) {
        if (!harnesses) {
          return json(res, 503, { error: "tenant harness proxy is not available yet" });
        }
        const token = sessionToken(req);
        const current = auth.session(token);
        const device = current ? null : auth.device(token);
        if (!current && !device) {
          return json(res, 401, { error: "not signed in", login: "/login" });
        }
        if (device) {
          const denial = denyReason({ path, method, authenticated: true });
          if (denial) return json(res, denial.status, { error: denial.error });
        }
        const owner = auth.userById(current?.user.id ?? device!.user.id);
        if (!owner) return json(res, 401, { error: "account is unavailable", login: "/login" });
        const harness = await harnesses.ensure(owner);
        return proxyToHarness(req, res, harness.port);
      }

      if (serveStatic) {
        const current = auth.session(sessionToken(req));
        if (!current) return redirect(res, `/login?next=${encodeURIComponent(path)}`);
        return serveStaticFile(res, config.staticDir, path);
      }
      return json(res, 404, { error: "not found" });
    } catch (error) {
      const status = error instanceof AuthError ? error.status : Number((error as { status?: number })?.status) || 500;
      const message = error instanceof Error ? error.message : String(error);
      if (wantsJson(req) || path.startsWith("/api/")) return json(res, status, { error: message });
      const mode = path === "/api/auth/register" ? "register" : "login";
      const lang = gatewayLang(req, url);
      return redirect(res, `/login?error=${encodeURIComponent(message)}&mode=${mode}&lang=${lang}`);
    }
  });
}

function serveStaticFile(res: ServerResponse, root: string, path: string): void {
  const safeRoot = resolve(root);
  const relative = path === "/" ? "index.html" : path.replace(/^\/+/, "");
  let file = resolve(join(safeRoot, relative));
  if (file !== safeRoot && !file.startsWith(safeRoot + sep)) {
    return json(res, 403, { error: "forbidden" });
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    file = join(safeRoot, "index.html");
    if (!existsSync(file)) return json(res, 404, { error: "UI not built" });
  }
  res.writeHead(200, {
    "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
    "cache-control": file.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable",
  });
  res.end(readFileSync(file));
}

export type { PublicUser };
