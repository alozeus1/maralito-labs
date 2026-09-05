import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { type KmsProvider, KmsProviderUnavailableError } from './provider';

/**
 * AWS KMS provider (production KEK custodian) — ADR-0017 / `docs/production-readiness/kms-production-plan.md`.
 *
 * Wraps and unwraps per-record Data-Encryption-Keys via the AWS KMS `Encrypt` / `Decrypt` APIs. The KEK
 * (a customer-managed CMK) never leaves AWS; this process only ever holds a 256-bit DEK in memory for the
 * duration of one encrypt/decrypt call. Payload encryption itself stays in `envelope.ts` (AES-256-GCM) —
 * this file is *only* the KEK custodian half of the envelope contract.
 *
 * ## Why hand-rolled SigV4
 * The operator cannot currently run `pnpm install`, so `@aws-sdk/client-kms` cannot be added without
 * breaking the lockfile/CI. KMS `Encrypt`/`Decrypt` is the simplest possible SigV4 case: `POST /` with no
 * query string, no path segments to escape, a fixed small header set and a JSON body. The signing logic in
 * `signAwsRequestV4` is verified against AWS's own published vectors (see `aws-provider.test.ts`):
 * `get-vanilla` from the `aws-sig-v4-test-suite`, the `post-vanilla` signature, and the signing-key
 * derivation example from the AWS docs.
 *
 * ## Failure posture (all fail-CLOSED)
 * - Missing key id / credentials / region  → constructor throws; nothing is encrypted or decrypted.
 * - Wrong signature or insufficient IAM    → AWS returns 4xx → throw. A signing bug can never produce
 *   *wrong-but-accepted* ciphertext; AWS validates every request, so the only failure mode is refusal.
 * - Network / 5xx / throttling             → bounded retries, then throw.
 * - Tampered wrapped DEK                   → KMS `Decrypt` fails (or the encryption context mismatches) → throw.
 *
 * ## Never logged
 * Credentials, the `Authorization` header, DEK plaintext, and response bodies are never logged or included
 * in thrown error messages. Errors carry only the HTTP status and the AWS `__type` error code.
 *
 * ## Not auto-selected
 * `kms/config.ts` still throws for `MARALITO_KMS_PROVIDER=aws`. Wiring it is a deliberate, separate,
 * owner-approved step — see `docs/production-readiness/kms-production-plan.md` §"Wire the factory".
 */

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 'kms';
const CONTENT_TYPE = 'application/x-amz-json-1.1';
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Encryption context bound into every wrap/unwrap. KMS treats it as additional authenticated data and
 * logs it to CloudTrail, so it (a) prevents a ciphertext produced for one purpose being decrypted for
 * another and (b) makes IAM `kms:EncryptionContext:*` condition keys usable.
 *
 * MUST be byte-identical on Decrypt or the call fails. It therefore deliberately contains NO rotating
 * value (no keyRef, no record id) — changing it would strand every previously wrapped DEK.
 */
export const AWS_KMS_ENCRYPTION_CONTEXT: Readonly<Record<string, string>> = Object.freeze({
  app: 'borderpass',
  purpose: 'pii',
});

const sha256Hex = (data: string): string => createHash('sha256').update(data, 'utf8').digest('hex');
const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac('sha256', key).update(data, 'utf8').digest();

