import { describe, it, expect } from 'vitest';
import {
  AWS_KMS_ENCRYPTION_CONTEXT,
  AwsKmsProvider,
  createAwsKmsProvider,
  isAwsKmsConfigured,
  readAwsKmsEnv,
  regionFromKeyArn,
  signAwsRequestV4,
  toAmzDate,
} from './aws-provider';
import { KmsProviderUnavailableError } from './provider';
import { encryptField, decryptField } from '../envelope';

/**
 * SigV4 is hand-rolled (no `@aws-sdk/client-kms` — a dependency cannot be added while the operator
 * cannot run `pnpm install`). These vectors are the regression guard for that decision. They come from
 * AWS's own published material, so a signing regression fails here and never reaches production.
 *
 * A wrong signature is fail-CLOSED (AWS returns 403), so this suite guards availability, not secrecy —
 * but a silent signing break would take PII writes down in production, which is worth a hard test.
 */

// AWS test credentials published in the SigV4 test suite. Not a secret — they authorize nothing.
const AK = 'AKIDEXAMPLE';
const SK = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY';

describe('signAwsRequestV4 — AWS published vectors', () => {
  it('reproduces `get-vanilla` from the aws-sig-v4-test-suite exactly', () => {
    const r = signAwsRequestV4({
      method: 'GET',
      canonicalUri: '/',
      canonicalQuery: '',
      headers: { Host: 'example.amazonaws.com', 'X-Amz-Date': '20150830T123600Z' },
      body: '',
      amzDate: '20150830T123600Z',
      region: 'us-east-1',
      service: 'service',
      accessKeyId: AK,
      secretAccessKey: SK,
    });

    expect(r.canonicalRequest).toBe(
      'GET\n/\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\n' +
        'host;x-amz-date\n' +
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(r.stringToSign).toBe(
      'AWS4-HMAC-SHA256\n20150830T123600Z\n20150830/us-east-1/service/aws4_request\n' +
        'bb579772317eb040ac9ed261061d46c1f17a8133879d6129b6e1c25292927e63',
    );
    expect(r.signature).toBe('5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31');
    expect(r.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    );
  });

  it('reproduces `post-vanilla` (exercises the POST method path KMS actually uses)', () => {
    const r = signAwsRequestV4({
      method: 'POST',
      canonicalUri: '/',
      canonicalQuery: '',
      headers: { Host: 'example.amazonaws.com', 'X-Amz-Date': '20150830T123600Z' },
      body: '',
      amzDate: '20150830T123600Z',
      region: 'us-east-1',
      service: 'service',
      accessKeyId: AK,
      secretAccessKey: SK,
    });
    expect(r.signature).toBe('5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b');
  });

  it('lower-cases + sorts header names and collapses whitespace in values', () => {
    const a = signAwsRequestV4({
      method: 'POST',
      canonicalUri: '/',
      canonicalQuery: '',
      headers: { 'X-Amz-Date': '20150830T123600Z', HOST: '  example.amazonaws.com  ' },
      body: '',
      amzDate: '20150830T123600Z',
      region: 'us-east-1',
      service: 'service',
      accessKeyId: AK,
      secretAccessKey: SK,
    });
    expect(a.signedHeaders).toBe('host;x-amz-date');
    expect(a.signature).toBe('5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b');
  });

  it('hashes the request body into the canonical request (body changes the signature)', () => {
    const base = {
      method: 'POST',
      canonicalUri: '/',
      canonicalQuery: '',
      headers: { Host: 'kms.us-east-2.amazonaws.com', 'X-Amz-Date': '20150830T123600Z' },
      amzDate: '20150830T123600Z',
      region: 'us-east-2',
      service: 'kms',
      accessKeyId: AK,
      secretAccessKey: SK,
    } as const;
    const one = signAwsRequestV4({ ...base, body: '{"a":1}' });
    const two = signAwsRequestV4({ ...base, body: '{"a":2}' });
    expect(one.payloadHash).not.toBe(two.payloadHash);
    expect(one.signature).not.toBe(two.signature);
  });

  it('is deterministic and region/service scoped', () => {
    const mk = (region: string, service: string) =>
      signAwsRequestV4({
        method: 'POST',
        canonicalUri: '/',
        canonicalQuery: '',
        headers: { Host: 'h', 'X-Amz-Date': '20150830T123600Z' },
        body: '{}',
        amzDate: '20150830T123600Z',
        region,
        service,
        accessKeyId: AK,
        secretAccessKey: SK,
      }).signature;
    expect(mk('us-east-2', 'kms')).toBe(mk('us-east-2', 'kms'));
    expect(mk('us-east-2', 'kms')).not.toBe(mk('us-east-1', 'kms'));
    expect(mk('us-east-2', 'kms')).not.toBe(mk('us-east-2', 'service'));
  });

  it('never leaks the secret key into the Authorization header', () => {
    const r = signAwsRequestV4({
      method: 'POST',
      canonicalUri: '/',
      canonicalQuery: '',
      headers: { Host: 'h', 'X-Amz-Date': '20150830T123600Z' },
      body: '{}',
      amzDate: '20150830T123600Z',
      region: 'us-east-2',
      service: 'kms',
      accessKeyId: AK,
      secretAccessKey: SK,
    });
    expect(r.authorization).not.toContain(SK);
    expect(r.stringToSign).not.toContain(SK);
  });
});

describe('toAmzDate / regionFromKeyArn', () => {
  it('formats as YYYYMMDDTHHMMSSZ', () => {
    expect(toAmzDate(new Date('2015-08-30T12:36:00.123Z'))).toBe('20150830T123600Z');
  });
  it('extracts the region from key and alias ARNs, and returns undefined otherwise', () => {
    expect(regionFromKeyArn('arn:aws:kms:us-east-2:111122223333:key/abcd-1234')).toBe('us-east-2');
    expect(regionFromKeyArn('arn:aws:kms:eu-west-1:111122223333:alias/borderpass-pii')).toBe('eu-west-1');
    expect(regionFromKeyArn('alias/borderpass-pii')).toBeUndefined();
    expect(regionFromKeyArn('abcd-1234')).toBeUndefined();
  });
});

describe('configuration — fail closed', () => {
  it('isAwsKmsConfigured requires key, region and both credentials', () => {
    expect(isAwsKmsConfigured({ keyId: 'k', region: 'r', accessKeyId: 'a', secretAccessKey: 's' })).toBe(true);
    expect(isAwsKmsConfigured({ keyId: 'k', region: 'r', accessKeyId: 'a' })).toBe(false);
    expect(isAwsKmsConfigured({ region: 'r', accessKeyId: 'a', secretAccessKey: 's' })).toBe(false);
    expect(isAwsKmsConfigured({})).toBe(false);
  });

  it('createAwsKmsProvider throws naming the MISSING VARIABLES ONLY (never a value)', () => {
    expect(() => createAwsKmsProvider({})).toThrow(KmsProviderUnavailableError);
    try {
      createAwsKmsProvider({ keyId: 'alias/borderpass-pii', accessKeyId: 'AKIA_x', secretAccessKey: 'shhh' });
      throw new Error('expected throw');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('MARALITO_KMS_REGION');
      expect(msg).not.toContain('shhh');
      expect(msg).not.toContain('AKIA_x');
    }
  });

  it('readAwsKmsEnv derives the region from a key ARN when no region var is set', () => {
    const env = readAwsKmsEnv({
      MARALITO_KMS_KEY_ID: 'arn:aws:kms:us-east-2:111122223333:alias/borderpass-pii',
      AWS_ACCESS_KEY_ID: 'a',
      AWS_SECRET_ACCESS_KEY: 's',
    } as NodeJS.ProcessEnv);
    expect(env.region).toBe('us-east-2');
    expect(isAwsKmsConfigured(env)).toBe(true);
  });
});

/** Fake KMS: wraps by prefixing (never real crypto), so we can assert the request contract + envelope round-trip. */
function fakeKms() {
  const calls: { target: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const headers = new Headers(init?.headers as HeadersInit);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const target = String(headers.get('x-amz-target'));
    calls.push({ target, body, headers });
    if (target.endsWith('Encrypt')) {
      return new Response(
        JSON.stringify({ CiphertextBlob: `wrapped:${String(body.Plaintext)}`, KeyId: String(body.KeyId) }),
        { status: 200 },
      );
    }
    const blob = String(body.CiphertextBlob);
    if (!blob.startsWith('wrapped:')) {
      return new Response(JSON.stringify({ __type: 'InvalidCiphertextException' }), { status: 400 });
    }
    return new Response(JSON.stringify({ Plaintext: blob.slice('wrapped:'.length) }), { status: 200 });
  };
  return { calls, fetchImpl };
}

const provider = (fetchImpl: typeof fetch, over: Partial<ConstructorParameters<typeof AwsKmsProvider>[0]> = {}) =>
  new AwsKmsProvider({
    keyId: 'arn:aws:kms:us-east-2:111122223333:alias/borderpass-pii',
    region: 'us-east-2',
    accessKeyId: AK,
    secretAccessKey: SK,
    fetchImpl,
    now: () => new Date('2015-08-30T12:36:00Z'),
    maxAttempts: 2,
    ...over,
  });

describe('AwsKmsProvider — request contract', () => {
  it('signs an Encrypt call with the right target, content-type and encryption context', async () => {
    const { calls, fetchImpl } = fakeKms();
    const p = provider(fetchImpl);
    const wrapped = await p.wrapDataKey(Buffer.alloc(32, 7));

    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.target).toBe('TrentService.Encrypt');
    expect(c.headers.get('content-type')).toBe('application/x-amz-json-1.1');
    expect(c.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20150830\/us-east-2\/kms\/aws4_request, /);
    expect(c.headers.get('authorization')).not.toContain(SK);
    expect(c.body.KeyId).toBe('arn:aws:kms:us-east-2:111122223333:alias/borderpass-pii');
    expect(c.body.Plaintext).toBe(Buffer.alloc(32, 7).toString('base64'));
    expect(c.body.EncryptionContext).toEqual(AWS_KMS_ENCRYPTION_CONTEXT);
    expect(wrapped).toContain('wrapped:');
  });

  it('omits KeyId on Decrypt (so alias rotation does not strand old blobs) but sends the context', async () => {
    const { calls, fetchImpl } = fakeKms();
    const p = provider(fetchImpl);
    const wrapped = await p.wrapDataKey(Buffer.alloc(32, 9));
    const dek = await p.unwrapDataKey(wrapped);

    const decryptCall = calls.find((c) => c.target === 'TrentService.Decrypt')!;
    expect(decryptCall.body).not.toHaveProperty('KeyId');
    expect(decryptCall.body.EncryptionContext).toEqual(AWS_KMS_ENCRYPTION_CONTEXT);
    expect(dek.equals(Buffer.alloc(32, 9))).toBe(true);
  });

  it('adds x-amz-security-token when using temporary credentials', async () => {
    const { calls, fetchImpl } = fakeKms();
    await provider(fetchImpl, { sessionToken: 'sts-session-token' }).wrapDataKey(Buffer.alloc(32));
    expect(calls[0]!.headers.get('x-amz-security-token')).toBe('sts-session-token');
    expect(calls[0]!.headers.get('authorization')).toContain('x-amz-security-token');
  });

  it('round-trips through envelope.ts using the provider as the KEK custodian', async () => {
    const { fetchImpl } = fakeKms();
    const p = provider(fetchImpl);
    const field = await encryptField(JSON.stringify({ line1: 'Av. Tecnológico 123' }), p);
    expect(field.keyRef).toBe('arn:aws:kms:us-east-2:111122223333:alias/borderpass-pii');
    expect(field.ct).not.toContain('Tecnol');
    expect(JSON.parse(await decryptField(field, p))).toEqual({ line1: 'Av. Tecnológico 123' });
  });

  it('respects an endpoint override (VPC / FIPS) and signs the overridden host', async () => {
    let seenUrl = '';
    const { fetchImpl } = fakeKms();
    const wrapped: typeof fetch = async (url, init) => {
      seenUrl = String(url);
      return fetchImpl(url, init);
    };
    await provider(wrapped, { endpoint: 'https://kms-fips.us-east-2.amazonaws.com' }).wrapDataKey(Buffer.alloc(32));
    expect(seenUrl).toBe('https://kms-fips.us-east-2.amazonaws.com/');
  });
});

