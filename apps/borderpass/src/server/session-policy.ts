/**
 * Production-readiness — PURE session policy decisions (no I/O, no DB, no `next/*`, no node builtins).
 *
 * Everything here is a deterministic function of its arguments, so the security-relevant rules
 * (absolute expiry, idle expiry, concurrent-device cap, revoke-oldest, revoke-all-on-password-reset)
 * are unit-testable without a database and safe to import from BOTH the Node server seam
 * (`session-registry.ts`) and the Edge middleware runtime.
 *
 * Hashing uses Web Crypto (`crypto.subtle`), which exists in Node >= 18 and in the Edge runtime, so
 * this module stays runtime-agnostic. It is the ONLY place tokens are turned into digests, and it
 * never returns, logs, or stores the raw input.
 *
 * FAIL-CLOSED is the invariant: every ambiguous input (missing session, unparseable config, clock
 * skew, negative windows) resolves to "deny" or "use the tighter default", never to "allow".
 */

/* ------------------------------------------------------------------ *
 * Lifetime configuration
 * ------------------------------------------------------------------ */

/**
 * Chosen defaults (see docs/production-readiness/session-policy.md for the rationale):
 *   - 12h ABSOLUTE: one working day. A stolen cookie is worthless the next morning, and it forces a
 *     daily re-auth without logging people out mid-shift.
 *   - 30min IDLE: matches the shared-workstation risk at the Juárez hub / front desk.
 *   - 2 concurrent devices: phone + laptop, the realistic legitimate maximum for this product.
 */
export const DEFAULT_ABSOLUTE_LIFETIME_SECONDS = 12 * 60 * 60; // 12 hours
export const DEFAULT_IDLE_TIMEOUT_SECONDS = 30 * 60; // 30 minutes
export const DEFAULT_MAX_ACTIVE_SESSIONS = 2;

/** Hard bounds. Config outside these is clamped — no deployment can widen the window arbitrarily. */
export const MIN_ABSOLUTE_LIFETIME_SECONDS = 5 * 60; // 5 minutes
export const MAX_ABSOLUTE_LIFETIME_SECONDS = 24 * 60 * 60; // 24 hours — never longer than a day
export const MIN_IDLE_TIMEOUT_SECONDS = 60; // 1 minute
export const MAX_MAX_ACTIVE_SESSIONS = 5;

export interface SessionPolicy {
  readonly absoluteLifetimeSeconds: number;
  readonly idleTimeoutSeconds: number;
  readonly maxActiveSessions: number;
}

export const DEFAULT_SESSION_POLICY: SessionPolicy = {
  absoluteLifetimeSeconds: DEFAULT_ABSOLUTE_LIFETIME_SECONDS,
  idleTimeoutSeconds: DEFAULT_IDLE_TIMEOUT_SECONDS,
  maxActiveSessions: DEFAULT_MAX_ACTIVE_SESSIONS,
};

/** Env var names the operator may set to override the defaults. */
export interface SessionPolicyEnv {
  readonly SESSION_ABSOLUTE_LIFETIME_SECONDS?: string | undefined;
  readonly SESSION_IDLE_TIMEOUT_SECONDS?: string | undefined;
  readonly SESSION_MAX_ACTIVE_DEVICES?: string | undefined;
}

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/** Parse a positive integer. Anything unparseable (empty, NaN, float, <= 0) → `null` (use default). */
function parsePositiveInt(raw: string | undefined): number | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Resolve the effective policy from env. Fail-closed: unparseable values fall back to the DEFAULT
 * (never to "unlimited"), out-of-range values are clamped, and the idle window can never exceed the
 * absolute window (an idle timeout longer than the absolute lifetime would be meaningless).
 */
export function resolveSessionPolicy(env: SessionPolicyEnv = {}): SessionPolicy {
  const absolute = clamp(
    parsePositiveInt(env.SESSION_ABSOLUTE_LIFETIME_SECONDS) ?? DEFAULT_ABSOLUTE_LIFETIME_SECONDS,
    MIN_ABSOLUTE_LIFETIME_SECONDS,
    MAX_ABSOLUTE_LIFETIME_SECONDS,
  );
  const idle = clamp(
    parsePositiveInt(env.SESSION_IDLE_TIMEOUT_SECONDS) ?? DEFAULT_IDLE_TIMEOUT_SECONDS,
    MIN_IDLE_TIMEOUT_SECONDS,
    absolute,
  );
  const maxActive = clamp(
    parsePositiveInt(env.SESSION_MAX_ACTIVE_DEVICES) ?? DEFAULT_MAX_ACTIVE_SESSIONS,
    1,
    MAX_MAX_ACTIVE_SESSIONS,
  );
  return { absoluteLifetimeSeconds: absolute, idleTimeoutSeconds: idle, maxActiveSessions: maxActive };
}

