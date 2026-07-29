import { describe, it, expect } from 'vitest';
import { SESSION_ENFORCEMENT_FLAG, isSessionEnforcementEnabledValue } from './session-policy';
import {
  NO_DEVICE_HINTS,
  decideSessionGuard,
  recordLoginSessionCore,
  revokeCurrentSessionCore,
  type DeviceHints,
  type LoginRecordDeps,
  type LoginRecordStage,
  type SessionGuardDeps,
  type SignOutRecordDeps,
  type SignOutRecordStage,
} from './session-guard-core';
import type {
  RegisterSessionInput,
  RegisterSessionResult,
  SessionVerification,
} from './session-registry';

/**
 * The contract this suite exists to prove:
 *
 *  1. FLAG OFF IS A TRUE NO-OP. Not "returns allow" — literally does not call the token resolver,
 *     the DB-backed verifier, the registrar, the revoker, or the auditor. That is what makes the
 *     dark deploy safe against a database that has no `user_sessions` table yet.
 *  2. FLAG ON ENFORCES, FAIL-CLOSED. expired / revoked / unknown / unavailable / thrown ⇒ deny.
 *  3. RECORDING NEVER BREAKS LOGIN OR LOGOUT. Every dependency may throw; the caller still resolves.
 */

const TOKEN = 'sid-11111111-2222-3333-4444-555555555555';
const USER = 'auth-user-1';
const ORG = 'org_dev0000000bp';

const OK_REGISTRATION: RegisterSessionResult = {
  ok: true,
  sessionId: 'ses_1',
  revokedSessionIds: [],
  absoluteExpiresAt: new Date('2026-07-28T21:00:00.000Z'),
};
const FAILED_REGISTRATION: RegisterSessionResult = {
  ok: false,
  sessionId: null,
  revokedSessionIds: [],
  absoluteExpiresAt: null,
};

const VALID: SessionVerification = {
  ok: true,
  sessionId: 'ses_1',
  authUserId: USER,
  orgId: ORG,
  idleExpiresAt: new Date('2026-07-28T09:30:00.000Z'),
};

/** Counters, so "was anything called at all?" is directly assertable. */
interface Calls {
  token: number;
  enforce: number;
  audit: number;
  org: number;
  hints: number;
  register: number;
  revoke: number;
  failures: string[];
}
const newCalls = (): Calls => ({
  token: 0,
  enforce: 0,
  audit: 0,
  org: 0,
  hints: 0,
  register: 0,
  revoke: 0,
  failures: [],
});

const boom = () => {
  throw new Error('dependency exploded');
};

function guardDeps(
  calls: Calls,
  opts: {
    enabled: boolean;
    verification?: SessionVerification;
    throwOnToken?: boolean;
    throwOnEnforce?: boolean;
    throwOnAudit?: boolean;
  },
): SessionGuardDeps {
  return {
    isEnabled: () => opts.enabled,
    resolveSessionToken: async () => {
      calls.token += 1;
      if (opts.throwOnToken) boom();
      return TOKEN;
    },
    enforce: async () => {
      calls.enforce += 1;
      if (opts.throwOnEnforce) boom();
      return opts.verification ?? VALID;
    },
    auditDenial: async () => {
      calls.audit += 1;
      if (opts.throwOnAudit) boom();
    },
  };
}

function loginDeps(
  calls: Calls,
  opts: {
    enabled: boolean;
    token?: string | null;
    orgId?: string | null;
    hints?: DeviceHints;
    result?: RegisterSessionResult;
    throwOnToken?: boolean;
    throwOnRegister?: boolean;
    throwOnFailureLog?: boolean;
    captured?: { input?: RegisterSessionInput };
  },
): LoginRecordDeps {
  return {
    isEnabled: () => opts.enabled,
    resolveSessionToken: async () => {
      calls.token += 1;
      if (opts.throwOnToken) boom();
      return opts.token === undefined ? TOKEN : opts.token;
    },
    resolveOrgId: async () => {
      calls.org += 1;
      return opts.orgId === undefined ? ORG : opts.orgId;
    },
    resolveDeviceHints: async () => {
      calls.hints += 1;
      return opts.hints ?? { userAgent: 'UA', platform: '"macOS"', ipAddress: '198.51.100.7' };
    },
    register: async (input) => {
      calls.register += 1;
      if (opts.captured) opts.captured.input = input;
      if (opts.throwOnRegister) boom();
      return opts.result ?? OK_REGISTRATION;
    },
    onFailure: (stage: LoginRecordStage) => {
      calls.failures.push(stage);
      if (opts.throwOnFailureLog) boom();
    },
  };
}

