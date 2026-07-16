import { describe, it, expect } from 'vitest';
import { hashEmail } from './email-suppression';

describe('hashEmail', () => {
  it('is a 64-char sha-256 hex digest', () => {
    expect(hashEmail('a@example.com')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normalizes case and surrounding whitespace so the same address maps to one hash', () => {
    const base = hashEmail('user@example.com');
    expect(hashEmail('  USER@Example.COM ')).toBe(base);
  });

  it('distinguishes different addresses', () => {
    expect(hashEmail('a@example.com')).not.toBe(hashEmail('b@example.com'));
  });
});