/* ------------------------------------------------------------------ *
 * Enforcement feature flag (dark launch)
 * ------------------------------------------------------------------ */

/**
 * The ONLY switch that turns session enforcement on.
 *
 * Enforcement is DISABLED by default and must be shipped dark, because `user_sessions` has no
 * migration yet and `enforceSessionForRequest` fails closed: enabling it against a database without
 * the table would deny every request from every user. See `session-guard-core.ts` for the full
 * rationale and docs/production-readiness/session-policy.md §11 for the rollout order.
 */
export const SESSION_ENFORCEMENT_FLAG = 'BORDERPASS_SESSION_ENFORCEMENT' as const;

/**
 * Pure flag predicate. Deliberately an EXACT match on `'on'`: no trimming, no case folding, no
 * `'true'`/`'1'` aliases. Every near-miss (`'ON'`, `' on'`, `'true'`, `undefined`) resolves to OFF,
 * which is the safe direction — a typo can only fail to enable the control, never fail to disable it.
 */
export function isSessionEnforcementEnabledValue(raw: string | null | undefined): boolean {
  return raw === 'on';
}

/* ------------------------------------------------------------------ *
 * Audit actions
 * ------------------------------------------------------------------ */

/** Canonical audit actions for the session lifecycle. Values are stable — dashboards key on them. */
export const SESSION_AUDIT_ACTIONS = {
  created: 'auth.session_created',
  signedOut: 'auth.session_revoked_signout',
  deviceLimitRevoked: 'auth.session_revoked_device_limit',
  deviceLimitReached: 'auth.session_device_limit_reached',
  suspiciousNewDevice: 'auth.session_suspicious_new_device',
  expiredAbsolute: 'auth.session_expired_absolute',
  expiredIdle: 'auth.session_expired_idle',
  /** REQUIRED action name: password reset revokes every session and forces a fresh login. */
  passwordResetRevokedAll: 'auth.password_reset_sessions_revoked',
  /** A request presented a token that resolved to no usable session (fail-closed denial). */
  denied: 'auth.session_denied',
} as const;
export type SessionAuditAction = (typeof SESSION_AUDIT_ACTIONS)[keyof typeof SESSION_AUDIT_ACTIONS];

/* ------------------------------------------------------------------ *
 * Expiry decisions
 * ------------------------------------------------------------------ */

export interface SessionWindows {
  readonly absoluteExpiresAt: Date;
  readonly idleExpiresAt: Date;
}

/** Compute the two expiry instants for a session issued at `issuedAt`. */
export function computeSessionWindows(
  issuedAt: Date,
  policy: SessionPolicy = DEFAULT_SESSION_POLICY,
): SessionWindows {
  const base = issuedAt.getTime();
  const absoluteExpiresAt = new Date(base + policy.absoluteLifetimeSeconds * 1000);
  const idleCandidate = base + policy.idleTimeoutSeconds * 1000;
  return {
    absoluteExpiresAt,
    // The idle window is never allowed to outlive the absolute window.
    idleExpiresAt: new Date(Math.min(idleCandidate, absoluteExpiresAt.getTime())),
  };
}

/**
 * Slide the idle window forward on verified activity, capped by the absolute deadline. Never extends
 * `absoluteExpiresAt` — that is the whole point of a fixed lifetime.
 */
export function renewIdleWindow(
  now: Date,
  absoluteExpiresAt: Date,
  policy: SessionPolicy = DEFAULT_SESSION_POLICY,
): Date {
  const candidate = now.getTime() + policy.idleTimeoutSeconds * 1000;
  return new Date(Math.min(candidate, absoluteExpiresAt.getTime()));
}

