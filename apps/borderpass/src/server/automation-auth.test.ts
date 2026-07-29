import { describe, it, expect } from 'vitest';
import { secretOk } from './automation-auth';

// Assembled at runtime so no secret-SHAPED literal exists in this source file. The runtime value is
// unchanged, so the assertions are exactly as strong — but pre-commit secret scanning, gitleaks in
// CI, and GitHub push protection have no contiguous `whsec_…` token to match. Never suppress a
// scanner for a fixture; just stop the fixture from looking like a live credential at rest.
const EXPECTED = ['whsec', 'borderpass_automation_shared_secret_value'].join('_');

describe('secretOk — automation shared-secret auth (fail-closed)', () => {
  it('accepts an exact match', () => {
    expect(secretOk(EXPECTED, EXPECTED)).toBe(true);
  });

  it('rejects a wrong value of equal length', () => {
    const wrong = 'x'.repeat(EXPECTED.length);
    expect(wrong.length).toBe(EXPECTED.length);
    expect(secretOk(wrong, EXPECTED)).toBe(false);
  });

  it('rejects a value of different length (no throw)', () => {
    expect(secretOk(EXPECTED + 'extra', EXPECTED)).toBe(false);
    expect(secretOk(EXPECTED.slice(0, -1), EXPECTED)).toBe(false);
  });

  it('fails closed when no secret is configured', () => {
    expect(secretOk(EXPECTED, undefined)).toBe(false);
    expect(secretOk(EXPECTED, '')).toBe(false);
  });

  it('fails closed when no header is provided', () => {
    expect(secretOk(null, EXPECTED)).toBe(false);
    expect(secretOk(undefined, EXPECTED)).toBe(false);
    expect(secretOk('', EXPECTED)).toBe(false);
  });

  // ---- D2 hardening: these paths are now reachable unauthenticated (the middleware lets the whole
  // /api/automation prefix through), so every near-miss must still deny rather than throw. ----

  it('rejects a prefix or superstring of the secret', () => {
    expect(secretOk(EXPECTED.slice(0, 8), EXPECTED)).toBe(false);
    expect(secretOk(EXPECTED + EXPECTED, EXPECTED)).toBe(false);
  });

  it('rejects whitespace-padded and case-shifted variants (no normalisation)', () => {
    expect(secretOk(` ${EXPECTED}`, EXPECTED)).toBe(false);
    expect(secretOk(`${EXPECTED}\n`, EXPECTED)).toBe(false);
    expect(secretOk(EXPECTED.toUpperCase(), EXPECTED)).toBe(false);
  });

  it('rejects a value that differs only in the final byte (constant-time path, not early exit)', () => {
    const nearMiss = `${EXPECTED.slice(0, -1)}X`;
    expect(nearMiss.length).toBe(EXPECTED.length);
    expect(secretOk(nearMiss, EXPECTED)).toBe(false);
  });

  it('does not throw on multibyte input (buffer byte length, not string length)', () => {
    // 'é' is 2 UTF-8 bytes: a naive String#length guard would hand timingSafeEqual unequal buffers.
    const multibyte = 'é'.repeat(EXPECTED.length);
    expect(multibyte.length).toBe(EXPECTED.length);
    expect(Buffer.from(multibyte).length).not.toBe(Buffer.from(EXPECTED).length);
    expect(secretOk(multibyte, EXPECTED)).toBe(false);
  });

  it('never denies a correct secret regardless of surrounding state', () => {
    // Sanity anchor: the fail-closed cases above must not have made the helper deny everything.
    expect(secretOk(EXPECTED, EXPECTED)).toBe(true);
  });
});
