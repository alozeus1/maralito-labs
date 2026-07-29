import { pgTable, text, uuid, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './identity';

/**
 * Production-readiness — device/session registry (Auth/Session hardening).
 *
 * A `user_sessions` row is the SERVER-SIDE record of one signed-in device session. It exists so the
 * platform can enforce three things Supabase/JWT expiry alone cannot: a fixed ABSOLUTE lifetime, an
 * IDLE timeout, and a hard cap on concurrent device sessions per account (revoke-oldest).
 *
 * TOKEN POLICY (strict): this table MUST NEVER store a raw session token, refresh token, JWT, cookie
 * value, OTP, or any secret. Only `session_token_hash` — a SHA-256 hex digest of the domain-separated
 * token — is stored, and it is never logged.
 *
 * DEVICE POLICY (strict): `device_label_hash` is a SHA-256 digest of a COARSE label (browser family +
 * OS family), not the raw user-agent, not a fingerprint, not an IP. `ip_hash` is likewise a digest, so
 * an operator can correlate "same network" without the table holding an IP address. No PII lives here.
 *
 * Writes are privileged-only (server seam). RLS gives the authenticated role SELECT on OWN rows only —
 * see `src/rls/sessions-policies.sql`.
 */
export const SESSION_STATUSES = ['active', 'revoked', 'expired'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Why a session stopped being usable. Recorded on the row AND mirrored into audit_logs. */
export const SESSION_REVOKE_REASONS = [
  'signed_out', // user-initiated sign-out (revokes the current session)
  'device_limit', // evicted by the revoke-oldest concurrent-device cap
  'password_reset', // password reset revoked ALL sessions; fresh login required
  'expired_absolute', // hit the fixed absolute lifetime
  'expired_idle', // hit the idle timeout
  'admin_revoked', // operator/support action
  'suspicious', // security response to a suspicious-session signal
] as const;
export type SessionRevokeReason = (typeof SESSION_REVOKE_REASONS)[number];

export const userSessions = pgTable(
  'user_sessions',
  {
    id: text('id').primaryKey(), // ses_<id>
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id),
    // Matches user_identities.auth_user_id / user_roles.auth_user_id (Supabase auth user uuid).
    // Intentionally NO foreign key: auth users live in the Supabase `auth` schema, and identity rows
    // are provisioned separately — a session must be recordable even if provisioning lags.
    authUserId: uuid('auth_user_id').notNull(),
    // SHA-256 hex of 'bp.session.v1:' || <raw token>. NEVER the raw token. Unique so a token maps to
    // exactly one session row and a replayed token cannot silently create a second one.
    sessionTokenHash: text('session_token_hash').notNull(),
    // SHA-256 hex of 'bp.device.v1:' || '<browser-family>/<os-family>'. Coarse, non-identifying.
    deviceLabelHash: text('device_label_hash').notNull(),
    // SHA-256 hex of 'bp.ip.v1:' || <ip>. Optional. Correlation only — never a raw IP address.
    ipHash: text('ip_hash'),
    status: text('status').$type<SessionStatus>().notNull().default('active'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    // Fixed lifetime: the session is dead at this instant no matter how active the user is.
    absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(),
    // Sliding window: refreshed on verified activity, never beyond absolute_expires_at.
    idleExpiresAt: timestamp('idle_expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason').$type<SessionRevokeReason>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tokenUq: uniqueIndex('user_sessions_token_hash_uq').on(t.sessionTokenHash),
    orgIdx: index('user_sessions_org_idx').on(t.orgId),
    userIdx: index('user_sessions_user_idx').on(t.authUserId),
    // Drives the device-cap read: "active sessions for this user, oldest first".
    activeIdx: index('user_sessions_active_idx').on(t.authUserId, t.status, t.issuedAt),
    // Drives the expiry sweep.
    expiryIdx: index('user_sessions_expiry_idx').on(t.status, t.absoluteExpiresAt),
  }),
);