/** The subset of a `user_sessions` row the expiry decision needs. No secrets in this shape. */
export interface SessionSnapshot {
  readonly id: string;
  readonly status: 'active' | 'revoked' | 'expired';
  readonly issuedAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly idleExpiresAt: Date;
}

export type SessionEvaluation =
  | { kind: 'valid'; sessionId: string; nextIdleExpiresAt: Date }
  | { kind: 'expired'; sessionId: string; reason: 'absolute' | 'idle' }
  | { kind: 'revoked'; sessionId: string }
  /** No row, or a structurally invalid row → deny. Never treated as "allow". */
  | { kind: 'unknown' };

/**
 * Decide whether a session may serve this request. Order matters: revocation beats expiry (a revoked
 * session must never be reported as merely "expired"), and the absolute deadline beats the idle one.
 */
export function evaluateSession(
  session: SessionSnapshot | null | undefined,
  now: Date,
  policy: SessionPolicy = DEFAULT_SESSION_POLICY,
): SessionEvaluation {
  if (!session) return { kind: 'unknown' };
  // Structural guard: an unparseable date is corruption, not permission.
  const times = [session.issuedAt, session.absoluteExpiresAt, session.idleExpiresAt];
  if (times.some((d) => !(d instanceof Date) || Number.isNaN(d.getTime()))) return { kind: 'unknown' };

  if (session.status === 'revoked') return { kind: 'revoked', sessionId: session.id };
  if (session.status === 'expired')
    return { kind: 'expired', sessionId: session.id, reason: 'absolute' };
  if (session.status !== 'active') return { kind: 'unknown' }; // defensive: unknown status → deny

  if (now.getTime() >= session.absoluteExpiresAt.getTime())
    return { kind: 'expired', sessionId: session.id, reason: 'absolute' };
  if (now.getTime() >= session.idleExpiresAt.getTime())
    return { kind: 'expired', sessionId: session.id, reason: 'idle' };

  return {
    kind: 'valid',
    sessionId: session.id,
    nextIdleExpiresAt: renewIdleWindow(now, session.absoluteExpiresAt, policy),
  };
}

/**
 * Edge-safe absolute-lifetime check with NO database, derived from the JWT `iat` claim. This is the
 * cheap first gate the middleware can apply before (or without) a DB round trip. It can only reject —
 * a `true` here still requires the authoritative DB check in `session-registry.verifySession`.
 * Fail-closed: a missing/NaN/future-dated `iat` is rejected.
 */
export function isWithinAbsoluteLifetime(
  issuedAtEpochSeconds: number | null | undefined,
  now: Date,
  policy: SessionPolicy = DEFAULT_SESSION_POLICY,
): boolean {
  if (typeof issuedAtEpochSeconds !== 'number' || !Number.isFinite(issuedAtEpochSeconds)) return false;
  const issuedMs = issuedAtEpochSeconds * 1000;
  // Allow 60s of clock skew for a token minted "in the future"; more than that is not trustworthy.
  if (issuedMs > now.getTime() + 60_000) return false;
  return now.getTime() < issuedMs + policy.absoluteLifetimeSeconds * 1000;
}

/* ------------------------------------------------------------------ *
 * Concurrent-device cap (revoke-oldest)
 * ------------------------------------------------------------------ */

/** Minimal shape of an existing active session for the admission decision. No secrets. */
export interface ActiveSessionRef {
  readonly id: string;
  readonly issuedAt: Date;
  readonly deviceLabelHash: string;
}

export interface DeviceAdmissionDecision {
  /** Sessions to revoke (reason `device_limit`) BEFORE inserting the new one, oldest first. */
  readonly revokeSessionIds: readonly string[];
  /** True when the account was already at/over the cap — drives the `device_limit_reached` audit. */
  readonly atLimit: boolean;
  /** True when the incoming device label is not among the currently active ones. */
  readonly newDevice: boolean;
  /** True when a previously-unseen device displaced an existing session → security-relevant. */
  readonly suspicious: boolean;
}

