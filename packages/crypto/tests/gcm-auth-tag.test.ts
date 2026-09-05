import { describe, it, expect } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { LocalDevKmsProvider } from '../src/kms/local-provider';
import { encryptField, decryptField } from '../src/envelope';
import { AUTH_TAG_LENGTH, IV_LENGTH, InvalidCiphertextError } from '../src/gcm';

const KEY = 'dev-secret-key-material-0123456789';
const provider = () => new LocalDevKmsProvider({ keyMaterial: KEY, isProduction: false });

/**
 * Regression suite for the two Semgrep `gcm-no-tag-length` findings (CI run 30428423400).
 *
 * Node's AES-GCM accepts truncated authentication tags of 4, 8, 12, 13, 14, 15 or 16 bytes unless
 * `authTagLength` is pinned on the decipher. The stored envelope (`encrypted_pii.ciphertext` jsonb)
 * and the wrapped-DEK blob are both attacker-reachable if the row store is ever compromised, so a
 * shortened tag must be rejected outright — accepting a 4-byte tag would reduce forgery cost by
 * ~2^96 and, for GCM specifically, leaks material that helps recover the authentication subkey.
 *
 * These tests assert the REJECTION, not merely that decryption fails: `InvalidCiphertextError`
 * proves the guard fired before any key material or cipher primitive was touched.
 */
describe('AES-256-GCM authentication-tag length is pinned and validated', () => {
  describe('envelope decryptField', () => {
    it('rejects a truncated auth tag at every length Node would otherwise accept', async () => {
      const field = await encryptField('sensitive-value', provider());
      const fullTag = Buffer.from(field.tag, 'base64');
      expect(fullTag).toHaveLength(AUTH_TAG_LENGTH);

      // Every short length Node's GCM permits when authTagLength is left unpinned.
      for (const shortLength of [4, 8, 12, 13, 14, 15]) {
        const truncated = fullTag.subarray(0, shortLength).toString('base64');
        await expect(decryptField({ ...field, tag: truncated }, provider())).rejects.toBeInstanceOf(
          InvalidCiphertextError,
        );
      }
    });

    it('rejects an over-long auth tag', async () => {
      const field = await encryptField('sensitive-value', provider());
      const overLong = Buffer.concat([Buffer.from(field.tag, 'base64'), Buffer.alloc(4)]);
      await expect(
        decryptField({ ...field, tag: overLong.toString('base64') }, provider()),
      ).rejects.toBeInstanceOf(InvalidCiphertextError);
    });

    it('rejects an empty, malformed or non-string auth tag', async () => {
      const field = await encryptField('sensitive-value', provider());
      for (const tag of ['', '!!!!not-base64!!!!', 'AAAA']) {
        await expect(decryptField({ ...field, tag }, provider())).rejects.toBeInstanceOf(
          InvalidCiphertextError,
        );
      }
      await expect(
        decryptField({ ...field, tag: undefined as unknown as string }, provider()),
      ).rejects.toBeInstanceOf(InvalidCiphertextError);
    });

    it('rejects a tampered (full-length) auth tag', async () => {
      const field = await encryptField('sensitive-value', provider());
      const tampered = Buffer.from(field.tag, 'base64');
      tampered[0] ^= 0xff;
      await expect(
        decryptField({ ...field, tag: tampered.toString('base64') }, provider()),
      ).rejects.toThrow();
    });

    it('rejects a truncated or tampered IV', async () => {
      const field = await encryptField('sensitive-value', provider());
      const iv = Buffer.from(field.iv, 'base64');
      expect(iv).toHaveLength(IV_LENGTH);
      await expect(
        decryptField({ ...field, iv: iv.subarray(0, 8).toString('base64') }, provider()),
      ).rejects.toBeInstanceOf(InvalidCiphertextError);

      const flipped = Buffer.from(field.iv, 'base64');
      flipped[0] ^= 0xff;
      await expect(
        decryptField({ ...field, iv: flipped.toString('base64') }, provider()),
      ).rejects.toThrow();
    });

    it('still round-trips an untampered field', async () => {
      const field = await encryptField('sensitive-value', provider());
      expect(await decryptField(field, provider())).toBe('sensitive-value');
    });

    it('rejects a field whose tag was re-cut to a short length by a real short-tag cipher', async () => {
      // Build a genuinely valid 4-byte-tag ciphertext, i.e. the exact artefact an attacker would
      // craft. The guard must refuse it even though the tag verifies under a 4-byte authTagLength.
      const key = randomBytes(32);
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 4 });
      const ct = Buffer.concat([cipher.update(Buffer.from('x', 'utf8')), cipher.final()]);
      const shortTag = cipher.getAuthTag();
      expect(shortTag).toHaveLength(4);

      const good = await encryptField('x', provider());
      await expect(
        decryptField(
          {
            ...good,
            iv: iv.toString('base64'),
            ct: ct.toString('base64'),
            tag: shortTag.toString('base64'),
          },
          provider(),
        ),
      ).rejects.toBeInstanceOf(InvalidCiphertextError);
    });
  });

  describe('LocalDevKmsProvider unwrapDataKey', () => {
    it('round-trips a wrapped data key', async () => {
      const dek = randomBytes(32);
      const p = provider();
      expect(await p.unwrapDataKey(await p.wrapDataKey(dek))).toEqual(dek);
    });

    it('rejects a blob too short to carry iv | full tag | ciphertext', async () => {
      const p = provider();
      const wrapped = Buffer.from(await p.wrapDataKey(randomBytes(32)), 'base64');
      // Anything shorter than IV + full tag + one ciphertext byte would leave `subarray` to clamp
      // silently and hand a SHORT tag to setAuthTag.
      for (const length of [0, 1, IV_LENGTH, IV_LENGTH + 4, IV_LENGTH + AUTH_TAG_LENGTH]) {
        await expect(
          p.unwrapDataKey(wrapped.subarray(0, length).toString('base64')),
        ).rejects.toBeInstanceOf(InvalidCiphertextError);
      }
    });

    it('rejects an empty, malformed or non-string wrapped key', async () => {
      const p = provider();
      for (const wrapped of ['', '!!!!']) {
        await expect(p.unwrapDataKey(wrapped)).rejects.toBeInstanceOf(InvalidCiphertextError);
      }
      await expect(p.unwrapDataKey(undefined as unknown as string)).rejects.toBeInstanceOf(
        InvalidCiphertextError,
      );
    });

    it('rejects a tampered tag or ciphertext at full length', async () => {
      const p = provider();
      const base = Buffer.from(await p.wrapDataKey(randomBytes(32)), 'base64');

      const badTag = Buffer.from(base);
      badTag[IV_LENGTH] ^= 0xff;
      await expect(p.unwrapDataKey(badTag.toString('base64'))).rejects.toThrow();

      const badCt = Buffer.from(base);
      badCt[IV_LENGTH + AUTH_TAG_LENGTH] ^= 0xff;
      await expect(p.unwrapDataKey(badCt.toString('base64'))).rejects.toThrow();
    });

    it('never puts key material into the rejection message', async () => {
      const p = provider();
      const err = await p.unwrapDataKey('AAAA').catch((e: Error) => e);
      expect(err).toBeInstanceOf(InvalidCiphertextError);
      expect((err as Error).message).not.toContain(KEY);
      expect((err as Error).message).toMatch(/at least \d+ bytes/);
    });
  });
});
