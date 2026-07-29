import 'server-only';
import { and, eq, inArray, asc } from 'drizzle-orm';
import { withPrivilegedDbAccess, userSessions, newId } from '@maralito/db';
import type { SessionRevokeReason } from '@maralito/db';
import { writeAudit } from './audit';
import { getServerEnv } from './env';
import {
  SESSION_AUDIT_ACTIONS,
  computeSessionWindows,
  decideDeviceAdmission,
  deriveDeviceLabelHash,
  evaluateSession,
  hashIpAddress,
  hashSessionToken,
  isSessionEnforcementEnabledValue,
  resolveSessionPolicy,
  sessionIdsToRevokeOnPasswordReset,
  type ActiveSessionRef,
  type SessionPolicy,
  type SessionSnapshot,
} from './session-policy';

/**
 * Production-readiness — the SINGLE server-only seam for the session registry.
 *
 * Every read and write of `user_sessions` goes through `withPrivilegedDbAccess`: the table has NO
 * tenant write policy and NO insert/update/delete grant (see packages/db/src/rls/sessions-policies.sql),
 * so a client physically cannot forge, extend, or un-revoke a session. Decisions live in the pure
 * `session-policy` module; this file only does I/O and auditing.
 *
 * SECRETS: raw tokens enter these functions and are immediately hashed. A raw token is never stored,
 * never returned, and never written to an audit record or a log line.
 *
 * FAIL CLOSED: `verifySession` returns `{ ok: false }` on ANY failure — missing DATABASE_URL, DB error,
 * unknown token, revoked, expired. There is no code path where an unverifiable session is admitted.
 */

/**
 * Is session enforcement switched on for this deployment?
 *
 * DEFAULTS TO FALSE. Read from `process.env` on every call (not captured at module load) so an
 * operator can flip it via the platform's env config and roll back instantly without a code change.
 * The literal `process.env.BORDERPASS_SESSION_ENFORCEMENT` form is required for build-time inlining.
 *
 * Nothing in this module consults the flag itself — the registry functions do exactly what they are
 * asked. Gating lives at the CALL SITES (see `session-guard.ts`), so an operational or admin tool can
 * still revoke sessions deliberately while the request-path enforcement is dark.
 */
export function isSessionEnforcementEnabled(): boolean {
  return isSessionEnforcementEnabledValue(process.env.BORDERPASS_SESSION_ENFORCEMENT);
}

/** Effective policy, resolved from process.env each call so config changes need no redeploy of logic. */
function currentPolicy(): SessionPolicy {
  return resolveSessionPolicy({
    SESSION_ABSOLUTE_LIFETIME_SECONDS: process.env.SESSION_ABSOLUTE_LIFETIME_SECONDS,
    SESSION_IDLE_TIMEOUT_SECONDS: process.env.SESSION_IDLE_TIMEOUT_SECONDS,
    SESSION_MAX_ACTIVE_DEVICES: process.env.SESSION_MAX_ACTIVE_DEVICES,
  });
}

function dbConfigured(): boolean {
  try {
    return Boolean(getServerEnv().DATABASE_URL);
  } catch {
    return false; // env not parseable → treat as unavailable, deny
  }
}

/* ------------------------------------------------------------------ *
 * Registration (login)
 * ------------------------------------------------------------------ */

export interface RegisterSessionInput {
  readonly authUserId: string;
  readonly orgId: string;
  /** Raw session/refresh token. Hashed immediately; never stored or logged. */
  readonly sessionToken: string;
  readonly userAgent?: string | undefined;
  readonly platform?: string | undefined;
  readonly ipAddress?: string | undefined;
  readonly now?: Date | undefined;
}

export interface RegisterSessionResult {
  readonly ok: boolean;
  readonly sessionId: string | null;
  readonly revokedSessionIds: readonly string[];
  readonly absoluteExpiresAt: Date | null;
}

const FAILED_REGISTRATION: RegisterSessionResult = {
  ok: false,
  sessionId: null,
  revokedSessionIds: [],
  absoluteExpiresAt: null,
};

/**
 * Record a new device session at login, enforcing the concurrent-device cap with REVOKE-OLDEST.
 * Audits: `auth.session_created`, plus `auth.session_revoked_device_limit` /
 * `auth.session_device_limit_reached` / `auth.session_suspicious_new_device` when the cap bites.
 */
