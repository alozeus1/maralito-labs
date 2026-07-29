import 'server-only';
import { headers } from 'next/headers';
import { logEvent } from '@maralito/observability';
import { getAppSession } from './auth';
import { getServerSupabase } from './supabase';
import { writeAudit } from './audit';
import { SESSION_AUDIT_ACTIONS } from './session-policy';
import {
  enforceSessionForRequest,
  isSessionEnforcementEnabled,
  registerSession,
  revokeCurrentSession,
} from './session-registry';
import {
  NO_DEVICE_HINTS,
  decideSessionGuard,
  recordLoginSessionCore,
  revokeCurrentSessionCore,
  type DeviceHints,
  type LoginRecordOutcome,
  type LoginRecordStage,
  type SessionGuardInput,
  type SessionSurface,
  type SignOutRecordOutcome,
  type SignOutRecordStage,
} from './session-guard-core';
import type { SessionDenialReason } from './session-registry';

/**
 * Production-readiness — the wired call sites for the session registry (Node runtime only).
 *
 * This is the seam between the app (login routes, sign-out action, guarded layouts) and the pure
 * decision core in `session-guard-core.ts`. It supplies the real dependencies and nothing else.
 *
 * EVERY entry point here is gated on `isSessionEnforcementEnabled()`, which is FALSE unless
 * `BORDERPASS_SESSION_ENFORCEMENT` is exactly `'on'`. With the flag off these functions return
 * immediately: no Supabase call, no `headers()` read, no database round trip, no audit row. See
 * docs/production-readiness/session-policy.md §11 for the rollout order.
 *
 * NOT wired here: `apps/borderpass/middleware.ts` (Edge runtime, owned by the coordinator). This
 * file is the Node-runtime guard the middleware section of that doc refers to.
 */

/* ------------------------------------------------------------------ *
 * Session identity
 * ------------------------------------------------------------------ */

/**
 * The identity string we register and look sessions up by: the Supabase `session_id` JWT claim.
 *
 * WHY NOT THE ACCESS TOKEN OR THE REFRESH TOKEN — this choice is load-bearing. Supabase rotates the
 * access token roughly hourly and (with rotation enabled, which our own runbook mandates) rotates
 * the refresh token on every refresh. Registering a hash of either would make the row unfindable
 * after the first rotation, so with enforcement ON every user would be denied within the hour: the
 * exact lockout this whole flag exists to prevent. `session_id` identifies the Supabase *session* —
 * it is stable across refreshes and changes only on a genuine new login, which is precisely the unit
 * the device cap counts and the unit sign-out revokes.
 *
 * It is still hashed by `hashSessionToken` before it ever reaches the database, and it is never
 * returned to a client, logged, or written into an audit record.
 *
 * FAIL-CLOSED: a missing or non-string `session_id` yields `null`. For enforcement that becomes a
 * `no_token` denial; for recording it becomes a skipped (best-effort) registration. Because "no
 * claim" would mean "deny everyone", verifying that logins actually produce `user_sessions` rows is
 * a MANDATORY gate before the flag is flipped (rollout step 4).
 */
export async function resolveSessionToken(): Promise<string | null> {
  try {
    const supabase = await getServerSupabase();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return null;
    const claims = decodeJwtClaims(accessToken);
    const sessionId = claims?.['session_id'];
    return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
  } catch {
    return null;
  }
}

/**
 * Read the unverified claims out of a JWT. Signature verification is deliberately NOT done here:
 * this is only ever called on a token Supabase has already validated (`getUser()` / `verifyOtp()` /
 * `exchangeCodeForSession()` on the same request), and the claim is used purely as a lookup key
 * against rows we ourselves wrote. It grants nothing on its own.
 */
function decodeJwtClaims(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  const payload = parts.length === 3 ? parts[1] : undefined;
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    // `atob` is available in Node >= 16 and in the Edge runtime — no Buffer dependency.
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null; // malformed token → no claims → fail closed
  }
}

