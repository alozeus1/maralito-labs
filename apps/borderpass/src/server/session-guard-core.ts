/**
 * Production-readiness — the DARK-LAUNCH orchestration layer for the session registry.
 *
 * Pure by construction: every dependency (flag read, token resolution, DB-backed verification,
 * registration, revocation, auditing) arrives as an argument, and the only static imports are TYPE
 * imports, which are erased at compile time. That makes the single most important property of this
 * rollout directly assertable in a unit test: **with the flag OFF, nothing is called.**
 *
 * ── WHY A FLAG AT ALL ────────────────────────────────────────────────────────────────────────────
 * The `user_sessions` table has NO Drizzle migration yet (see docs/production-readiness/
 * session-policy.md §7.1) and `enforceSessionForRequest` fails closed. If enforcement were on by
 * default, the moment this deployed against a database without that table EVERY request from EVERY
 * user would be denied — a total lockout. So enforcement ships dark: `BORDERPASS_SESSION_ENFORCEMENT`
 * must be exactly `'on'` before a single new denial, or a single new request-path DB read, can occur.
 *
 * ── TWO DIFFERENT FAILURE STANCES, DELIBERATELY ──────────────────────────────────────────────────
 *   - ENFORCEMENT (`decideSessionGuard`) fails CLOSED. Anything it cannot verify is a denial; that
 *     is the whole point of the control.
 *   - RECORDING (`recordLoginSessionCore`, `revokeCurrentSessionCore`) is BEST-EFFORT and can never
 *     throw into the caller. A user must never be unable to sign in — or unable to sign out —
 *     because session bookkeeping failed. Bookkeeping is not an authentication control; the
 *     authentication control is the enforcement path, which is separately fail-closed.
 *
 * No raw token, JWT, cookie, user-agent, IP or email ever appears in a return value or a failure
 * notification here — failures are reported as a coarse STAGE name only.
 */

import type {
  RegisterSessionInput,
  RegisterSessionResult,
  SessionDenialReason,
  SessionVerification,
} from './session-registry';

/** Which guarded shell asked. Audit context only — it never changes the verdict. */
export type SessionSurface = 'customer' | 'admin';

/** Coarse, non-PII device context. All three are hashed before storage by `registerSession`. */
export interface DeviceHints {
  readonly userAgent: string | null;
  readonly platform: string | null;
  readonly ipAddress: string | null;
}

export const NO_DEVICE_HINTS: DeviceHints = { userAgent: null, platform: null, ipAddress: null };

/** Never let a diagnostic callback change control flow — logging must not break auth. */
function notify<S>(onFailure: (stage: S) => void, stage: S): void {
  try {
    onFailure(stage);
  } catch {
    /* a failing logger is not a reason to fail the user's request */
  }
}

/* ------------------------------------------------------------------ *
 * Enforcement (fail-closed, flag-gated)
 * ------------------------------------------------------------------ */

export interface SessionGuardDeps {
  /** Reads the feature flag. Called FIRST and, when it returns false, nothing else is called. */
  readonly isEnabled: () => boolean;
  /** Resolves the stable per-session identity string for this request (never a raw JWT). */
  readonly resolveSessionToken: () => Promise<string | null>;
  /** The authoritative, DB-backed check (`enforceSessionForRequest`). */
  readonly enforce: (ctx: { sessionToken: string | null }) => Promise<SessionVerification>;
  readonly auditDenial: (input: {
    readonly reason: SessionDenialReason;
    readonly surface: SessionSurface;
    readonly authUserId?: string | undefined;
    readonly orgId?: string | undefined;
  }) => Promise<void>;
}

export interface SessionGuardInput {
  readonly surface: SessionSurface;
  readonly authUserId?: string | undefined;
  readonly orgId?: string | undefined;
}

/**
 * Decide whether this request may proceed.
 *
 * Returns `null` to ALLOW and a `SessionDenialReason` to DENY (the caller redirects to `/login`).
 *
 * Flag OFF ⇒ returns `null` immediately without calling `resolveSessionToken`, `enforce` or
 * `auditDenial`. That is what makes the dark deploy byte-for-byte identical to today's behaviour:
 * no new denials and no new database reads on the request path.
 *
 * Flag ON ⇒ full fail-closed enforcement, including an unexpected throw anywhere in the chain,
 * which is reported as `unavailable` (a denial) rather than being swallowed into an allow.
 */
