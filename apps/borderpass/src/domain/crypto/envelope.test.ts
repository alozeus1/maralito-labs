import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { seal, open, isEnvelope, parseKek } from './envelope';

const kek = randomBytes(32);
const other = randomBytes(32);

describe('envelope encryption', () => {
  it('round-trips a plaintext', () => {
    const token = seal('Calle 5 de Mayo 123, Ciudad Juárez', kek);
    expect(open(token, kek)).toBe('Calle 5 de Mayo 123, Ciudad Juárez');
  });

  it('round-trips unicode + empty', () => {
    for (const s of ['', 'áéíóú ñ 🚚', 'x'.repeat(1000)]) {
      expect(open(seal(s, kek), kek)).toBe(s);
    }
  });

  it('produces a v1 envelope token, not plaintext', () => {
    const token = seal('secret', kek);
    expect(isEnvelope(token)).toBe(true);
    expect(token).not.toContain('secret');
  });

  it('same plaintext yields different ciphertexts (random DEK/IV)', () => {
    expect(seal('same', kek)).not.toBe(seal('same', kek));
  });

  it('fails to open with the wrong KEK', () => {
    const token = seal('secret', kek);
    expect(() => open(token, other)).toThrow();
  });

  it('detects tampering (auth tag)', () => {
    const token = seal('secret', kek);
    const parts = token.split('.');
    // flip a byte in the ciphertext segment
    const ct = Buffer.from(parts[3]!, 'base64url');
    ct[0] = ct[0]! ^ 0xff;
    parts[3] = ct.toString('base64url');
    expect(() => open(parts.join('.'), kek)).toThrow();
  });

  it('rejects a malformed token', () => {
    expect(() => open('not-an-envelope', kek)).toThrow();
    expect(() => open('v1.a.b.c', kek)).toThrow();
  });

  it('rejects a non-32-byte KEK', () => {
    expect(() => seal('x', randomBytes(16))).toThrow();
  });

  it('parseKek accepts base64 and hex 32-byte keys, rejects others', () => {
    expect(parseKek(kek.toString('base64')).length).toBe(32);
    expect(parseKek(kek.toString('hex')).length).toBe(32);
    expect(() => parseKek('short')).toThrow();
  });
});
