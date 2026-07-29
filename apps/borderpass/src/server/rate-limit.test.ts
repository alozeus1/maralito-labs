import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  RATE_LIMIT_POLICIES,
  __resetRateLimitStateForTests,
  buildRateLimitKey,
  checkRateLimit,
  clientIpFromHeaders,
  createUpstashStore,
  enforceRateLimit,
  hashIdentifier,
  isDurableStoreConfigured,
  memoryStore,
  rateLimitResponse,
  requiresDurableStore,
  resolveRateLimitPolicy,
  resolveRateLimitStore,
} from './rate-limit';

// jsdom (vitest `environment: 'jsdom'`) ships `crypto.getRandomValues` but not always `crypto.subtle`.
// The module deliberately uses Web Crypto so it can run on the edge runtime; give the test env the
// real Node implementation rather than mocking the hash.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const RAW_IP = '203.0.113.7';
const req = (init?: { ip?: string; method?: string }) =>
  new Request('https://borderpass.test/api/automation/dispatch-notifications', {
    method: init?.method ?? 'POST',
    headers: init?.ip ? { 'x-forwarded-for': `${init.ip}, 70.41.3.18` } : {},
  });

let warn: ReturnType<typeof vi.spyOn>;
const savedEnv = { ...process.env };

beforeEach(() => {
  __resetRateLimitStateForTests();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  process.env = { ...savedEnv };
});

describe('requiresDurableStore / resolveRateLimitStore — fail-closed environment gate', () => {
  it('requires a durable store in production and staging', () => {
    expect(requiresDurableStore({ BORDERPASS_ENV: 'production' })).toBe(true);
    expect(requiresDurableStore({ BORDERPASS_ENV: 'staging' })).toBe(true);
  });

  it('requires a durable store when BORDERPASS_ENV is unset but NODE_ENV is production', () => {
    expect(requiresDurableStore({ NODE_ENV: 'production' })).toBe(true);
  });

  it('allows the in-memory store in local/preview/dev', () => {
    expect(requiresDurableStore({ BORDERPASS_ENV: 'local' })).toBe(false);
    expect(requiresDurableStore({ BORDERPASS_ENV: 'preview' })).toBe(false);
    expect(requiresDurableStore({ NODE_ENV: 'development' })).toBe(false);
  });

  it('PRODUCTION + no durable store ⇒ no store at all (the fail-closed signal)', () => {
    expect(resolveRateLimitStore({ BORDERPASS_ENV: 'production' })).toBeNull();
    expect(resolveRateLimitStore({ NODE_ENV: 'production' })).toBeNull();
  });

  it('dev + no durable store ⇒ in-memory store', () => {
    expect(resolveRateLimitStore({ BORDERPASS_ENV: 'local' })).toBe(memoryStore);
  });

  it('uses Upstash whenever both REST env vars are present', () => {
    const env = {
      BORDERPASS_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    };
    expect(isDurableStoreConfigured(env)).toBe(true);
    expect(resolveRateLimitStore(env)?.name).toBe('upstash');
    expect(resolveRateLimitStore(env)?.durable).toBe(true);
  });
});

describe('checkRateLimit — counting', () => {
  const policy = { key: 'rl:test:allow', limit: 3, windowMs: 60_000, policy: 'test' };

  it('allows requests under the threshold and counts remaining down', async () => {
    const a = await checkRateLimit(policy, memoryStore);
    const b = await checkRateLimit(policy, memoryStore);
    const c = await checkRateLimit(policy, memoryStore);
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, true]);
    expect(a.remaining).toBe(2);
    expect(c.remaining).toBe(0);
  });

  it('blocks the request that crosses the threshold, with a positive Retry-After', async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit(policy, memoryStore);
    const over = await checkRateLimit(policy, memoryStore);
    expect(over.ok).toBe(false);
    if (over.ok) throw new Error('unreachable');
    expect(over.reason).toBe('limit_exceeded');
    expect(over.remaining).toBe(0);
    expect(over.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets once the window elapses', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T00:00:00Z'));
    for (let i = 0; i < 3; i++) await checkRateLimit(policy, memoryStore);
    expect((await checkRateLimit(policy, memoryStore)).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    const afterReset = await checkRateLimit(policy, memoryStore);
    expect(afterReset.ok).toBe(true);
    expect(afterReset.remaining).toBe(2);
  });

  it('keys are independent', async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit(policy, memoryStore);
    const other = await checkRateLimit({ ...policy, key: 'rl:test:other' }, memoryStore);
    expect(other.ok).toBe(true);
  });
});