export async function registerSession(
  input: RegisterSessionInput,
): Promise<RegisterSessionResult> {
  if (!dbConfigured() || !input.sessionToken) return FAILED_REGISTRATION;
  const policy = currentPolicy();
  const now = input.now ?? new Date();

  try {
    const [tokenHash, deviceLabelHash, ipHash] = await Promise.all([
      hashSessionToken(input.sessionToken),
      deriveDeviceLabelHash(input.userAgent, input.platform),
      input.ipAddress ? hashIpAddress(input.ipAddress) : Promise.resolve(null),
    ]);
    const windows = computeSessionWindows(now, policy);
    const sessionId = newId('ses');

    const decision = await withPrivilegedDbAccess('session.register', async (db) => {
      const activeRows = await db
        .select({
          id: userSessions.id,
          issuedAt: userSessions.issuedAt,
          deviceLabelHash: userSessions.deviceLabelHash,
        })
        .from(userSessions)
        .where(
          and(eq(userSessions.authUserId, input.authUserId), eq(userSessions.status, 'active')),
        )
        .orderBy(asc(userSessions.issuedAt));

      const active: ActiveSessionRef[] = activeRows.map((r) => ({
        id: r.id,
        issuedAt: r.issuedAt,
        deviceLabelHash: r.deviceLabelHash,
      }));
      const d = decideDeviceAdmission(active, deviceLabelHash, policy);

      // Revoke the oldest BEFORE inserting, so the cap is never transiently exceeded.
      if (d.revokeSessionIds.length > 0) {
        await db
          .update(userSessions)
          .set({
            status: 'revoked',
            revokedAt: now,
            revokedReason: 'device_limit',
            updatedAt: now,
          })
          .where(inArray(userSessions.id, [...d.revokeSessionIds]));
      }

      await db.insert(userSessions).values({
        id: sessionId,
        orgId: input.orgId,
        authUserId: input.authUserId,
        sessionTokenHash: tokenHash,
        deviceLabelHash,
        ipHash,
        status: 'active',
        issuedAt: now,
        lastSeenAt: now,
        absoluteExpiresAt: windows.absoluteExpiresAt,
        idleExpiresAt: windows.idleExpiresAt,
      });
      return d;
    });

    for (const revokedId of decision.revokeSessionIds) {
      await writeAudit({
        action: SESSION_AUDIT_ACTIONS.deviceLimitRevoked,
        orgId: input.orgId,
        actorUserId: input.authUserId,
        entityType: 'user_session',
        entityId: revokedId,
        after: { status: 'revoked', reason: 'device_limit' },
        metadata: { max_active_sessions: policy.maxActiveSessions },
      });
    }
    if (decision.atLimit) {
      await writeAudit({
        action: SESSION_AUDIT_ACTIONS.deviceLimitReached,
        orgId: input.orgId,
        actorUserId: input.authUserId,
        entityType: 'user_session',
        entityId: sessionId,
        metadata: {
          max_active_sessions: policy.maxActiveSessions,
          revoked_count: decision.revokeSessionIds.length,
        },
      });
    }
    if (decision.suspicious) {
      await writeAudit({
        action: SESSION_AUDIT_ACTIONS.suspiciousNewDevice,
        orgId: input.orgId,
        actorUserId: input.authUserId,
        entityType: 'user_session',
        entityId: sessionId,
        // Coarse device hash only — never the raw user-agent or IP.
        metadata: { device_label_hash: deviceLabelHash, new_device: true },
      });
    }
    await writeAudit({
      action: SESSION_AUDIT_ACTIONS.created,
      orgId: input.orgId,
      actorUserId: input.authUserId,
      entityType: 'user_session',
      entityId: sessionId,
      metadata: {
        device_label_hash: deviceLabelHash,
        absolute_lifetime_seconds: policy.absoluteLifetimeSeconds,
        idle_timeout_seconds: policy.idleTimeoutSeconds,
      },
    });

    return {
      ok: true,
      sessionId,
      revokedSessionIds: decision.revokeSessionIds,
      absoluteExpiresAt: windows.absoluteExpiresAt,
    };
  } catch {
    // Never leak token material through an error path.
    return FAILED_REGISTRATION;
  }
}

/* ------------------------------------------------------------------ *
 * Verification (every protected request)
 * ------------------------------------------------------------------ */

export type SessionDenialReason =
  | 'no_token'
  | 'unknown'
  | 'revoked'
  | 'expired_absolute'
  | 'expired_idle'
  | 'unavailable';

export type SessionVerification =
  | { ok: true; sessionId: string; authUserId: string; orgId: string; idleExpiresAt: Date }
  | { ok: false; reason: SessionDenialReason };

