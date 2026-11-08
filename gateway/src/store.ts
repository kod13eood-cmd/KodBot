// Gateway control-plane persistence. Tenant transcripts and bot files do not
// live here; this database only holds accounts, sessions, invites, devices,
// and short-lived pairing windows.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type UserRole = "owner" | "member";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  dataDir: string;
  createdAt: number;
  disabledAt: number | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  userAgent: string | null;
  ip: string | null;
}

export interface InviteRecord {
  id: string;
  codeHash: string;
  email: string | null;
  createdBy: string | null;
  createdAt: number;
  expiresAt: number;
  usedBy: string | null;
  usedAt: number | null;
}

export interface DeviceRecord {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  createdAt: number;
  lastSeenAt: number;
  revokedAt: number | null;
}

export interface PairingRecord {
  id: string;
  userId: string;
  codeHash: string;
  tokenHash: string;
  expiresAt: number;
  attemptsLeft: number;
  usedAt: number | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','member')),
  data_dir TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  disabled_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS users_one_owner ON users(role) WHERE role = 'owner';
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  created_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_by TEXT REFERENCES users(id),
  used_at INTEGER
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS devices_user ON devices(user_id);
CREATE TABLE IF NOT EXISTS pairings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts_left INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS pairings_code ON pairings(code_hash);
CREATE INDEX IF NOT EXISTS pairings_token ON pairings(token_hash);
`;

export class GatewayStore {
  readonly db: DatabaseSync;

  constructor(readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(dataDir, "gateway.db"));
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec(SCHEMA);
    this.pruneExpired(Date.now());
  }

  close() {
    this.db.close();
  }

  private user(row: any): UserRecord {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      dataDir: row.data_dir,
      createdAt: row.created_at,
      disabledAt: row.disabled_at ?? null,
    };
  }

  countUsers(): number {
    const row = this.db.prepare("SELECT count(*) AS n FROM users").get() as { n: number };
    return row.n;
  }

  createUser(input: {
    id: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    dataDir: string;
    now?: number;
  }): UserRecord {
    const now = input.now ?? Date.now();
    this.db.prepare(
      "INSERT INTO users (id, email, password_hash, role, data_dir, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(input.id, input.email.toLowerCase(), input.passwordHash, input.role, input.dataDir, now);
    const user = this.findUserById(input.id);
    if (!user) throw new Error("user disappeared after insert");
    return user;
  }

  /** Create the account and burn its invite as one transaction. A used or
   * expired invite rolls the account back instead of leaving a half-user. */
  createUserWithInvite(input: {
    id: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    dataDir: string;
    now: number;
    inviteId: string;
  }): UserRecord {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const user = this.createUser({ ...input, now: input.now });
      const result = this.db.prepare(
        "UPDATE invites SET used_by = ?, used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?",
      ).run(user.id, input.now, input.inviteId, input.now);
      if (Number(result.changes) === 0) throw new Error("invite is no longer available");
      this.db.exec("COMMIT");
      return user;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  findUserById(id: string): UserRecord | null {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return row ? this.user(row) : null;
  }

  findUserByEmail(email: string): UserRecord | null {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email.toLowerCase());
    return row ? this.user(row) : null;
  }

  listUsers(): UserRecord[] {
    return (this.db.prepare("SELECT * FROM users ORDER BY created_at").all() as any[]).map((row) => this.user(row));
  }

  setPassword(userId: string, passwordHash: string): boolean {
    const result = this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
    return Number(result.changes) > 0;
  }

  setUserDisabled(userId: string, disabled: boolean, now = Date.now()): boolean {
    const result = this.db.prepare("UPDATE users SET disabled_at = ? WHERE id = ?").run(disabled ? now : null, userId);
    return Number(result.changes) > 0;
  }

  createSession(input: {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: number;
    lastSeenAt: number;
    expiresAt: number;
    userAgent?: string | null;
    ip?: string | null;
  }): SessionRecord {
    this.db.prepare(
      "INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      input.id,
      input.userId,
      input.tokenHash,
      input.createdAt,
      input.lastSeenAt,
      input.expiresAt,
      input.userAgent ?? null,
      input.ip ?? null,
    );
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(input.id) as any;
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
      userAgent: row.user_agent ?? null,
      ip: row.ip ?? null,
    };
  }

  findSessionByHash(tokenHash: string): SessionRecord | null {
    const row = this.db.prepare("SELECT * FROM sessions WHERE token_hash = ?").get(tokenHash) as any;
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
      userAgent: row.user_agent ?? null,
      ip: row.ip ?? null,
    };
  }

  touchSession(id: string, now = Date.now()): void {
    this.db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(now, id);
  }

  deleteSession(id: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }

  deleteUserSessions(userId: string): void {
    this.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }

  createInvite(input: {
    id: string;
    codeHash: string;
    email?: string | null;
    createdBy?: string | null;
    createdAt: number;
    expiresAt: number;
  }): InviteRecord {
    this.db.prepare(
      "INSERT INTO invites (id, code_hash, email, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      input.id,
      input.codeHash,
      input.email?.toLowerCase() ?? null,
      input.createdBy ?? null,
      input.createdAt,
      input.expiresAt,
    );
    const row = this.db.prepare("SELECT * FROM invites WHERE id = ?").get(input.id) as any;
    return {
      id: row.id,
      codeHash: row.code_hash,
      email: row.email ?? null,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      usedBy: row.used_by ?? null,
      usedAt: row.used_at ?? null,
    };
  }

  findInviteByHash(codeHash: string): InviteRecord | null {
    const row = this.db.prepare("SELECT * FROM invites WHERE code_hash = ?").get(codeHash) as any;
    if (!row) return null;
    return {
      id: row.id,
      codeHash: row.code_hash,
      email: row.email ?? null,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      usedBy: row.used_by ?? null,
      usedAt: row.used_at ?? null,
    };
  }

  /** Atomic single-use redemption. False means another request won the race. */
  consumeInvite(inviteId: string, userId: string, now = Date.now()): boolean {
    const result = this.db.prepare(
      "UPDATE invites SET used_by = ?, used_at = ? WHERE id = ? AND used_at IS NULL",
    ).run(userId, now, inviteId);
    return Number(result.changes) > 0;
  }

  createDevice(input: {
    id: string;
    userId: string;
    name: string;
    tokenHash: string;
    now?: number;
  }): DeviceRecord {
    const now = input.now ?? Date.now();
    this.db.prepare(
      "INSERT INTO devices (id, user_id, name, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(input.id, input.userId, input.name, input.tokenHash, now, now);
    const device = this.findDeviceByHash(input.tokenHash);
    if (!device) throw new Error("device disappeared after insert");
    return device;
  }

  findDeviceByHash(tokenHash: string): DeviceRecord | null {
    const row = this.db.prepare("SELECT * FROM devices WHERE token_hash = ?").get(tokenHash) as any;
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      tokenHash: row.token_hash,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      revokedAt: row.revoked_at ?? null,
    };
  }

  touchDevice(id: string, now = Date.now()): void {
    this.db.prepare("UPDATE devices SET last_seen_at = ? WHERE id = ?").run(now, id);
  }

  listDevices(userId: string): DeviceRecord[] {
    return (this.db.prepare("SELECT * FROM devices WHERE user_id = ? ORDER BY created_at").all(userId) as any[])
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        tokenHash: row.token_hash,
        createdAt: row.created_at,
        lastSeenAt: row.last_seen_at,
        revokedAt: row.revoked_at ?? null,
      }));
  }

  revokeDevice(userId: string, deviceId: string, now = Date.now()): boolean {
    const result = this.db.prepare(
      "UPDATE devices SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
    ).run(now, deviceId, userId);
    return Number(result.changes) > 0;
  }

  createPairing(input: {
    id: string;
    userId: string;
    codeHash: string;
    tokenHash: string;
    expiresAt: number;
    attemptsLeft: number;
  }): PairingRecord {
    this.db.prepare(
      "INSERT INTO pairings (id, user_id, code_hash, token_hash, expires_at, attempts_left) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(input.id, input.userId, input.codeHash, input.tokenHash, input.expiresAt, input.attemptsLeft);
    const row = this.db.prepare("SELECT * FROM pairings WHERE id = ?").get(input.id) as any;
    return this.pairing(row);
  }

  private pairing(row: any): PairingRecord {
    return {
      id: row.id,
      userId: row.user_id,
      codeHash: row.code_hash,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      attemptsLeft: row.attempts_left,
      usedAt: row.used_at ?? null,
    };
  }

  findPairingByCodeHash(codeHash: string): PairingRecord | null {
    const row = this.db.prepare(
      "SELECT * FROM pairings WHERE code_hash = ? AND used_at IS NULL ORDER BY expires_at DESC LIMIT 1",
    ).get(codeHash) as any;
    return row ? this.pairing(row) : null;
  }

  findPairingByTokenHash(tokenHash: string): PairingRecord | null {
    const row = this.db.prepare(
      "SELECT * FROM pairings WHERE token_hash = ? AND used_at IS NULL ORDER BY expires_at DESC LIMIT 1",
    ).get(tokenHash) as any;
    return row ? this.pairing(row) : null;
  }

  /** Decrement a wrong guess. Returns the remaining attempts (0 = burned). */
  spendPairingAttempt(pairingId: string): number {
    const row = this.db.prepare(
      "UPDATE pairings SET attempts_left = attempts_left - 1 WHERE id = ? AND attempts_left > 0 RETURNING attempts_left",
    ).get(pairingId) as { attempts_left: number } | undefined;
    return row?.attempts_left ?? 0;
  }

  consumePairing(pairingId: string, now = Date.now()): boolean {
    const result = this.db.prepare(
      "UPDATE pairings SET used_at = ? WHERE id = ? AND used_at IS NULL",
    ).run(now, pairingId);
    return Number(result.changes) > 0;
  }

  pruneExpired(now = Date.now(), pairingTtlMs = 120_000): void {
    this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
    this.db.prepare("DELETE FROM invites WHERE expires_at <= ? AND used_at IS NULL").run(now);
    this.db.prepare("DELETE FROM pairings WHERE expires_at <= ? OR used_at IS NOT NULL").run(now + pairingTtlMs);
  }
}