function signOutDeps(
  calls: Calls,
  opts: {
    enabled: boolean;
    token?: string | null;
    revoked?: boolean;
    throwOnRevoke?: boolean;
  },
): SignOutRecordDeps {
  return {
    isEnabled: () => opts.enabled,
    resolveSessionToken: async () => {
      calls.token += 1;
      return opts.token === undefined ? TOKEN : opts.token;
    },
    revoke: async () => {
      calls.revoke += 1;
      if (opts.throwOnRevoke) boom();
      return opts.revoked ?? true;
    },
    onFailure: (stage: SignOutRecordStage) => calls.failures.push(stage),
  };
}

/* ================================================================== *
 * 1. The flag itself
 * ================================================================== */

describe('session enforcement flag', () => {
  it('is named exactly BORDERPASS_SESSION_ENFORCEMENT', () => {
    expect(SESSION_ENFORCEMENT_FLAG).toBe('BORDERPASS_SESSION_ENFORCEMENT');
  });

  it('is ON only for the exact string "on"', () => {
    expect(isSessionEnforcementEnabledValue('on')).toBe(true);
  });

  it('defaults to OFF for unset and for every near-miss value', () => {
    for (const raw of [undefined, null, '', ' ', 'off', 'ON', 'On', ' on', 'on ', 'true', '1', 'yes', 'enabled']) {
      expect(isSessionEnforcementEnabledValue(raw)).toBe(false);
    }
  });
});

/* ================================================================== *
 * 2. Flag OFF is a true no-op
 * ================================================================== */

describe('flag OFF — shipped dark', () => {
  it('allows the request without resolving a token, hitting the DB, or auditing', async () => {
    const calls = newCalls();
    const verdict = await decideSessionGuard(
      { surface: 'customer', authUserId: USER, orgId: ORG },
      guardDeps(calls, { enabled: false }),
    );
    expect(verdict).toBeNull();
    expect(calls.token).toBe(0);
    expect(calls.enforce).toBe(0);
    expect(calls.audit).toBe(0);
  });

  it('allows even when the verifier would have denied — the flag short-circuits first', async () => {
    const calls = newCalls();
    const verdict = await decideSessionGuard(
      { surface: 'admin' },
      guardDeps(calls, { enabled: false, verification: { ok: false, reason: 'revoked' } }),
    );
    expect(verdict).toBeNull();
    expect(calls.enforce).toBe(0);
  });

  it('records nothing at login — no token read, no org lookup, no insert', async () => {
    const calls = newCalls();
    expect(await recordLoginSessionCore(USER, loginDeps(calls, { enabled: false }))).toBe('disabled');
    expect(calls).toMatchObject({ token: 0, org: 0, hints: 0, register: 0, failures: [] });
  });

  it('revokes nothing at sign-out', async () => {
    const calls = newCalls();
    expect(await revokeCurrentSessionCore(signOutDeps(calls, { enabled: false }))).toBe('disabled');
    expect(calls).toMatchObject({ token: 0, revoke: 0, failures: [] });
  });
});

/* ================================================================== *
 * 3. Flag ON enforces, fail-closed
 * ================================================================== */

