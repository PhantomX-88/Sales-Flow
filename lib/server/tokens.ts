import { createHash, randomBytes } from "crypto";

/**
 * 32-byte URL-safe random token. The raw value is only ever emitted in the
 * invitation link (email + API response to the inviting owner) — it is never
 * persisted. Only its SHA-256 hash is stored (invitations.token_hash).
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex digest of a raw invitation token — the stored form. */
export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
