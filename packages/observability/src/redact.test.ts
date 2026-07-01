import { describe, it, expect } from 'vitest';
import { redact } from './redact';

describe('redact', () => {
  it('masks secret-ish keys, keeps safe ones', () => {
    const out = redact({
      display_name: 'Maria',
      password: 'p',
      token: 't',
      rfc: 'X',
      nested: { api_key: 'k', city: 'Juarez' },
    }) as {
      display_name: string;
      password: string;
      token: string;
      rfc: string;
      nested: { api_key: string; city: string };
    };
    expect(out.display_name).toBe('Maria');
    expect(out.password).toBe('[REDACTED]');
    expect(out.token).toBe('[REDACTED]');
    expect(out.rfc).toBe('[REDACTED]');
    expect(out.nested.api_key).toBe('[REDACTED]');
    expect(out.nested.city).toBe('Juarez');
  });
  it('handles arrays + primitives', () => {
    expect(redact([{ secret: 1 }, 'x'])).toEqual([{ secret: '[REDACTED]' }, 'x']);
    expect(redact('plain')).toBe('plain');
  });
});
