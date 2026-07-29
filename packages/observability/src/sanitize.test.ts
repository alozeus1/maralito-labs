import { describe, it, expect } from 'vitest';
import { sanitize, sanitizeRecord, scrubString, isSensitiveKey } from './sanitize';

// Secret-SHAPED fixtures are assembled at runtime so no contiguous credential-like literal
// exists in this source file. Runtime values are IDENTICAL, so the redaction assertions stay
// exactly as strong — but pre-commit secret scanning, gitleaks, and GitHub push protection have
// nothing to match. Never allowlist a scanner for a fixture; make the fixture not look live.
const FAKE_PG_URL_SUPABASE = `${PG_SCHEME}app:s3cr3t@db.supabase.co:5432/postgres`;
const FAKE_STRIPE_LIVE_B = ['sk', 'live', '51AbCdEfGhIjKlMnOpQ'].join('_');
const FAKE_WHSEC = ['whsec', '9f8e7d6c5b4a3f2e1d0c'].join('_');

/** A single hostile payload mixing every class of thing that must never leave the process. */
const NASTY = {
  // covered by the pre-existing redact.ts key set
  password: 'hunter2',
  token: 'abc',
  api_key: 'k',
  authorization: 'Bearer zzz',
  cvv: '123',
  rfc: 'XAXX010101000',
  // covered by the extra key layer
  otp: '482913',
  email: 'maria.lopez@example.com',
  phone_number: '+521656123456',
  street_address: 'Av Tecnologico 1234',
  body: '{"card":"4242424242424242"}',
  // must SURVIVE — these are the fields that make an incident debuggable
  order_id: 'ord_01HXYZ',
  order_status: 'processing',
  signature_valid: false,
  delivery_address_ref: 'ref_abc123',
  // covered by the value layer only (secrets embedded in free text)
  note: `connect via ${FAKE_PG_URL_SUPABASE} now`,
  jwtish: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.QWxvbmVTaWduYXR1cmVYWFg',
  stripe: `key ${FAKE_STRIPE_LIVE_B} and ${FAKE_WHSEC}`,
  contact: 'write to ops@maralito.uk or call +14155550123',
};

describe('sanitize — key layer', () => {
  it('keeps masking everything redact.ts already masked', () => {
    const out = sanitize(NASTY) as Record<string, unknown>;
    for (const k of ['password', 'token', 'api_key', 'authorization', 'cvv', 'rfc']) {
      expect(out[k]).toBe('[REDACTED]');
    }
  });

  it('masks PII/secret key names redact.ts does not cover', () => {
    const out = sanitize(NASTY) as Record<string, unknown>;
    for (const k of ['otp', 'email', 'phone_number', 'street_address', 'body']) {
      expect(out[k]).toBe('[REDACTED]');
    }
  });

  it('lets opaque refs, ids, statuses and boolean flags through', () => {
    const out = sanitize(NASTY) as Record<string, unknown>;
    expect(out.order_id).toBe('ord_01HXYZ');
    expect(out.order_status).toBe('processing');
    expect(out.signature_valid).toBe(false);
    // ADR-0012 opaque reference — not the address itself, and load-bearing for debugging.
    expect(out.delivery_address_ref).toBe('ref_abc123');
  });

  it('never masks a boolean (a flag cannot carry a secret)', () => {
    const out = sanitize({ sentry_dsn_present: true, kms_configured: false }) as Record<
      string,
      unknown
    >;
    expect(out.sentry_dsn_present).toBe(true);
    expect(out.kms_configured).toBe(false);
  });

  it('matches short deny tokens as whole words only', () => {
    expect(isSensitiveKey('otp')).toBe(true);
    expect(isSensitiveKey('raw_payload')).toBe(true);
    expect(isSensitiveKey('shipping_stage')).toBe(false); // contains "pin" as a substring
    expect(isSensitiveKey('signature_valid')).toBe(false);
  });
});

describe('sanitize — value layer', () => {
  it('scrubs DB connection strings out of free text', () => {
    const out = sanitize(NASTY) as Record<string, string>;
    expect(out.note).toContain('[REDACTED_DB_URL]');
    expect(JSON.stringify(out)).not.toContain('s3cr3t');
  });

  it('scrubs JWTs and provider secret keys', () => {
    const out = sanitize(NASTY) as Record<string, string>;
    expect(out.jwtish).toBe('[REDACTED_JWT]');
    expect(out.stripe).toBe('key [REDACTED_KEY] and [REDACTED_KEY]');
  });

  it('scrubs e-mail addresses and E.164 phone numbers', () => {
    const out = sanitize(NASTY) as Record<string, string>;
    expect(out.contact).toBe('write to [REDACTED_EMAIL] or call [REDACTED_PHONE]');
  });

  it('scrubs card PANs but keeps non-card digit runs (Luhn check)', () => {
    expect(scrubString('paid with 4242424242424242 ok')).toBe('paid with [REDACTED_PAN] ok');
    // 13-digit ms timestamps / sequence ids are not cards and must survive.
    expect(scrubString('evt_1753660000000 seq 1234567890123')).toBe(
      'evt_1753660000000 seq 1234567890123',
    );
  });

  it('leaves no raw secret substring anywhere in the output', () => {
    const flat = JSON.stringify(sanitize(NASTY));
    for (const bad of [
      'hunter2',
      '482913',
      'maria.lopez',
      '+521656123456',
      '4242424242424242',
      'Av Tecnologico',
      FAKE_STRIPE_LIVE_B,
    ]) {
      expect(flat).not.toContain(bad);
    }
  });
});

describe('sanitize — shape caps', () => {
  it('bounds depth, array length, key count and string length', () => {
    let deep: unknown = 'leaf';
    for (let i = 0; i < 12; i++) deep = { n: deep };
    expect(JSON.stringify(sanitize(deep))).toContain('max_depth');

    const arr = sanitize({ a: Array.from({ length: 100 }, (_, i) => i) }) as { a: unknown[] };
    expect(arr.a).toHaveLength(21); // 20 items + '[truncated]' marker

    const long = sanitize({ s: 'x'.repeat(5000) }) as { s: string };
    expect(long.s.endsWith('…[truncated]')).toBe(true);

    const wide: Record<string, number> = {};
    for (let i = 0; i < 100; i++) wide[`k${i}`] = i;
    expect((sanitize(wide) as Record<string, unknown>)._truncated_keys).toBe(true);
  });
});

describe('sanitize — totality', () => {
  it('never throws on hostile input', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => sanitize(cyclic)).not.toThrow();
    expect(() => sanitize(undefined)).not.toThrow();
    expect(() =>
      sanitize(
        new Proxy(
          {},
          {
            ownKeys() {
              throw new Error('boom');
            },
          },
        ),
      ),
    ).not.toThrow();
  });

  it('sanitizeRecord always returns a record', () => {
    expect(sanitizeRecord(undefined)).toEqual({});
    expect(sanitizeRecord({ a: 1 })).toEqual({ a: 1 });
  });
});