/** Deterministic oldest-first ordering; ties broken by id so the decision is stable and testable. */
function oldestFirst(sessions: readonly ActiveSessionRef[]): ActiveSessionRef[] {
  return [...sessions].sort((a, b) => {
    const delta = a.issuedAt.getTime() - b.issuedAt.getTime();
    return delta !== 0 ? delta : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Decide what must be revoked to admit one more session under the concurrent-device cap.
 *
 * Policy: REVOKE-OLDEST. A login is never blocked — blocking would let an attacker who spams logins
 * lock the legitimate owner out (a denial-of-service), and it would train users to disable the
 * control. Instead the least-recently-issued session is evicted, and the eviction is audited so the
 * owner can see "you were signed out on another device".
 *
 * Self-healing: if drift ever leaves more than `maxActiveSessions` rows active, this revokes ALL the
 * excess in one pass rather than just one.
 */
export function decideDeviceAdmission(
  active: readonly ActiveSessionRef[],
  incomingDeviceLabelHash: string,
  policy: SessionPolicy = DEFAULT_SESSION_POLICY,
): DeviceAdmissionDecision {
  const sorted = oldestFirst(active);
  const newDevice = !sorted.some((s) => s.deviceLabelHash === incomingDeviceLabelHash);
  // Slots needed once the incoming session is counted.
  const overflow = sorted.length + 1 - policy.maxActiveSessions;
  const revokeSessionIds =
    overflow > 0 ? sorted.slice(0, overflow).map((s) => s.id) : ([] as string[]);
  const atLimit = revokeSessionIds.length > 0;
  return {
    revokeSessionIds,
    atLimit,
    newDevice,
    // An unrecognised device pushing the account over its cap is the signal worth alerting on.
    suspicious: atLimit && newDevice,
  };
}

/**
 * Password reset revokes EVERY session — including the one that requested the reset — so the user
 * must log in again with the new credential. Returns the ids to revoke, oldest first.
 */
export function sessionIdsToRevokeOnPasswordReset(
  active: readonly ActiveSessionRef[],
): readonly string[] {
  return oldestFirst(active).map((s) => s.id);
}

/* ------------------------------------------------------------------ *
 * Hashing / coarse device labels
 * ------------------------------------------------------------------ */

const TOKEN_HASH_DOMAIN = 'bp.session.v1:';
const DEVICE_HASH_DOMAIN = 'bp.device.v1:';
const IP_HASH_DOMAIN = 'bp.ip.v1:';

/** SHA-256 hex via Web Crypto. Runtime-agnostic (Node >= 18 and Edge). */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a raw session/refresh token for storage or lookup. Domain-separated so a session digest can
 * never be confused with a device or IP digest. The raw token is never returned or logged.
 */
export const hashSessionToken = (token: string): Promise<string> =>
  sha256Hex(TOKEN_HASH_DOMAIN + token);

/** Hash an IP for correlation only. The raw IP is never stored. */
export const hashIpAddress = (ip: string): Promise<string> => sha256Hex(IP_HASH_DOMAIN + ip);

/**
 * Reduce a user-agent to a COARSE `<browser>/<os>` label. This deliberately throws away version
 * numbers, architecture, and everything else that would make it a fingerprint — we want "Chrome on
 * macOS", not a tracking identifier. Unrecognised input degrades to `unknown/unknown`.
 */
export function coarseDeviceLabel(userAgent?: string | null, platform?: string | null): string {
  const ua = (userAgent ?? '').toLowerCase();
  const browser = ua.includes('edg/')
    ? 'edge'
    : ua.includes('opr/') || ua.includes('opera')
      ? 'opera'
      : ua.includes('chrome') || ua.includes('chromium')
        ? 'chrome'
        : ua.includes('firefox')
          ? 'firefox'
          : ua.includes('safari')
            ? 'safari'
            : 'unknown';
  const hintOs = (platform ?? '').toLowerCase();
  const probe = `${ua} ${hintOs}`;
  const os = probe.includes('android')
    ? 'android'
    : probe.includes('iphone') || probe.includes('ipad') || probe.includes('ios')
      ? 'ios'
      : probe.includes('mac')
        ? 'macos'
        : probe.includes('windows') || probe.includes('win32')
          ? 'windows'
          : probe.includes('linux')
            ? 'linux'
            : 'unknown';
  return `${browser}/${os}`;
}

/** Hash the coarse device label for storage. Never stores or logs the raw user-agent. */
export const deriveDeviceLabelHash = (
  userAgent?: string | null,
  platform?: string | null,
): Promise<string> => sha256Hex(DEVICE_HASH_DOMAIN + coarseDeviceLabel(userAgent, platform));