export async function decideSessionGuard(
  input: SessionGuardInput,
  deps: SessionGuardDeps,
): Promise<SessionDenialReason | null> {
  if (!deps.isEnabled()) return null;

  let result: SessionVerification;
  try {
    const sessionToken = await deps.resolveSessionToken();
    result = await deps.enforce({ sessionToken });
  } catch {
    return 'unavailable'; // fail closed — an unverifiable session is never admitted
  }
  if (result.ok) return null;

  // `unknown` / `revoked` are already audited inside `enforceSessionForRequest`, and the two expiry
  // reasons are audited inside `verifySession` when the row is marked expired. Auditing them again
  // here would only duplicate rows, so record just the reasons that nothing else records.
  if (result.reason === 'no_token' || result.reason === 'unavailable') {
    try {
      await deps.auditDenial({
        reason: result.reason,
        surface: input.surface,
        ...(input.authUserId ? { authUserId: input.authUserId } : {}),
        ...(input.orgId ? { orgId: input.orgId } : {}),
      });
    } catch {
      /* auditing must never turn a denial into an allow, nor throw into the render */
    }
  }
  return result.reason;
}

/* ------------------------------------------------------------------ *
 * Registration at login (best-effort, flag-gated)
 * ------------------------------------------------------------------ */

/** Coarse reason a login was not recorded. Never carries a token, email, IP or user-agent. */
export type LoginRecordStage = 'token' | 'org' | 'register' | 'error';
export type LoginRecordOutcome = 'disabled' | 'recorded' | 'skipped' | 'failed';

export interface LoginRecordDeps {
  readonly isEnabled: () => boolean;
  readonly resolveSessionToken: () => Promise<string | null>;
  readonly resolveOrgId: (authUserId: string) => Promise<string | null>;
  readonly resolveDeviceHints: () => Promise<DeviceHints>;
  readonly register: (input: RegisterSessionInput) => Promise<RegisterSessionResult>;
  readonly onFailure: (stage: LoginRecordStage) => void;
}

/**
 * Record a freshly-established session. **Never throws and never rejects** — every outcome,
 * including a dependency that throws, resolves to a value. The caller (a login route) must be able
 * to `await` this and continue to the redirect unconditionally.
 */
export async function recordLoginSessionCore(
  authUserId: string,
  deps: LoginRecordDeps,
): Promise<LoginRecordOutcome> {
  if (!deps.isEnabled()) return 'disabled';
  try {
    const sessionToken = await deps.resolveSessionToken();
    if (!sessionToken) {
      notify(deps.onFailure, 'token' as LoginRecordStage);
      return 'skipped';
    }
    const orgId = await deps.resolveOrgId(authUserId);
    if (!orgId) {
      notify(deps.onFailure, 'org' as LoginRecordStage);
      return 'skipped';
    }
    const hints = await deps.resolveDeviceHints();
    const result = await deps.register({
      authUserId,
      orgId,
      sessionToken,
      ...(hints.userAgent ? { userAgent: hints.userAgent } : {}),
      ...(hints.platform ? { platform: hints.platform } : {}),
      ...(hints.ipAddress ? { ipAddress: hints.ipAddress } : {}),
    });
    if (!result.ok) {
      notify(deps.onFailure, 'register' as LoginRecordStage);
      return 'failed';
    }
    return 'recorded';
  } catch {
    notify(deps.onFailure, 'error' as LoginRecordStage);
    return 'failed';
  }
}

/* ------------------------------------------------------------------ *
 * Revocation at sign-out (best-effort, flag-gated)
 * ------------------------------------------------------------------ */

export type SignOutRecordStage = 'token' | 'revoke' | 'error';
export type SignOutRecordOutcome = 'disabled' | 'revoked' | 'skipped' | 'failed';

export interface SignOutRecordDeps {
  readonly isEnabled: () => boolean;
  readonly resolveSessionToken: () => Promise<string | null>;
  readonly revoke: (input: { sessionToken: string }) => Promise<boolean>;
  readonly onFailure: (stage: SignOutRecordStage) => void;
}

/**
 * Revoke the session being signed out of. **Never throws.** The token MUST be resolved by the
 * caller before Supabase clears the auth cookies — afterwards there is nothing left to identify.
 */
export async function revokeCurrentSessionCore(
  deps: SignOutRecordDeps,
): Promise<SignOutRecordOutcome> {
  if (!deps.isEnabled()) return 'disabled';
  try {
    const sessionToken = await deps.resolveSessionToken();
    if (!sessionToken) {
      notify(deps.onFailure, 'token' as SignOutRecordStage);
      return 'skipped';
    }
    const revoked = await deps.revoke({ sessionToken });
    if (!revoked) {
      notify(deps.onFailure, 'revoke' as SignOutRecordStage);
      return 'failed';
    }
    return 'revoked';
  } catch {
    notify(deps.onFailure, 'error' as SignOutRecordStage);
    return 'failed';
  }
}
