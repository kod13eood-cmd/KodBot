// Account, session, invite, device and pairing rules. The HTTP layer only
// translates these results; every security decision lives here.
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { GatewayConfig } from "./config.ts";
import { burnPasswordCheck, hashPassword, passwordProblem, verifyPassword } from "./password.ts";
import {
  hashToken,
  newDeviceToken,
  newInviteCode,
  newPairingCode,
  newPairingToken,
  newSessionToken,
  tokenKind,
} from "./tokens.ts";
import type { DeviceRecord, GatewayStore, SessionRecord, UserRecord } from "./store.ts";

export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface PublicUser {
  id: string;
  email: string;
  role: "owner" | "member";
  createdAt: number;
}

export interface IssuedSession {
  user: PublicUser;
  token: string;
  session: SessionRecord;
}

export interface IssuedDevice {
  device: DeviceRecord;
  token: string;
}

export interface PairingWindow {
  code: string;
  token: string;
  expiresAt: number;
}

export function publicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) throw new AuthError(400, "Enter a valid email address.");
  return email;
}

function cleanDeviceName(raw: unknown): string {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 60);
  return name || "Companion";
}

/** Small in-memory sliding window. Enough for a single gateway process; a
 * multi-replica deployment should move this to the shared store. */
class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((at) => at > cutoff);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) {
      for (const [name, times] of this.hits) {
        if (!times.some((at) => at > cutoff)) this.hits.delete(name);
      }
    }
    return true;
  }

  reset(key: string) {
    this.hits.delete(key);
  }
}

export class AuthService {
  private loginLimiter = new RateLimiter(10, 15 * 60_000);
  private pairLimiter = new RateLimiter(20, 2 * 60_000);

  constructor(
    private readonly store: GatewayStore,
    private readonly config: GatewayConfig,
    private readonly clock: () => number = Date.now,
  ) {}

  private newSession(user: UserRecord, meta?: { userAgent?: string; ip?: string }): IssuedSession {
    const token = newSessionToken();
    const now = this.clock();
    const session = this.store.createSession({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashToken(token),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + this.config.sessionTtlMs,
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
    });
    return { user: publicUser(user), token, session };
  }