describe('AwsKmsProvider — fail-closed error handling', () => {
  it('throws (never returns) on a 4xx, exposing only status + sanitized AWS error type', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ __type: 'com.amazonaws.kms#AccessDeniedException', message: 'secret detail' }), {
        status: 400,
      });
    await expect(provider(fetchImpl).wrapDataKey(Buffer.alloc(32))).rejects.toThrow(/HTTP 400 \(AccessDeniedException\)/);
    await expect(provider(fetchImpl).wrapDataKey(Buffer.alloc(32))).rejects.not.toThrow(/secret detail/);
  });

  it('does NOT retry a non-transient 4xx', async () => {
    let n = 0;
    const fetchImpl: typeof fetch = async () => {
      n++;
      return new Response(JSON.stringify({ __type: 'AccessDeniedException' }), { status: 403 });
    };
    await expect(provider(fetchImpl).wrapDataKey(Buffer.alloc(32))).rejects.toThrow();
    expect(n).toBe(1);
  });

  it('retries a 5xx up to maxAttempts, then throws', async () => {
    let n = 0;
    const fetchImpl: typeof fetch = async () => {
      n++;
      return new Response('{}', { status: 500 });
    };
    await expect(provider(fetchImpl, { maxAttempts: 3 }).wrapDataKey(Buffer.alloc(32))).rejects.toThrow(/HTTP 500/);
    expect(n).toBe(3);
  });

  it('retries a throttle and succeeds on a later attempt', async () => {
    let n = 0;
    const real = fakeKms();
    const fetchImpl: typeof fetch = async (u, i) => {
      n++;
      if (n === 1) return new Response(JSON.stringify({ __type: 'ThrottlingException' }), { status: 400 });
      return real.fetchImpl(u, i);
    };
    await expect(provider(fetchImpl, { maxAttempts: 3 }).wrapDataKey(Buffer.alloc(32))).resolves.toContain('wrapped:');
    expect(n).toBe(2);
  });

  it('converts a network failure into KmsProviderUnavailableError without the underlying cause', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.1:443 authorization=AWS4...');
    };
    await expect(provider(fetchImpl, { maxAttempts: 1 }).wrapDataKey(Buffer.alloc(32))).rejects.toThrow(
      /AWS KMS Encrypt: network error\.$/,
    );
  });

  it('refuses an empty DEK and an empty wrapped blob', async () => {
    const { fetchImpl } = fakeKms();
    await expect(provider(fetchImpl).wrapDataKey(Buffer.alloc(0))).rejects.toThrow(KmsProviderUnavailableError);
    await expect(provider(fetchImpl).unwrapDataKey('')).rejects.toThrow(KmsProviderUnavailableError);
  });

  it('throws when Encrypt returns no CiphertextBlob', async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ KeyId: 'k' }), { status: 200 });
    await expect(provider(fetchImpl).wrapDataKey(Buffer.alloc(32))).rejects.toThrow(/no CiphertextBlob/);
  });

  it('surfaces a tampered blob as a KMS rejection (fail-closed, no plaintext)', async () => {
    const { fetchImpl } = fakeKms();
    const p = provider(fetchImpl);
    const wrapped = await p.wrapDataKey(Buffer.alloc(32, 3));
    await expect(p.unwrapDataKey(`tampered${wrapped}`)).rejects.toThrow(/InvalidCiphertextException/);
  });
});