describe('checkRateLimit — fail closed', () => {
  it('DENIES when production has no durable store configured', async () => {
    const store = resolveRateLimitStore({ BORDERPASS_ENV: 'production' });
    expect(store).toBeNull();
    const d = await checkRateLimit({ key: 'k', limit: 100, windowMs: 60_000, policy: 'p' }, store);
    expect(d.ok).toBe(false);
    if (d.ok) throw new Error('unreachable');
    expect(d.reason).toBe('no_durable_store');
    expect(d.store).toBe('none');
    expect(d.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('DENIES when the durable store errors (outage ≠ open door)', async () => {
    const broken = {
      name: 'upstash' as const,
      durable: true,
      incr: () => Promise.reject(new Error('ECONNRESET')),
    };
    const d = await checkRateLimit({ key: 'k', limit: 100, windowMs: 60_000, policy: 'p' }, broken);
    expect(d.ok).toBe(false);
    if (d.ok) throw new Error('unreachable');
    expect(d.reason).toBe('store_error');
  });

  it('ALLOWS in dev with no store configured (in-memory fallback)', async () => {
    const store = resolveRateLimitStore({ BORDERPASS_ENV: 'local' });
    expect(store?.name).toBe('memory');
    const d = await checkRateLimit({ key: 'dev', limit: 2, windowMs: 60_000, policy: 'p' }, store);
    expect(d.ok).toBe(true);
    expect(d.store).toBe('memory');
  });
});

describe('key derivation — the IP is hashed, never stored or logged raw', () => {
  it('extracts the first x-forwarded-for hop', () => {
    expect(clientIpFromHeaders(req({ ip: RAW_IP }).headers)).toBe(RAW_IP);
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': RAW_IP }))).toBe(RAW_IP);
    expect(clientIpFromHeaders(new Headers())).toBeNull();
  });

  it('never places the raw IP in the key', async () => {
    const key = await buildRateLimitKey({ policy: 'otp_login', ip: RAW_IP }, {});
    expect(key).not.toContain(RAW_IP);
    expect(key).toMatch(/^rl:bp:otp_login:[0-9a-f]{16}$/);
  });

  it('is deterministic, policy-scoped, and salt-sensitive', async () => {
    const a = await hashIdentifier(RAW_IP, 'otp_login', {});
    const b = await hashIdentifier(RAW_IP, 'otp_login', {});
    const other = await hashIdentifier(RAW_IP, 'order_create', {});
    const salted = await hashIdentifier(RAW_IP, 'otp_login', { BORDERPASS_RATE_LIMIT_SALT: 's3cr3t' });
    expect(a).toBe(b);
    expect(a).not.toBe(other);
    expect(a).not.toBe(salted);
  });

  it('hashes the user id too and namespaces by prefix', async () => {
    const key = await buildRateLimitKey(
      { policy: 'order_create', ip: RAW_IP, userId: 'user-uuid-1234' },
      { BORDERPASS_RATE_LIMIT_PREFIX: 'prod' },
    );
    expect(key).not.toContain('user-uuid-1234');
    expect(key).toMatch(/^rl:prod:order_create:[0-9a-f]{16}:u[0-9a-f]{16}$/);
  });

  it('never writes a raw IP into the denial log line', async () => {
    process.env.BORDERPASS_ENV = 'local';
    const request = req({ ip: RAW_IP });
    for (let i = 0; i < RATE_LIMIT_POLICIES.otpLogin.limit + 1; i++) {
      await enforceRateLimit(request, RATE_LIMIT_POLICIES.otpLogin);
    }
    expect(warn).toHaveBeenCalled();
    const logged = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain(RAW_IP);
    expect(logged).toContain('rate_limited');
  });
});

describe('enforceRateLimit / rateLimitResponse — JSON 429, never HTML', () => {
  it('returns null while under the limit and a JSON 429 once over', async () => {
    process.env.BORDERPASS_ENV = 'local';
    const request = req({ ip: '198.51.100.4' });
    const policy = RATE_LIMIT_POLICIES.paymentInitiate;
    for (let i = 0; i < policy.limit; i++) {
      expect(await enforceRateLimit(request, policy)).toBeNull();
    }
    const blocked = await enforceRateLimit(request, policy);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get('Content-Type')).toContain('application/json');
    expect(Number(blocked?.headers.get('Retry-After'))).toBeGreaterThan(0);
    const body = (await blocked?.json()) as { error: string; policy: string };
    expect(body.error).toBe('rate_limited');
    expect(body.policy).toBe('payment_initiate');
  });

  it('emits Retry-After + RateLimit-* headers and no-store caching', () => {
    const res = rateLimitResponse({
      ok: false,
      policy: 'p',
      limit: 5,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      retryAfterSeconds: 30,
      reason: 'limit_exceeded',
      store: 'upstash',
    });
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(res.headers.get('RateLimit-Limit')).toBe('5');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('createUpstashStore — REST adapter', () => {
  it('pipelines INCR/PEXPIRE-NX/PTTL and parses the count + reset', async () => {
    const calls: Array<{ url: string; body: unknown; auth: string | null }> = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      calls.push({
        url,
        body: JSON.parse(String(init.body)) as unknown,
        auth: new Headers(init.headers).get('authorization'),
      });
      return Promise.resolve(
        new Response(JSON.stringify([{ result: 4 }, { result: 1 }, { result: 45_000 }]), {
          status: 200,
        }),
      );
    });
    const store = createUpstashStore('https://example.upstash.io/', 'tok_abc');
    const out = await store.incr('rl:bp:otp_login:deadbeefdeadbeef', 60_000);
    expect(out.count).toBe(4);
    expect(out.resetAt).toBeGreaterThan(Date.now() + 40_000);
    expect(calls[0]?.url).toBe('https://example.upstash.io/pipeline');
    expect(calls[0]?.auth).toBe('Bearer tok_abc');
    expect(calls[0]?.body).toEqual([
      ['INCR', 'rl:bp:otp_login:deadbeefdeadbeef'],
      ['PEXPIRE', 'rl:bp:otp_login:deadbeefdeadbeef', '60000', 'NX'],
      ['PTTL', 'rl:bp:otp_login:deadbeefdeadbeef'],
    ]);
  });

  it('assumes a full window when PTTL has no usable expiry', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(JSON.stringify([{ result: 1 }, { result: 0 }, { result: -1 }]), { status: 200 }),
      ),
    );
    const out = await createUpstashStore('https://example.upstash.io', 'tok').incr('k', 60_000);
    expect(out.resetAt).toBeGreaterThan(Date.now() + 55_000);
  });

  it('throws on a non-2xx response so the caller fails closed', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('nope', { status: 401 })));
    const store = createUpstashStore('https://example.upstash.io', 'bad');
    await expect(store.incr('k', 1000)).rejects.toThrow();
    const d = await checkRateLimit({ key: 'k', limit: 10, windowMs: 1000, policy: 'p' }, store);
    expect(d.ok).toBe(false);
  });
});