export interface AwsSigV4Input {
  method: string;
  /** Already-canonical path. For KMS this is always `/`. */
  canonicalUri: string;
  /** Already-canonical query string. For KMS this is always ''. */
  canonicalQuery: string;
  /** Headers to sign. Names are lower-cased and sorted; values trimmed + inner whitespace collapsed. */
  headers: Record<string, string>;
  body: string;
  /** `YYYYMMDDTHHMMSSZ`. */
  amzDate: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface AwsSigV4Result {
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
  signedHeaders: string;
  payloadHash: string;
  /** Value for the `Authorization` header. Contains no secret material. */
  authorization: string;
}

/**
 * AWS Signature Version 4 (header-based). Pure and deterministic — given the same inputs it always
 * produces the same signature, which is what makes it testable against AWS's published vectors.
 */
export function signAwsRequestV4(input: AwsSigV4Input): AwsSigV4Result {
  const dateStamp = input.amzDate.slice(0, 8);
  const payloadHash = sha256Hex(input.body);

  const lowered = new Map<string, string>();
  for (const [name, value] of Object.entries(input.headers)) {
    lowered.set(name.toLowerCase(), String(value).trim().replace(/\s+/g, ' '));
  }
  const names = [...lowered.keys()].sort();
  const canonicalHeaders = names.map((n) => `${n}:${lowered.get(n)}\n`).join('');
  const signedHeaders = names.join(';');

  const canonicalRequest = [
    input.method,
    input.canonicalUri,
    input.canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [ALGORITHM, input.amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${input.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, input.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return {
    canonicalRequest,
    stringToSign,
    signature,
    signedHeaders,
    payloadHash,
    authorization:
      `${ALGORITHM} Credential=${input.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

/** `YYYYMMDDTHHMMSSZ` — the only date format SigV4 accepts for `x-amz-date`. */
export function toAmzDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/**
 * Derive the AWS region from a KMS key/alias ARN (`arn:aws:kms:<region>:<acct>:key/…`).
 * Returns undefined for a bare key id or alias name, which must then supply the region explicitly.
 */
export function regionFromKeyArn(keyId: string): string | undefined {
  const parts = keyId.split(':');
  return parts[0] === 'arn' && parts.length > 4 && parts[3] ? parts[3] : undefined;
}

export interface AwsKmsProviderOptions {
  /** CMK key id, key ARN, `alias/name`, or alias ARN. Prefer an ALIAS ARN so rotation is config-free. */
  keyId: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Set when using STS/assume-role credentials. */
  sessionToken?: string | undefined;
  /** Override for VPC endpoints / FIPS endpoints. Defaults to `https://kms.<region>.amazonaws.com`. */
  endpoint?: string | undefined;
  /** Per-request timeout. Default 5000 ms. */
  timeoutMs?: number | undefined;
  /** Total attempts including the first. Default 3. */
  maxAttempts?: number | undefined;
  /** Injected for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch | undefined;
  /** Injected for tests, so signatures are deterministic. Defaults to `() => new Date()`. */
  now?: (() => Date) | undefined;
}

interface AwsKmsEnvLike {
  keyId?: string | undefined;
  region?: string | undefined;
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  sessionToken?: string | undefined;
  endpoint?: string | undefined;
}

/**
 * Read AWS KMS settings from the environment. Names only — values never appear in the repo.
 *
 *   MARALITO_KMS_KEY_ID       CMK alias ARN (preferred) / key ARN / key id.
 *   MARALITO_KMS_REGION       Region. Falls back to AWS_REGION, then the region inside the key ARN.
 *   MARALITO_KMS_ENDPOINT     Optional endpoint override (VPC / FIPS).
 *   AWS_ACCESS_KEY_ID         Credentials for the `borderpass-prod-kms` principal.
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_SESSION_TOKEN         Only when using temporary/assumed-role credentials.
 */
export function readAwsKmsEnv(env: NodeJS.ProcessEnv = process.env): AwsKmsEnvLike {
  const keyId = env.MARALITO_KMS_KEY_ID;
  return {
    keyId,
    region:
      env.MARALITO_KMS_REGION ?? env.AWS_REGION ?? (keyId ? regionFromKeyArn(keyId) : undefined),
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
    endpoint: env.MARALITO_KMS_ENDPOINT,
  };
}

/** True when every value the provider needs is present. Never inspects the values' contents. */
export function isAwsKmsConfigured(env: AwsKmsEnvLike = readAwsKmsEnv()): boolean {
  return Boolean(env.keyId && env.region && env.accessKeyId && env.secretAccessKey);
}

/**
 * Build the provider from the environment. Throws `KmsProviderUnavailableError` (fail-closed) when
 * anything is missing, naming only the missing variable — never a value.
 */
export function createAwsKmsProvider(
  env: AwsKmsEnvLike = readAwsKmsEnv(),
  overrides: Partial<AwsKmsProviderOptions> = {},
): AwsKmsProvider {
  const missing: string[] = [];
  if (!env.keyId) missing.push('MARALITO_KMS_KEY_ID');
  if (!env.region) missing.push('MARALITO_KMS_REGION (or AWS_REGION, or a region-bearing key ARN)');
  if (!env.accessKeyId) missing.push('AWS_ACCESS_KEY_ID');
  if (!env.secretAccessKey) missing.push('AWS_SECRET_ACCESS_KEY');
  if (missing.length > 0) {
    throw new KmsProviderUnavailableError(
      `AWS KMS provider is not configured: missing ${missing.join(', ')}.`,
    );
  }
  return new AwsKmsProvider({
    keyId: env.keyId!,
    region: env.region!,
    accessKeyId: env.accessKeyId!,
    secretAccessKey: env.secretAccessKey!,
    sessionToken: env.sessionToken,
    endpoint: env.endpoint,
    ...overrides,
  });
}

export class AwsKmsProvider implements KmsProvider {
  /** Goes into every ciphertext envelope. The configured key id/alias — never a secret. */
  readonly keyRef: string;

  readonly #region: string;
  readonly #endpoint: string;
  readonly #accessKeyId: string;
  readonly #secretAccessKey: string;
  readonly #sessionToken: string | undefined;
  readonly #timeoutMs: number;
  readonly #maxAttempts: number;
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;

  constructor(opts: AwsKmsProviderOptions) {
    if (!opts.keyId) throw new KmsProviderUnavailableError('AWS KMS: keyId is required.');
    if (!opts.region) throw new KmsProviderUnavailableError('AWS KMS: region is required.');
    if (!opts.accessKeyId || !opts.secretAccessKey) {
      throw new KmsProviderUnavailableError('AWS KMS: credentials are required.');
    }
    const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new KmsProviderUnavailableError('AWS KMS: no fetch implementation available.');
    }

    this.keyRef = opts.keyId;
    this.#region = opts.region;
    this.#endpoint = (opts.endpoint ?? `https://kms.${opts.region}.amazonaws.com`).replace(
      /\/+$/,
      '',
    );
    this.#accessKeyId = opts.accessKeyId;
    this.#secretAccessKey = opts.secretAccessKey;
    this.#sessionToken = opts.sessionToken;
    this.#timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    this.#fetch = fetchImpl;
    this.#now = opts.now ?? (() => new Date());
  }

  /** KMS `Encrypt`: DEK plaintext in, opaque base64 `CiphertextBlob` out. */
  async wrapDataKey(dek: Buffer): Promise<string> {
    if (!Buffer.isBuffer(dek) || dek.length === 0) {
      throw new KmsProviderUnavailableError('AWS KMS: refusing to wrap an empty data key.');
    }
    const res = await this.#call<{ CiphertextBlob?: string }>('Encrypt', {
      KeyId: this.keyRef,
      Plaintext: dek.toString('base64'),
      EncryptionContext: AWS_KMS_ENCRYPTION_CONTEXT,
    });
    if (!res.CiphertextBlob) {
      throw new KmsProviderUnavailableError('AWS KMS: Encrypt returned no CiphertextBlob.');
    }
    return res.CiphertextBlob;
  }

  /**
   * KMS `Decrypt`: opaque base64 `CiphertextBlob` in, DEK plaintext out.
   *
   * `KeyId` is deliberately NOT sent. For symmetric CMKs KMS resolves the key from the blob itself, and
   * omitting it means blobs wrapped by a PREVIOUS CMK still decrypt after an alias is repointed during
   * rotation. The `EncryptionContext` (checked by KMS as AAD) supplies the binding that `KeyId` would
   * otherwise give; least-privilege is enforced by the IAM policy on the principal.
   * → verify current `KeyId`-optional semantics in the official AWS KMS API docs before go-live.
   */
  async unwrapDataKey(wrapped: string): Promise<Buffer> {
    if (!wrapped)
      throw new KmsProviderUnavailableError('AWS KMS: refusing to unwrap an empty blob.');
    const res = await this.#call<{ Plaintext?: string }>('Decrypt', {
      CiphertextBlob: wrapped,
      EncryptionContext: AWS_KMS_ENCRYPTION_CONTEXT,
    });
    if (!res.Plaintext)
      throw new KmsProviderUnavailableError('AWS KMS: Decrypt returned no Plaintext.');
    return Buffer.from(res.Plaintext, 'base64');
  }

  /** Signed POST to the KMS JSON-1.1 endpoint, with bounded retries on transient failures. */
  async #call<T>(target: 'Encrypt' | 'Decrypt', payload: unknown): Promise<T> {
    const body = JSON.stringify(payload);
    const host = new URL(this.#endpoint).host;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
      const amzDate = toAmzDate(this.#now());
      const headers: Record<string, string> = {
        'content-type': CONTENT_TYPE,
        host,
        'x-amz-date': amzDate,
        'x-amz-target': `TrentService.${target}`,
        ...(this.#sessionToken ? { 'x-amz-security-token': this.#sessionToken } : {}),
      };
      const signed = signAwsRequestV4({
        method: 'POST',
        canonicalUri: '/',
        canonicalQuery: '',
        headers,
        body,
        amzDate,
        region: this.#region,
        service: SERVICE,
        accessKeyId: this.#accessKeyId,
        secretAccessKey: this.#secretAccessKey,
      });

      let res: Response;
      try {
        res = await this.#fetch(`${this.#endpoint}/`, {
          method: 'POST',
          // `host` is set by the runtime; sending it explicitly is rejected by undici.
          headers: { ...omitHost(headers), Authorization: signed.authorization },
          body,
          signal: AbortSignal.timeout(this.#timeoutMs),
        });
      } catch {
        // Network error / timeout. Never surface the cause — it can contain the request headers.
        lastError = new KmsProviderUnavailableError(`AWS KMS ${target}: network error.`);
        if (attempt < this.#maxAttempts) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw lastError;
      }

      if (res.ok) return (await res.json()) as T;

      // Read only the AWS error TYPE. Bodies are not logged and not embedded in the message.
      const errorType = await readAwsErrorType(res);
      const transient = res.status === 429 || res.status >= 500 || isThrottle(errorType);
      lastError = new KmsProviderUnavailableError(
        `AWS KMS ${target} failed: HTTP ${res.status}${errorType ? ` (${errorType})` : ''}.`,
      );
      if (transient && attempt < this.#maxAttempts) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw lastError;
    }
    throw lastError ?? new KmsProviderUnavailableError(`AWS KMS ${target} failed.`);
  }
}

function omitHost(headers: Record<string, string>): Record<string, string> {
  // Built without rest-destructuring: the repo's `@typescript-eslint/no-unused-vars` sets only
  // `argsIgnorePattern`, so an unused `_host` binding is an error (not just a warning).
  const rest: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key !== 'host') rest[key] = value;
  }
  return rest;
}

async function readAwsErrorType(res: Response): Promise<string | null> {
  try {
    const parsed = (await res.json()) as { __type?: unknown };
    const t = parsed.__type;
    // Sanitize: AWS error types are short ASCII identifiers, sometimes prefixed `com.amazonaws…#Name`.
    return typeof t === 'string'
      ? (t.split('#').pop() ?? '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 64) || null
      : null;
  } catch {
    return null;
  }
}

function isThrottle(errorType: string | null): boolean {
  return errorType === 'ThrottlingException' || errorType === 'KMSInternalException';
}

const backoffMs = (attempt: number): number => Math.min(1000, 100 * 2 ** (attempt - 1));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Constant-time string compare, exported for operator smoke scripts that verify a keyRef pin. */
export function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