/** Only persist a slid idle window when it actually moved — avoids a write on every request. */
const IDLE_WRITE_THRESHOLD_MS = 60_000;

/**
 * Authoritative session check. Marks a newly-expired session `expired` (audited) and slides the idle
 * window on success. Any unexpected failure denies with `unavailable`.
 */
export async function verifySession(input: {
  sessionToken: string | null | undefined;
  now?: Date | undefined;
}): Promise<SessionVerification> {
  if (!input.sessionToken) return { ok: false, reason: 'no_token' };
  if (!dbConfigured()) return { ok: false, reason: 'unavailable' };
  const policy = currentPolicy();
  const now = input.now ?? new Date();

  try {
    const tokenHash = await hashSessionToken(input.sessionToken);
    const row = await withPrivilegedDbAccess('session.verify', async (db) => {
      const rows = await db
        .select()
        .from(userSessions)
        .where(eq(userSessions.sessionTokenHash, tokenHash))
        .limit(1);
      return rows[0] ?? null;
    });

    const snapshot: SessionSnapshot | null = row
      ? {
          id: row.id,
          status: row.status,
          issuedAt: row.issuedAt,
          absoluteExpiresAt: row.absoluteExpiresAt,
          idleExpiresAt: row.idleExpiresAt,
        }
      : null;
    const decision = evaluateSession(snapshot, now, policy);

    if (decision.kind === 'unknown') return { ok: false, reason: 'unknown' };
    if (decision.kind === 'revoked') return { ok: false, reason: 'revoked' };

    if (decision.kind === 'expired') {
      if (row && row.status === 'active') {
        await withPrivilegedDbAccess('session.expire', async (db) => {
          await db
            .update(userSessions)
            .set({
              status: 'expired',
              revokedAt: now,
              revokedReason: decision.reason === 'absolute' ? 'expired_absolute' : 'expired_idle',
              updatedAt: now,
            })
            .where(eq(userSessions.id, decision.sessionId));
        });
        await writeAudit({
          action:
            decision.reason === 'absolute'
              ? SESSION_AUDIT_ACTIONS.expiredAbsolute
              : SESSION_AUDIT_ACTIONS.expiredIdle,
          orgId: row.orgId,
          actorUserId: row.authUserId,
          entityType: 'user_session',
          entityId: decision.sessionId,
          after: { status: 'expired', reason: decision.reason },
        });
      }
      return {
        ok: false,
        reason: decision.reason === 'absolute' ? 'expired_absolute' : 'expired_idle',
      };
    }

    // Valid → slide the idle window (capped at the absolute deadline) and touch last_seen_at.
    if (!row) return { ok: false, reason: 'unknown' }; // unreachable; keeps the type honest
    if (
      decision.nextIdleExpiresAt.getTime() - row.idleExpiresAt.getTime() >=
      IDLE_WRITE_THRESHOLD_MS
    ) {
      await withPrivilegedDbAccess('session.touch', async (db) => {
        await db
          .update(userSessions)
          .set({ lastSeenAt: now, idleExpiresAt: decision.nextIdleExpiresAt, updatedAt: now })
          .where(eq(userSessions.id, decision.sessionId));
      });
    }
    return {
      ok: true,
      sessionId: decision.sessionId,
      authUserId: row.authUserId,
      orgId: row.orgId,
      idleExpiresAt: decision.nextIdleExpiresAt,
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/* ------------------------------------------------------------------ *
 * Middleware seam (the function the coordinator wires)
 * ------------------------------------------------------------------ */

/** Structural request context — deliberately NOT typed against `next/server` so this stays testable. */
export interface SessionRequestContext {
  /** Raw Supabase auth cookie / access token value from the request. */
  readonly sessionToken: string | null | undefined;
  readonly now?: Date | undefined;
}

/**
 * THE function the coordinator wires into `apps/borderpass/middleware.ts`.
 *
 * Returns the authoritative verdict for a request. Callers MUST treat `{ ok: false }` as "deny":
 * clear the auth cookies and redirect to /login (adding `?reason=<reason>` if a message is wanted).
 * Audits the denial for the reasons that indicate an actual control firing.
 *
 * RUNTIME NOTE: this touches Postgres, so it requires the Node.js runtime. If middleware stays on the
 * Edge runtime, call this from a Node route/layout guard instead and use the pure, DB-free
 * `isWithinAbsoluteLifetime()` from `session-policy` as the Edge pre-filter.
 */
export async function enforceSessionForRequest(
  ctx: SessionRequestContext,
): Promise<SessionVerification> {
  const result = await verifySession({ sessionToken: ctx.sessionToken, now: ctx.now });
  if (!result.ok && (result.reason === 'unknown' || result.reason === 'revoked')) {
    await writeAudit({
      action: SESSION_AUDIT_ACTIONS.denied,
      entityType: 'user_session',
      metadata: { reason: result.reason },
    });
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * Revocation
 * ------------------------------------------------------------------ */

async function revokeByIds(
  ids: readonly string[],
  reason: SessionRevokeReason,
  now: Date,
): Promise<void> {
  if (ids.length === 0) return;
  await withPrivilegedDbAccess(`session.revoke:${reason}`, async (db) => {
    await db
      .update(userSessions)
      .set({ status: 'revoked', revokedAt: now, revokedReason: reason, updatedAt: now })
      .where(inArray(userSessions.id, [...ids]));
  });
}

/** Sign-out: revoke exactly the session presenting this token. Audited. Never throws. */
export async function revokeCurrentSession(input: {
  sessionToken: string | null | undefined;
  now?: Date | undefined;
}): Promise<boolean> {
  if (!input.sessionToken || !dbConfigured()) return false;
  const now = input.now ?? new Date();
  try {
    const tokenHash = await hashSessionToken(input.sessionToken);
    const row = await withPrivilegedDbAccess('session.signout.read', async (db) => {
      const rows = await db
        .select({
          id: userSessions.id,
          orgId: userSessions.orgId,
          authUserId: userSessions.authUserId,
          status: userSessions.status,
        })
        .from(userSessions)
        .where(eq(userSessions.sessionTokenHash, tokenHash))
        .limit(1);
      return rows[0] ?? null;
    });
    if (!row || row.status !== 'active') return false;
    await revokeByIds([row.id], 'signed_out', now);
    await writeAudit({
      action: SESSION_AUDIT_ACTIONS.signedOut,
      orgId: row.orgId,
      actorUserId: row.authUserId,
      entityType: 'user_session',
      entityId: row.id,
      after: { status: 'revoked', reason: 'signed_out' },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Revoke every active session for an account. Returns the number revoked (0 on any failure).
 * Deliberately does NOT audit — the CALLER owns the audit action, because the meaning of a bulk
 * revocation differs by trigger (password reset vs admin action vs suspicious-activity response).
 */
export async function revokeAllSessionsForUser(input: {
  authUserId: string;
  reason: SessionRevokeReason;
  now?: Date | undefined;
}): Promise<number> {
  if (!dbConfigured()) return 0;
  const now = input.now ?? new Date();
  try {
    const active = await withPrivilegedDbAccess('session.revoke_all.read', async (db) => {
      return db
        .select({
          id: userSessions.id,
          issuedAt: userSessions.issuedAt,
          deviceLabelHash: userSessions.deviceLabelHash,
        })
        .from(userSessions)
        .where(and(eq(userSessions.authUserId, input.authUserId), eq(userSessions.status, 'active')))
        .orderBy(asc(userSessions.issuedAt));
    });
    const ids = sessionIdsToRevokeOnPasswordReset(
      active.map<ActiveSessionRef>((r) => ({
        id: r.id,
        issuedAt: r.issuedAt,
        deviceLabelHash: r.deviceLabelHash,
      })),
    );
    await revokeByIds(ids, input.reason, now);
    return ids.length;
  } catch {
    return 0;
  }
}

/**
 * Password reset: revoke ALL sessions (including the one that initiated the reset) so a fresh login
 * with the new credential is mandatory. Emits the required `auth.password_reset_sessions_revoked`
 * audit action EVEN WHEN zero sessions were active, so the control is always provably exercised.
 */
export async function revokeAllSessionsOnPasswordReset(input: {
  authUserId: string;
  orgId?: string | undefined;
  now?: Date | undefined;
}): Promise<number> {
  const revoked = await revokeAllSessionsForUser({
    authUserId: input.authUserId,
    reason: 'password_reset',
    ...(input.now ? { now: input.now } : {}),
  });
  await writeAudit({
    action: SESSION_AUDIT_ACTIONS.passwordResetRevokedAll,
    ...(input.orgId ? { orgId: input.orgId } : {}),
    actorUserId: input.authUserId,
    entityType: 'user_session',
    metadata: { revoked_count: revoked, requires_fresh_login: true },
  });
  return revoked;
}
