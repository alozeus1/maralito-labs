import { describe, it, expect } from 'vitest';
import { LocalDevKmsProvider } from '../src/kms/local-provider';
import { KmsProviderUnavailableError } from '../src/kms/provider';
import { getKmsProvider, isKmsConfigured } from '../src/kms/config';
import { encryptField, decryptField } from '../src/envelope';
import { encryptPII, decryptPII } from '../src/pii';

const KEY = 'dev-secret-key-material-0123456789';
const devEnv = { provider: 'local', localKeyMaterial: KEY, appEnv: 'preview' } as const;
const provider = () => new LocalDevKmsProvider({ keyMaterial: KEY, isProduction: false });

describe('@maralito/crypto — envelope encryption (Phase 8B, ADR-0017)', () => {
  it('round-trips a field', async () => {
    const f = await encryptField('hello address 123', provider());
    expect(f.alg).toBe('AES-256-GCM');
    expect(f.ct).not.toContain('hello');
    expect(await decryptField(f, provider())).toBe('hello address 123');
  });

  it('round-trips a PII object via encryptPII/decryptPII', async () => {
    const addr = { line1: '123 Test St', city: 'El Paso', postal: '79901' };
    const f = await encryptPII(addr, devEnv);
    expect(await decryptPII(f, devEnv)).toEqual(addr);
  });

  it('uses a fresh DEK + IV per encryption (ciphertext differs for same plaintext)', async () => {
    const a = await encryptField('same', provider());
    const b = await encryptField('same', provider());
    expect(a.ct).not.toBe(b.ct);
    expect(a.iv).not.toBe(b.iv);
    expect(a.dek).not.toBe(b.dek);
  });

  it('rejects tampered ciphertext (GCM auth tag)', async () => {
    const f = await encryptField('secret', provider());
    const bad = Buffer.from(f.ct, 'base64');
    bad[0] ^= 0xff;
    await expect(decryptField({ ...f, ct: bad.toString('base64') }, provider())).rejects.toThrow();
  });

  it('rejects a wrong KEK (different key material) on unwrap', async () => {
    const f = await encryptField('secret', provider());
    const wrong = new LocalDevKmsProvider({
      keyMaterial: 'another-dev-secret-abcdefghij',
      isProduction: false,
    });
    await expect(decryptField(f, wrong)).rejects.toThrow();
  });

  it('local provider is REFUSED in production (fail-closed)', () => {
    expect(() => new LocalDevKmsProvider({ keyMaterial: KEY, isProduction: true })).toThrow(
      KmsProviderUnavailableError,
    );
    expect(() =>
      getKmsProvider({ provider: 'local', localKeyMaterial: KEY, appEnv: 'production' }),
    ).toThrow(KmsProviderUnavailableError);
  });

  it('aws/gcp providers throw until wired (no silent misconfig)', () => {
    expect(() => getKmsProvider({ provider: 'aws', keyId: 'arn:...', appEnv: 'preview' })).toThrow(
      KmsProviderUnavailableError,
    );
  });

  it('isKmsConfigured reflects env', () => {
    expect(isKmsConfigured({ provider: 'local', localKeyMaterial: KEY })).toBe(true);
    expect(isKmsConfigured({ provider: 'local' })).toBe(false);
    expect(isKmsConfigured({ provider: 'aws', keyId: 'arn:...' })).toBe(true);
    expect(isKmsConfigured({ provider: 'aws' })).toBe(false);
  });
});