/**
 * Coarse device context for the audit trail. `registerSession` reduces the user-agent to a
 * `<browser>/<os>` label and hashes it, and hashes the IP — neither raw value is ever stored.
 */
async function resolveDeviceHints(): Promise<DeviceHints> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    const ip = forwarded ? (forwarded.split(',')[0]?.trim() ?? null) : h.get('x-real-ip');
    return {
      userAgent: h.get('user-agent'),
      platform: h.get('sec-ch-ua-platform'),
      ipAddress: ip && ip.length > 0 ? ip : null,
    };
  } catch {
    return NO_DEVICE_HINTS; // device context is nice-to-have, never a reason to fail
  }
}

/**
 * Diagnostics only. Emits a coarse STAGE name and nothing else — never a token, session id, email,
 * IP or user-agent. `logEvent` is sanitised by construction and never throws into the caller.
 */
function warnSessionStage(kind: 'login' | 'signout', stage: string): void {
  logEvent({
    event: `auth.session_${kind}_record_failed`,
    domain: 'auth',
    severity: 'warning',
    data: { stage },
  });
}

/* ------------------------------------------------------------------ *
 * The three wired entry points
 * ------------------------------------------------------------------ */

/**
 * Call after a login has established a session (OTP code, magic-link confirm, PKCE callback).
 *
 * BEST-EFFORT BY CONTRACT: this resolves for every outcome and never rejects, so a login route can
 * `await` it and proceed to the redirect unconditionally. A user must never be blocked from signing
 * in because session bookkeeping failed.
 */
export async function recordLoginSession(authUserId: string): Promise<LoginRecordOutcome> {
  return recordLoginSessionCore(authUserId, {
    isEnabled: isSessionEnforcementEnabled,
    resolveSessionToken,
    resolveOrgId: async (id: string) => {
      const session = await getAppSession();
      return session && session.sub === id ? session.orgId : null;
    },
    resolveDeviceHints,
    register: registerSession,
    onFailure: (stage: LoginRecordStage) => warnSessionStage('login', stage),
  });
}

/**
 * Call on sign-out, BEFORE `supabase.auth.signOut()` clears the auth cookies — afterwards there is
 * no token left to identify the session with. Best-effort; never throws into the sign-out flow.
 */
export async function revokeSessionOnSignOut(): Promise<SignOutRecordOutcome> {
  return revokeCurrentSessionCore({
    isEnabled: isSessionEnforcementEnabled,
    resolveSessionToken,
    revoke: revokeCurrentSession,
    onFailure: (stage: SignOutRecordStage) => warnSessionStage('signout', stage),
  });
}

/**
 * The Node-runtime request guard for the customer and admin shells.
 *
 * Returns `null` to allow and a denial reason to deny. FLAG OFF ⇒ always `null`, with zero extra
 * work. FLAG ON ⇒ authoritative, fail-closed verification against `user_sessions`.
 *
 * The caller must `redirect('/login?reason=session')` on a non-null result. This function does NOT
 * clear the auth cookies: cookie writes are ignored inside a Server Component render, so clearing
 * belongs to the middleware/sign-out path. The redirect is what stops the request either way.
 */
export async function guardSession(input: SessionGuardInput): Promise<SessionDenialReason | null> {
  return decideSessionGuard(input, {
    isEnabled: isSessionEnforcementEnabled,
    resolveSessionToken,
    enforce: (ctx) => enforceSessionForRequest(ctx),
    auditDenial: async (denial) =>
      writeAudit({
        action: SESSION_AUDIT_ACTIONS.denied,
        entityType: 'user_session',
        ...(denial.authUserId ? { actorUserId: denial.authUserId } : {}),
        ...(denial.orgId ? { orgId: denial.orgId } : {}),
        metadata: { reason: denial.reason, surface: denial.surface },
      }),
  });
}

export type { SessionSurface };
