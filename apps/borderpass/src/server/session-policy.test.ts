import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ABSOLUTE_LIFETIME_SECONDS,
  DEFAULT_IDLE_TIMEOUT_SECONDS,
  DEFAULT_MAX_ACTIVE_SESSIONS,
  DEFAULT_SESSION_POLICY,
  MAX_ABSOLUTE_LIFETIME_SECONDS,
  MIN_ABSOLUTE_LIFETIME_SECONDS,
  SESSION_AUDIT_ACTIONS,
  coarseDeviceLabel,
  computeSessionWindows,
  decideDeviceAdmission,
  deriveDeviceLabelHash,
  evaluateSession,
  hashIpAddress,
  hashSessionToken,
  isWithinAbsoluteLifetime,
  renewIdleWindow,
  resolveSessionPolicy,
  sessionIdsToRevokeOnPasswordReset,
  sha256Hex,
  type ActiveSessionRef,
  type SessionSnapshot,
} from './session-policy';

const T0 = new Date('2026-07-28T09:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;
const HOUR = 60 * MIN;

const snapshot = (over: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  id: 'ses_1',
  status: 'active',
  issuedAt: T0,
  absoluteExpiresAt: at(12 * HOUR),
  idleExpiresAt: at(30 * MIN),
  ...over,
});

describe('resolveSessionPolicy — configurable, clamped, fail-closed', () => {
  it('defaults to 12h absolute / 30min idle / 2 devices', () => {
    expect(resolveSessionPolicy()).toEqual({
      absoluteLifetimeSeconds: 12 * 60 * 60,
      idleTimeoutSeconds: 30 * 60,
      maxActiveSessions: 2,
    });
    expect(DEFAULT_SESSION_POLICY.absoluteLifetimeSeconds).toBe(DEFAULT_ABSOLUTE_LIFETIME_SECONDS);
    expect(DEFAULT_SESSION_POLICY.idleTimeoutSeconds).toBe(DEFAULT_IDLE_TIMEOUT_SECONDS);
    expect(DEFAULT_SESSION_POLICY.maxActiveSessions).toBe(DEFAULT_MAX_ACTIVE_SESSIONS);
  });

  it('honours valid overrides', () => {
    expect(
      resolveSessionPolicy({
        SESSION_ABSOLUTE_LIFETIME_SECONDS: '3600',
        SESSION_IDLE_TIMEOUT_SECONDS: '600',
        SESSION_MAX_ACTIVE_DEVICES: '3',
      }),
    ).toEqual({ absoluteLifetimeSeconds: 3600, idleTimeoutSeconds: 600, maxActiveSessions: 3 });
  });

  it('falls back to the DEFAULT (not "unlimited") on unparseable config', () => {
    for (const bad of ['', '   ', 'abc', '0', '-1', '1.5', 'Infinity', 'NaN']) {
      const p = resolveSessionPolicy({
        SESSION_ABSOLUTE_LIFETIME_SECONDS: bad,
        SESSION_IDLE_TIMEOUT_SECONDS: bad,
        SESSION_MAX_ACTIVE_DEVICES: bad,
      });
      expect(p).toEqual(DEFAULT_SESSION_POLICY);
    }
  });

  it('clamps an absurdly long absolute lifetime down to 24h and a tiny one up to the floor', () => {
    expect(
      resolveSessionPolicy({ SESSION_ABSOLUTE_LIFETIME_SECONDS: '99999999' })
        .absoluteLifetimeSeconds,
    ).toBe(MAX_ABSOLUTE_LIFETIME_SECONDS);
    expect(
      resolveSessionPolicy({ SESSION_ABSOLUTE_LIFETIME_SECONDS: '5' }).absoluteLifetimeSeconds,
    ).toBe(MIN_ABSOLUTE_LIFETIME_SECONDS);
  });

  it('never lets the idle window exceed the absolute window', () => {
    const p = resolveSessionPolicy({
      SESSION_ABSOLUTE_LIFETIME_SECONDS: '600',
      SESSION_IDLE_TIMEOUT_SECONDS: '99999',
    });
    expect(p.idleTimeoutSeconds).toBe(600);
    expect(p.idleTimeoutSeconds).toBeLessThanOrEqual(p.absoluteLifetimeSeconds);
  });

  it('clamps the device cap to the allowed range (no "unlimited devices")', () => {
    expect(resolveSessionPolicy({ SESSION_MAX_ACTIVE_DEVICES: '999' }).maxActiveSessions).toBe(5);
    expect(resolveSessionPolicy({ SESSION_MAX_ACTIVE_DEVICES: '1' }).maxActiveSessions).toBe(1);
  });
});