describe('flag ON — enforcement', () => {
  it('allows a valid session and writes no denial audit', async () => {
    const calls = newCalls();
    const verdict = await decideSessionGuard(
      { surface: 'customer', authUserId: USER, orgId: ORG },
      guardDeps(calls, { enabled: true, verification: VALID }),
    );
    expect(verdict).toBeNull();
    expect(calls.token).toBe(1);
    expect(calls.enforce).toBe(1);
    expect(calls.audit).toBe(0);
  });

  it('denies an absolutely-expired session', async () => {
    const calls = newCalls();
    expect(
      await decideSessionGuard(
        { surface: 'customer' },
        guardDeps(calls, { enabled: true, verification: { ok: false, reason: 'expired_absolute' } }),
      ),
    ).toBe('expired_absolute');
    // Already audited by verifySession when the row was marked expired — no duplicate row here.
    expect(calls.audit).toBe(0);
  });

  it('denies an idle-expired session', async () => {
    const calls = newCalls();
    expect(
      await decideSessionGuard(
        { surface: 'customer' },
        guardDeps(calls, { enabled: true, verification: { ok: false, reason: 'expired_idle' } }),
      ),
    ).toBe('expired_idle');
  });

  it('denies a revoked session (sign-out elsewhere, or evicted by the device cap)', async () => {
    const calls = newCalls();
    expect(
      await decideSessionGuard(
        { surface: 'admin' },
        guardDeps(calls, { enabled: true, verification: { ok: false, reason: 'revoked' } }),
      ),
    ).toBe('revoked');
    expect(calls.audit).toBe(0); // enforceSessionForRequest already audits revoked
  });

  it('denies an unknown token', async () => {
    const calls = newCalls();
    expect(
      await decideSessionGuard(
        { surface: 'customer' },
        guardDeps(calls, { enabled: true, verification: { ok: false, reason: 'unknown' } }),
      ),
    ).toBe('unknown');
    expect(calls.audit).toBe(0); // enforceSessionForRequest already audits unknown
  });

  it('denies and audits when no session token could be resolved', async () => {
    const calls = newCalls();
    expect(
      await decideSessionGuard(
        { surface: 'customer', authUserId: USER, orgId: ORG },
        guardDeps(calls, { enabled: true, verification: { ok: false, reason: 'no_token' } }),
      ),
    ).toBe('no_token');
    expect(calls.audit).toBe(1);
  });

  it('denies and audits when session state is unavailable (DB down / table missing)', async () => {
    const calls = newCalls();
    expect(
      await decideSessionGuard(
        { surface: 'admin' },
        guardDeps(calls, { enabled: true, verification: { ok: false, reason: 'unavailable' } }),
      ),
    ).toBe('unavailable');
    expect(calls.audit).toBe(1);
  });

  it('fails CLOSED when the verifier throws', async () => {
    const calls = newCalls();
    expect(
      await decideSessionGuard(
        { surface: 'customer' },
        guardDeps(calls, { enabled: true, throwOnEnforce: true }),
      ),
    ).toBe('unavailable');
  });

  it('fails CLOSED when the token resolver throws', async () => {
    const calls = newCalls();
    expect(
      await decideSessionGuard(
        { surface: 'customer' },
        guardDeps(calls, { enabled: true, throwOnToken: true }),
      ),
    ).toBe('unavailable');
    expect(calls.enforce).toBe(0);
  });

  it('still denies with the true reason when the auditor itself throws', async () => {
    const calls = newCalls();
    expect(
      await decideSessionGuard(
        { surface: 'customer' },
        guardDeps(calls, {
          enabled: true,
          verification: { ok: false, reason: 'unavailable' },
          throwOnAudit: true,
        }),
      ),
    ).toBe('unavailable');
  });
});

/* ================================================================== *
 * 4. Recording is best-effort — it must never break login
 * ================================================================== */