  async register(input: {
    email: string;
    password: string;
    invite?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<IssuedSession> {
    const email = normalizeEmail(input.email);
    const password = input.password;
    const problem = passwordProblem(password);
    if (problem) throw new AuthError(400, problem);
    if (this.store.findUserByEmail(email)) throw new AuthError(409, "An account with that email already exists.");

    const first = this.store.countUsers() === 0;
    const userId = randomUUID();
    let role: "owner" | "member" = "member";
    let dataDir = join(this.config.tenantsDir, userId);
    let inviteId: string | null = null;

    if (first) {
      if (!this.config.bootstrap) {
        throw new AuthError(403, "The owner account has not been created yet. Ask the operator for an invite.");
      }
      role = "owner";
      dataDir = this.config.ownerDataDir;
    } else {
      const code = input.invite?.trim();
      if (!code) throw new AuthError(403, "An invite code is required.");
      const invite = this.store.findInviteByHash(hashToken(code));
      const now = this.clock();
      if (!invite || invite.usedAt !== null || invite.expiresAt <= now) {
        throw new AuthError(403, "That invite is invalid or has expired.");
      }
      if (invite.email && invite.email.toLowerCase() !== email) {
        throw new AuthError(403, "That invite belongs to a different email address.");
      }
      inviteId = invite.id;
    }

    const passwordHash = await hashPassword(password);
    let user: UserRecord;
    if (inviteId) {
      try {
        user = this.store.createUserWithInvite({
          id: userId,
          email,
          passwordHash,
          role,
          dataDir,
          now: this.clock(),
          inviteId,
        });
      } catch {
        throw new AuthError(409, "That invite has already been used.");
      }
    } else {
      try {
        user = this.store.createUser({
          id: userId,
          email,
          passwordHash,
          role,
          dataDir,
          now: this.clock(),
        });
      } catch {
        throw new AuthError(409, "The owner account already exists.");
      }
    }
    try {
      mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    } catch {
      // The harness will surface a useful error if the directory is unusable.
    }
    return this.newSession(user, { ip: input.ip, userAgent: input.userAgent });
  }

  async login(input: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
  }): Promise<IssuedSession> {
    let email: string;
    try {
      email = normalizeEmail(input.email);
    } catch {
      throw new AuthError(401, "Email or password is wrong.");
    }
    const key = `${input.ip ?? "unknown"}|${email}`;
    if (!this.loginLimiter.allow(key, this.clock())) {
      throw new AuthError(429, "Too many sign-in attempts. Try again later.");
    }
    const user = this.store.findUserByEmail(email);
    if (!user || user.disabledAt !== null) {
      await burnPasswordCheck(input.password);
      throw new AuthError(401, "Email or password is wrong.");
    }
    if (!(await verifyPassword(input.password, user.passwordHash))) {
      throw new AuthError(401, "Email or password is wrong.");
    }
    this.loginLimiter.reset(key);
    return this.newSession(user, { ip: input.ip, userAgent: input.userAgent });
  }

  async setPassword(email: string, password: string): Promise<void> {
    const problem = passwordProblem(password);
    if (problem) throw new AuthError(400, problem);
    const user = this.store.findUserByEmail(normalizeEmail(email));
    if (!user) throw new AuthError(404, "No account with that email.");
    this.store.setPassword(user.id, await hashPassword(password));
    this.store.deleteUserSessions(user.id);
  }

  createInvite(input: {
    email?: string;
    createdBy?: string;
    ttlMs?: number;
  }): { code: string; expiresAt: number } {
    const code = newInviteCode();
    const now = this.clock();
    const expiresAt = now + (input.ttlMs ?? this.config.inviteTtlMs);
    this.store.createInvite({
      id: randomUUID(),
      codeHash: hashToken(code),
      email: input.email ? normalizeEmail(input.email) : null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      expiresAt,
    });
    return { code, expiresAt };
  }

  /** Resolve a session token from a cookie or bearer header. */
  session(token: string | undefined): { user: PublicUser; session: SessionRecord } | null {
    if (!token || tokenKind(token) !== "session") return null;
    const row = this.store.findSessionByHash(hashToken(token));
    const now = this.clock();
    if (!row || row.expiresAt <= now) {
      if (row) this.store.deleteSession(row.id);
      return null;
    }
    const user = this.store.findUserById(row.userId);
    if (!user || user.disabledAt !== null) return null;
    if (now - row.lastSeenAt > 60_000) this.store.touchSession(row.id, now);
    return { user: publicUser(user), session: row };
  }

  logout(token: string | undefined): void {
    if (!token || tokenKind(token) !== "session") return;
    const row = this.store.findSessionByHash(hashToken(token));
    if (row) this.store.deleteSession(row.id);
  }

  /** Resolve a paired phone token. Revoked devices stop working immediately. */
  device(token: string | undefined): { user: PublicUser; device: DeviceRecord } | null {
    if (!token || tokenKind(token) !== "device") return null;
    const device = this.store.findDeviceByHash(hashToken(token));
    if (!device || device.revokedAt !== null) return null;
    const user = this.store.findUserById(device.userId);
    if (!user || user.disabledAt !== null) return null;
    const now = this.clock();
    if (now - device.lastSeenAt > 60_000) this.store.touchDevice(device.id, now);
    return { user: publicUser(user), device };
  }

  openPairing(userId: string): PairingWindow {
    const code = newPairingCode();
    const token = newPairingToken();
    const now = this.clock();
    const expiresAt = now + this.config.pairingTtlMs;
    this.store.createPairing({
      id: randomUUID(),
      userId,
      codeHash: hashToken(code),
      tokenHash: hashToken(token),
      expiresAt,
      attemptsLeft: this.config.maxPairingAttempts,
    });
    return { code, token, expiresAt };
  }

  redeemPairing(
    credential: string,
    deviceName: unknown,
    ip?: string,
  ): IssuedDevice {
    const presented = credential.trim();
    if (!presented) throw new AuthError(400, "A pairing code is required.");
    if (!this.pairLimiter.allow(ip ?? "unknown", this.clock())) {
      throw new AuthError(429, "Too many pairing attempts. Start pairing again.");
    }
    const isCode = /^\d{6}$/.test(presented);
    if (!isCode && tokenKind(presented) !== "pairing") {
      throw new AuthError(400, "That pairing credential is not valid.");
    }
    if (!isCode && !/^omb_pair_[A-Za-z0-9_-]{43}$/.test(presented)) {
      throw new AuthError(400, "That pairing credential is not valid.");
    }
    const hashed = hashToken(presented);
    const pairing = isCode
      ? this.store.findPairingByCodeHash(hashed)
      : this.store.findPairingByTokenHash(hashed);
    const now = this.clock();
    if (!pairing || pairing.usedAt !== null || pairing.expiresAt <= now) {
      throw new AuthError(403, "That pairing code is invalid or has expired.");
    }
    if (pairing.attemptsLeft <= 0) {
      throw new AuthError(403, "Too many incorrect codes. Start pairing again.");
    }
    if (!this.store.consumePairing(pairing.id, now)) {
      throw new AuthError(409, "That pairing code was already used.");
    }
    const token = newDeviceToken();
    const device = this.store.createDevice({
      id: randomUUID(),
      userId: pairing.userId,
      name: cleanDeviceName(deviceName),
      tokenHash: hashToken(token),
      now,
    });
    return { device, token };
  }

  listDevices(userId: string): Array<Omit<DeviceRecord, "tokenHash">> {
    return this.store.listDevices(userId).map(({ tokenHash: _tokenHash, ...rest }) => rest);
  }

  revokeDevice(userId: string, deviceId: string): boolean {
    return this.store.revokeDevice(userId, deviceId);
  }

  userById(id: string): UserRecord | null {
    return this.store.findUserById(id);
  }

  userByEmail(email: string): UserRecord | null {
    return this.store.findUserByEmail(email);
  }
}