describe('computeSessionWindows / renewIdleWindow — fixed lifetime is never extended', () => {
  it('derives both windows from issuedAt', () => {
    const w = computeSessionWindows(T0);
    expect(w.absoluteExpiresAt.toISOString()).toBe(at(12 * HOUR).toISOString());
    expect(w.idleExpiresAt.toISOString()).toBe(at(30 * MIN).toISOString());
  });

  it('caps the initial idle window at the absolute deadline', () => {
    const p = resolveSessionPolicy({
      SESSION_ABSOLUTE_LIFETIME_SECONDS: '600',
      SESSION_IDLE_TIMEOUT_SECONDS: '600',
    });
    const w = computeSessionWindows(T0, p);
    expect(w.idleExpiresAt.getTime()).toBe(w.absoluteExpiresAt.getTime());
  });

  it('slides the idle window on activity but never past the absolute deadline', () => {
    const abs = at(12 * HOUR);
    expect(renewIdleWindow(at(2 * HOUR), abs).toISOString()).toBe(
      at(2 * HOUR + 30 * MIN).toISOString(),
    );
    // 10 minutes before the absolute deadline, the idle window truncates to the deadline.
    expect(renewIdleWindow(at(12 * HOUR - 10 * MIN), abs).getTime()).toBe(abs.getTime());
  });
});

describe('evaluateSession — fail-closed expiry decisions', () => {
  it('admits an active, in-window session and returns the slid idle window', () => {
    const r = evaluateSession(snapshot(), at(10 * MIN));
    expect(r.kind).toBe('valid');
    if (r.kind !== 'valid') throw new Error('unreachable');
    expect(r.sessionId).toBe('ses_1');
    expect(r.nextIdleExpiresAt.toISOString()).toBe(at(40 * MIN).toISOString());
  });

  it('DENIES when there is no session row (fail closed, never "allow")', () => {
    expect(evaluateSession(null, at(0))).toEqual({ kind: 'unknown' });
    expect(evaluateSession(undefined, at(0))).toEqual({ kind: 'unknown' });
  });

  it('denies a corrupt row with an invalid date instead of admitting it', () => {
    const r = evaluateSession(snapshot({ absoluteExpiresAt: new Date('nope') }), at(1 * MIN));
    expect(r).toEqual({ kind: 'unknown' });
  });

  it('expires on the ABSOLUTE deadline even with continuous activity', () => {
    // Idle window kept fresh right up to the deadline; the absolute deadline still wins.
    const fresh = snapshot({ idleExpiresAt: at(12 * HOUR + 5 * MIN) });
    expect(evaluateSession(fresh, at(12 * HOUR))).toEqual({
      kind: 'expired',
      sessionId: 'ses_1',
      reason: 'absolute',
    });
    expect(evaluateSession(fresh, at(12 * HOUR + 1))).toMatchObject({ reason: 'absolute' });
    // One millisecond before, it is still valid.
    expect(evaluateSession(fresh, at(12 * HOUR - 1)).kind).toBe('valid');
  });

  it('expires on the IDLE deadline while still inside the absolute window', () => {
    expect(evaluateSession(snapshot(), at(30 * MIN))).toEqual({
      kind: 'expired',
      sessionId: 'ses_1',
      reason: 'idle',
    });
    expect(evaluateSession(snapshot(), at(30 * MIN - 1)).kind).toBe('valid');
  });

  it('reports the ABSOLUTE reason when both deadlines have passed (tighter reason wins)', () => {
    expect(evaluateSession(snapshot(), at(13 * HOUR))).toMatchObject({ reason: 'absolute' });
  });

  it('reports revoked (never "expired") for a revoked row, even if still in window', () => {
    expect(evaluateSession(snapshot({ status: 'revoked' }), at(1 * MIN))).toEqual({
      kind: 'revoked',
      sessionId: 'ses_1',
    });
  });

  it('treats an already-expired row as expired without re-admitting it', () => {
    expect(evaluateSession(snapshot({ status: 'expired' }), at(1 * MIN))).toMatchObject({
      kind: 'expired',
    });
  });

  it('denies an unrecognised status value (defensive default-deny)', () => {
    const rogue = { ...snapshot(), status: 'active_ish' } as unknown as SessionSnapshot;
    expect(evaluateSession(rogue, at(1 * MIN))).toEqual({ kind: 'unknown' });
  });
});