describe('flag ON — login registration is best-effort', () => {
  it('records the session with org, user, token and coarse device hints', async () => {
    const calls = newCalls();
    const captured: { input?: RegisterSessionInput } = {};
    expect(await recordLoginSessionCore(USER, loginDeps(calls, { enabled: true, captured }))).toBe(
      'recorded',
    );
    expect(calls.register).toBe(1);
    expect(captured.input).toMatchObject({
      authUserId: USER,
      orgId: ORG,
      sessionToken: TOKEN,
      userAgent: 'UA',
      platform: '"macOS"',
      ipAddress: '198.51.100.7',
    });
  });

  it('omits absent device hints rather than passing undefined (exactOptionalPropertyTypes)', async () => {
    const calls = newCalls();
    const captured: { input?: RegisterSessionInput } = {};
    await recordLoginSessionCore(
      USER,
      loginDeps(calls, { enabled: true, hints: NO_DEVICE_HINTS, captured }),
    );
    expect(Object.keys(captured.input ?? {}).sort()).toEqual(
      ['authUserId', 'orgId', 'sessionToken'].sort(),
    );
  });

  it('DOES NOT THROW when the registrar throws — a login must never fail on bookkeeping', async () => {
    const calls = newCalls();
    const outcome = await recordLoginSessionCore(
      USER,
      loginDeps(calls, { enabled: true, throwOnRegister: true }),
    );
    expect(outcome).toBe('failed');
    expect(calls.failures).toEqual(['error']);
  });

  it('does not throw when the token resolver throws', async () => {
    const calls = newCalls();
    expect(
      await recordLoginSessionCore(USER, loginDeps(calls, { enabled: true, throwOnToken: true })),
    ).toBe('failed');
    expect(calls.register).toBe(0);
  });

  it('does not throw even when the failure logger itself throws', async () => {
    const calls = newCalls();
    expect(
      await recordLoginSessionCore(
        USER,
        loginDeps(calls, { enabled: true, throwOnRegister: true, throwOnFailureLog: true }),
      ),
    ).toBe('failed');
  });

  it('skips (without inserting) when no session token can be resolved', async () => {
    const calls = newCalls();
    expect(await recordLoginSessionCore(USER, loginDeps(calls, { enabled: true, token: null }))).toBe(
      'skipped',
    );
    expect(calls.register).toBe(0);
    expect(calls.failures).toEqual(['token']);
  });

  it('skips (without inserting) when the org cannot be resolved', async () => {
    const calls = newCalls();
    expect(await recordLoginSessionCore(USER, loginDeps(calls, { enabled: true, orgId: null }))).toBe(
      'skipped',
    );
    expect(calls.register).toBe(0);
    expect(calls.failures).toEqual(['org']);
  });

  it('reports a registrar that returns ok:false as failed, not as recorded', async () => {
    const calls = newCalls();
    expect(
      await recordLoginSessionCore(
        USER,
        loginDeps(calls, { enabled: true, result: FAILED_REGISTRATION }),
      ),
    ).toBe('failed');
    expect(calls.failures).toEqual(['register']);
  });
});

/* ================================================================== *
 * 5. Sign-out revocation is best-effort
 * ================================================================== */

describe('flag ON — sign-out revocation is best-effort', () => {
  it('revokes the current session', async () => {
    const calls = newCalls();
    expect(await revokeCurrentSessionCore(signOutDeps(calls, { enabled: true }))).toBe('revoked');
    expect(calls.revoke).toBe(1);
  });

  it('DOES NOT THROW when revocation throws — sign-out must always complete', async () => {
    const calls = newCalls();
    expect(
      await revokeCurrentSessionCore(signOutDeps(calls, { enabled: true, throwOnRevoke: true })),
    ).toBe('failed');
    expect(calls.failures).toEqual(['error']);
  });

  it('reports a no-op revocation (already revoked / not found) as failed, not revoked', async () => {
    const calls = newCalls();
    expect(
      await revokeCurrentSessionCore(signOutDeps(calls, { enabled: true, revoked: false })),
    ).toBe('failed');
    expect(calls.failures).toEqual(['revoke']);
  });

  it('skips when there is no token left to identify the session', async () => {
    const calls = newCalls();
    expect(await revokeCurrentSessionCore(signOutDeps(calls, { enabled: true, token: null }))).toBe(
      'skipped',
    );
    expect(calls.revoke).toBe(0);
    expect(calls.failures).toEqual(['token']);
  });
});
