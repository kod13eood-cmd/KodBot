// Credentials that leave the gateway exactly once. Only SHA-256 digests are
// stored; a copy of gateway.db is not a copy of every session or phone.
import { createHash, randomBytes, randomInt } from "node:crypto";

export const SESSION_PREFIX = "kbs_";
export const DEVICE_PREFIX = "omb_";
export const PAIRING_PREFIX = "omb_pair_";
export const INVITE_PREFIX = "kb_";

const TOKEN_BYTES = 32;

export function newSessionToken(): string {
  return `${SESSION_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

export function newDeviceToken(): string {
  return `${DEVICE_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

/** Matches the Android pair-QR regex: omb_pair_ + 43 base64url chars. */
export function newPairingToken(): string {
  return `${PAIRING_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

export function newInviteCode(): string {
  return `${INVITE_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function newPairingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenKind(token: string): "session" | "device" | "pairing" | "invite" | "unknown" {
  if (token.startsWith(SESSION_PREFIX)) return "session";
  if (token.startsWith(PAIRING_PREFIX)) return "pairing";
  if (token.startsWith(DEVICE_PREFIX)) return "device";
  if (token.startsWith(INVITE_PREFIX)) return "invite";
  return "unknown";
}