describe('isWithinAbsoluteLifetime — Edge-safe, DB-free pre-filter', () => {
  it('accepts a token inside the absolute window and rejects one past it', () => {
    const iat = Math.floor(T0.getTime() / 1000);
    expect(isWithinAbsoluteLifetime(iat, at(11 * HOUR))).toBe(true);
    expect(isWithinAbsoluteLifetime(iat, at(12 * HOUR))).toBe(false);
    expect(isWithinAbsoluteLifetime(iat, at(13 * HOUR))).toBe(false);
  });

  it('rejects missing / non-numeric / infinite iat (fail closed)', () => {
    expect(isWithinAbsoluteLifetime(null, T0)).toBe(false);
    expect(isWithinAbsoluteLifetime(undefined, T0)).toBe(false);
    expect(isWithinAbsoluteLifetime(Number.NaN, T0)).toBe(false);
    expect(isWithinAbsoluteLifetime(Number.POSITIVE_INFINITY, T0)).toBe(false);
  });

  it('tolerates 60s of clock skew but rejects a far-future iat', () => {
    expect(isWithinAbsoluteLifetime(Math.floor(at(30_000).getTime() / 1000), T0)).toBe(true);
    expect(isWithinAbsoluteLifetime(Math.floor(at(10 * MIN).getTime() / 1000), T0)).toBe(false);
  });
});

describe('decideDeviceAdmission — max 2 devices, revoke-oldest', () => {
  const ref = (id: string, minutesAgo: number, device = 'dev_' + id): ActiveSessionRef => ({
    id,
    issuedAt: at(-minutesAgo * MIN),
    deviceLabelHash: device,
  });

  it('admits the 1st and 2nd session with nothing revoked', () => {
    expect(decideDeviceAdmission([], 'dev_new')).toMatchObject({
      revokeSessionIds: [],
      atLimit: false,
    });
    expect(decideDeviceAdmission([ref('a', 60)], 'dev_new')).toMatchObject({
      revokeSessionIds: [],
      atLimit: false,
    });
  });

  it('a 3rd login revokes the OLDEST session only', () => {
    const active = [ref('newer', 10), ref('oldest', 300)];
    const d = decideDeviceAdmission(active, 'dev_new');
    expect(d.revokeSessionIds).toEqual(['oldest']);
    expect(d.atLimit).toBe(true);
    expect(d.newDevice).toBe(true);
    expect(d.suspicious).toBe(true);
  });

  it('ignores insertion order — oldest is decided by issuedAt, not array position', () => {
    const a = [ref('oldest', 300), ref('newer', 10)];
    const b = [ref('newer', 10), ref('oldest', 300)];
    expect(decideDeviceAdmission(a, 'x').revokeSessionIds).toEqual(['oldest']);
    expect(decideDeviceAdmission(b, 'x').revokeSessionIds).toEqual(['oldest']);
  });

  it('breaks issuedAt ties deterministically by id so the decision is stable', () => {
    const tied = [ref('zzz', 100), ref('aaa', 100)];
    expect(decideDeviceAdmission(tied, 'x').revokeSessionIds).toEqual(['aaa']);
    expect(decideDeviceAdmission([...tied].reverse(), 'x').revokeSessionIds).toEqual(['aaa']);
  });

  it('self-heals drift by revoking ALL excess sessions in one pass', () => {
    const active = [ref('s1', 500), ref('s2', 400), ref('s3', 300), ref('s4', 200)];
    const d = decideDeviceAdmission(active, 'dev_new');
    // 4 active + 1 incoming = 5; cap is 2 → 3 must go, oldest first.
    expect(d.revokeSessionIds).toEqual(['s1', 's2', 's3']);
  });

  it('never leaves the account above the cap after admission', () => {
    for (let n = 0; n <= 6; n++) {
      const active = Array.from({ length: n }, (_, i) => ref('s' + i, (n - i) * 10));
      const d = decideDeviceAdmission(active, 'dev_new');
      const remaining = n - d.revokeSessionIds.length + 1; // survivors + the new one
      expect(remaining).toBeLessThanOrEqual(DEFAULT_MAX_ACTIVE_SESSIONS);
    }
  });

  it('respects a configured cap of 3', () => {
    const p = resolveSessionPolicy({ SESSION_MAX_ACTIVE_DEVICES: '3' });
    const active = [ref('a', 300), ref('b', 200)];
    expect(decideDeviceAdmission(active, 'dev_new', p).revokeSessionIds).toEqual([]);
    expect(
      decideDeviceAdmission([...active, ref('c', 100)], 'dev_new', p).revokeSessionIds,
    ).toEqual(['a']);
  });

  it('flags a KNOWN device at the cap as not suspicious, an UNKNOWN device as suspicious', () => {
    const active = [ref('a', 300, 'dev_known'), ref('b', 200, 'dev_other')];
    const known = decideDeviceAdmission(active, 'dev_known');
    expect(known.atLimit).toBe(true);
    expect(known.newDevice).toBe(false);
    expect(known.suspicious).toBe(false); // re-login from a device we've seen
    const unknown = decideDeviceAdmission(active, 'dev_brand_new');
    expect(unknown.suspicious).toBe(true);
  });

  it('does not flag a new device as suspicious when the account is under the cap', () => {
    expect(decideDeviceAdmission([ref('a', 60)], 'dev_brand_new')).toMatchObject({
      newDevice: true,
      atLimit: false,
      suspicious: false,
    });
  });

  it('does not mutate the caller-supplied array', () => {
    const active = [ref('newer', 10), ref('oldest', 300)];
    const before = active.map((s) => s.id);
    decideDeviceAdmission(active, 'x');
    expect(active.map((s) => s.id)).toEqual(before);
  });
});