describe('resolveRateLimitPolicy — route mapping', () => {
  it('maps the sensitive routes', () => {
    expect(resolveRateLimitPolicy('/api/stripe/webhook', 'POST')?.name).toBe('stripe_webhook');
    expect(resolveRateLimitPolicy('/api/automation/review-request', 'POST')?.name).toBe('automation_api');
    expect(resolveRateLimitPolicy('/auth/callback', 'GET')?.name).toBe('auth_callback');
    expect(resolveRateLimitPolicy('/auth/confirm', 'GET')?.name).toBe('auth_callback');
    expect(resolveRateLimitPolicy('/login', 'POST')?.name).toBe('otp_login');
    expect(resolveRateLimitPolicy('/sign-up', 'POST')?.name).toBe('otp_login');
    expect(resolveRateLimitPolicy('/orders/new', 'POST')?.name).toBe('order_create');
    expect(resolveRateLimitPolicy('/orders/abc/pay', 'POST')?.name).toBe('payment_initiate');
    expect(resolveRateLimitPolicy('/admin/orders/abc/quote', 'POST')?.name).toBe('quote_action');
  });

  it('leaves ordinary page reads unlimited', () => {
    expect(resolveRateLimitPolicy('/login', 'GET')).toBeNull();
    expect(resolveRateLimitPolicy('/orders', 'GET')).toBeNull();
    expect(resolveRateLimitPolicy('/about', 'GET')).toBeNull();
  });
});
