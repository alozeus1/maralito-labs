import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Phase 9 / defect D3 regression tests — the legacy env-var-KEK PII path MUST fail closed in
 * production. Before the fix, setting BORDERPASS_KMS_KEY in a production environment silently
 * enabled real-PII storage under a dev-grade key (bypassing the fail-closed KMS provider in
 * @maralito/crypto). These tests exist so that hole cannot be reopened.
 */

// A syntactically valid 32-byte dev KEK (hex). Obviously fake; never a real key.
const DEV_KEK = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

// The module under test reads through the real `env.ts` zod schema, which *requires* the two public
// Supabase vars. They are unrelated to KMS but must be present or `getServerEnv()` throws a ZodError
// before our fail-closed logic is ever reached. Obvious non-secret placeholders.
const REQUIRED_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'not-a-real-anon-key',
};

/** The three signals `kms.ts` treats as "this is production". */
const PRODUCTION_SIGNALS = ['BORDERPASS_ENV', 'MARALITO_PLATFORM_ENV', 'NODE_ENV'] as const;

const ENV_KEYS: string[] = [
  ...PRODUCTION_SIGNALS,
  'BORDERPASS_KMS_KEY',
  ...Object.keys(REQUIRED_ENV),
];

/**
 * Write to process.env through an index-signature view. `@types/node` declares `NODE_ENV` as a
 * READ-ONLY property, so direct assignment (`process.env.NODE_ENV = …`) is a TS2540 compile error
 * even though it is perfectly legal at runtime. Tests must be able to simulate a production process.
 */
function setEnv(key: string, value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}

const saved: Record<string, string | undefined> = {};

async function resetEnvCache(): Promise<void> {
  // env.ts caches its parsed schema at module scope. Reset it explicitly rather than relying on
  // vi.resetModules() alone, so a var deleted mid-test is genuinely seen as absent.
  const env = await import('./env');
  env.__resetServerEnvForTests();
}

async function loadKms() {
  vi.resetModules(); // kms.ts caches the derived KEK — reload per scenario
  await resetEnvCache();
  return import('./kms');
}

beforeEach(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  // Apply only where absent so a real local env is never overwritten.
  for (const [k, v] of Object.entries(REQUIRED_ENV)) {
    if (process.env[k] === undefined) setEnv(k, v);
  }
  await resetEnvCache();
});

afterEach(async () => {
  for (const k of ENV_KEYS) setEnv(k, saved[k]);
  await resetEnvCache();
  vi.resetModules();
});

describe('legacy KMS facade — development-only (D3)', () => {
  it('encrypts and decrypts in development when the dev KEK is set', async () => {
    setEnv('BORDERPASS_ENV', 'local');
    setEnv('NODE_ENV', 'development');
    setEnv('BORDERPASS_KMS_KEY', DEV_KEK);
    const kms = await loadKms();

    expect(kms.isKmsConfigured()).toBe(true);
    const sealed = kms.sealPii('Av. Tecnológico 1234');
    expect(sealed).not.toContain('Tecnológico'); // ciphertext must not leak plaintext
    expect(kms.openPii(sealed)).toBe('Av. Tecnológico 1234');
  });

  for (const signal of PRODUCTION_SIGNALS) {
    it(`REFUSES to seal PII in production (via ${signal}) even with the dev KEK set`, async () => {
      setEnv('BORDERPASS_KMS_KEY', DEV_KEK); // the dangerous case: the key IS present
      setEnv(signal, 'production');
      const kms = await loadKms();

      expect(() => kms.sealPii('Calle Falsa 123')).toThrow(/development-only|production/i);
      expect(() => kms.sealOptional('+52 656 000 0000')).toThrow(/development-only|production/i);
    });

    it(`REFUSES to open sealed PII in production (via ${signal})`, async () => {
      setEnv('BORDERPASS_KMS_KEY', DEV_KEK);
      setEnv(signal, 'production');
      const kms = await loadKms();

      expect(() => kms.openPii('v1.a.b.c.d.e.f')).toThrow(/development-only|production/i);
      expect(() => kms.openOptional('v1.a.b.c.d.e.f')).toThrow(/development-only|production/i);
    });

    it(`reports isKmsConfigured() === false in production (via ${signal}) so branching callers degrade closed`, async () => {
      setEnv('BORDERPASS_KMS_KEY', DEV_KEK);
      setEnv(signal, 'production');
      const kms = await loadKms();

      expect(kms.isKmsConfigured()).toBe(false);
    });
  }

  it('cannot be bypassed by warming the KEK cache in development first', async () => {
    // Seal once in dev so the module-level KEK cache is populated, then flip to production.
    setEnv('BORDERPASS_ENV', 'local');
    setEnv('BORDERPASS_KMS_KEY', DEV_KEK);
    const kms = await loadKms();
    const sealed = kms.sealPii('cached-warmup');
    expect(kms.openPii(sealed)).toBe('cached-warmup');

    setEnv('BORDERPASS_ENV', 'production');
    expect(() => kms.sealPii('now in prod')).toThrow(/development-only|production/i);
    expect(() => kms.openPii(sealed)).toThrow(/development-only|production/i);
  });

  it('still fails closed in development when no key is configured', async () => {
    setEnv('BORDERPASS_ENV', 'local');
    setEnv('BORDERPASS_KMS_KEY', undefined);
    const kms = await loadKms();

    expect(kms.isKmsConfigured()).toBe(false);
    expect(() => kms.sealPii('x')).toThrow(/not configured/i);
  });

  it('does not reuse a cached KEK after the key is removed from the environment', async () => {
    setEnv('BORDERPASS_ENV', 'local');
    setEnv('BORDERPASS_KMS_KEY', DEV_KEK);
    const kms = await loadKms();
    expect(kms.openPii(kms.sealPii('warm'))).toBe('warm');

    // Remove the key WITHOUT reloading the module — the cached KEK must not keep working.
    setEnv('BORDERPASS_KMS_KEY', undefined);
    await resetEnvCache();
    expect(kms.isKmsConfigured()).toBe(false);
    expect(() => kms.sealPii('should refuse')).toThrow(/not configured/i);
  });

  it('never puts key material in the error message', async () => {
    setEnv('BORDERPASS_KMS_KEY', DEV_KEK);
    setEnv('BORDERPASS_ENV', 'production');
    const kms = await loadKms();

    try {
      kms.sealPii('x');
      throw new Error('expected a refusal');
    } catch (err) {
      const text = `${(err as Error).name}: ${(err as Error).message}`;
      expect(text).not.toContain(DEV_KEK);
      expect(text).not.toContain(DEV_KEK.slice(0, 16));
    }
  });

  it('sealOptional/openOptional keep null semantics in development', async () => {
    setEnv('BORDERPASS_ENV', 'local');
    setEnv('BORDERPASS_KMS_KEY', DEV_KEK);
    const kms = await loadKms();

    expect(kms.sealOptional(null)).toBeNull();
    expect(kms.sealOptional('   ')).toBeNull();
    expect(kms.openOptional(null)).toBeNull();
  });
});