describe('sessionIdsToRevokeOnPasswordReset — revokes ALL sessions', () => {
  const ref = (id: string, minutesAgo: number): ActiveSessionRef => ({
    id,
    issuedAt: at(-minutesAgo * MIN),
    deviceLabelHash: 'dev_' + id,
  });

  it('returns every active session id, oldest first (including the current one)', () => {
    expect(sessionIdsToRevokeOnPasswordReset([ref('b', 10), ref('a', 300), ref('c', 5)])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('is an empty list when nothing is active', () => {
    expect(sessionIdsToRevokeOnPasswordReset([])).toEqual([]);
  });

  it('leaves no session behind — count matches the input exactly', () => {
    const active = [ref('a', 1), ref('b', 2), ref('c', 3), ref('d', 4)];
    expect(sessionIdsToRevokeOnPasswordReset(active)).toHaveLength(active.length);
  });
});

describe('hashing — tokens are never stored in the clear', () => {
  it('produces a 64-char lowercase hex SHA-256', async () => {
    const h = await sha256Hex('abc');
    // Known SHA-256("abc") vector — proves we are really hashing, not encoding.
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('is deterministic and never returns the input', async () => {
    const token = 'sb-access-token-value';
    const a = await hashSessionToken(token);
    const b = await hashSessionToken(token);
    expect(a).toBe(b);
    expect(a).not.toContain(token);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('domain-separates session / device / ip digests of the same input', async () => {
    const [s, d, i] = await Promise.all([
      hashSessionToken('same'),
      sha256Hex('bp.device.v1:same'),
      hashIpAddress('same'),
    ]);
    expect(new Set([s, d, i]).size).toBe(3);
  });

  it('different tokens hash differently', async () => {
    expect(await hashSessionToken('a')).not.toBe(await hashSessionToken('b'));
  });
});

describe('coarseDeviceLabel — coarse, non-identifying device label', () => {
  it('reduces a full user-agent to <browser>/<os> with no version or PII', () => {
    const chromeMac =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    expect(coarseDeviceLabel(chromeMac)).toBe('chrome/macos');
    expect(coarseDeviceLabel(chromeMac)).not.toMatch(/126|537|Macintosh/);
  });

  it('classifies the browsers we care about, preferring the more specific match', () => {
    expect(coarseDeviceLabel('Mozilla/5.0 Chrome/1 Safari/1 Edg/120')).toBe('edge/unknown');
    expect(coarseDeviceLabel('Mozilla/5.0 (X11; Linux) Firefox/128.0')).toBe('firefox/linux');
    expect(coarseDeviceLabel('Mozilla/5.0 (iPhone) Version/17 Safari/605')).toBe('safari/ios');
    expect(coarseDeviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/126')).toBe('chrome/windows');
    expect(coarseDeviceLabel('Mozilla/5.0 (Linux; Android 14) Chrome/126')).toBe('chrome/android');
  });

  it('degrades to unknown/unknown rather than throwing on missing input', () => {
    expect(coarseDeviceLabel()).toBe('unknown/unknown');
    expect(coarseDeviceLabel(null, null)).toBe('unknown/unknown');
    expect(coarseDeviceLabel('')).toBe('unknown/unknown');
  });

  it('uses the platform hint when the user-agent lacks an OS token', () => {
    expect(coarseDeviceLabel('Firefox/128.0', 'MacIntel')).toBe('firefox/macos');
  });

  it('hashes the label, never the raw user-agent', async () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0 Safari/537.36';
    const h = await deriveDeviceLabelHash(ua);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(await sha256Hex('bp.device.v1:chrome/macos'));
    // Two Chrome-on-macOS agents at different versions share a label by design (coarse, not a fingerprint).
    expect(await deriveDeviceLabelHash(ua.replace('126.0.0.0', '999.0.0.0'))).toBe(h);
  });
});

describe('SESSION_AUDIT_ACTIONS — stable, required action names', () => {
  it('uses the mandated password-reset action name', () => {
    expect(SESSION_AUDIT_ACTIONS.passwordResetRevokedAll).toBe(
      'auth.password_reset_sessions_revoked',
    );
  });

  it('namespaces every action under auth. and keeps them unique', () => {
    const values = Object.values(SESSION_AUDIT_ACTIONS);
    expect(values.every((v) => v.startsWith('auth.'))).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
});
