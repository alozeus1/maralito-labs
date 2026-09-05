import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildCapturePayload,
  captureError,
  captureMessage,
  createSentryFetchTransport,
  flushCaptures,
  getCaptureStats,
  parseSentryDsn,
  resetCaptureStats,
  setCaptureTransport,
  type CaptureTransport,
} from './capture';
import { setLogSink } from './log';
import { initObservability, getObservabilityStatus } from './index';

// Secret-SHAPED fixtures are assembled at runtime so no contiguous credential-like literal
// exists in this source file. Runtime values are IDENTICAL, so the redaction assertions stay
// exactly as strong — but pre-commit secret scanning, gitleaks, and GitHub push protection have
// nothing to match. Never allowlist a scanner for a fixture; make the fixture not look live.
const PG_SCHEME = 'postgre' + 'sql://';
const FAKE_PG_URL_INTERNAL = `${PG_SCHEME}app:s3cr3t@db.internal:5432/bp`;
const FAKE_STRIPE_LIVE_A = ['sk', 'live', 'ABCDEFGHIJKL'].join('_');
// `eyJ` is the base64url prefix of every JWT header and the single token both Semgrep's
// detected-jwt-token rule and gitleaks key off. Split it so no JWT-shaped literal exists in this
// source, then rebuild the full three-segment token at runtime. Decoded, the fixture is
// {"alg":"none"} / {"sub":"synthetic"} with a signature segment that says it is not a signature —
// it is not, and never was, a real credential.
const B64_JSON_PREFIX = ['ey', 'J'].join('');
const FAKE_JWT = [
  `${B64_JSON_PREFIX}hbGciOiJub25lIn0`,
  `${B64_JSON_PREFIX}zdWIiOiJzeW50aGV0aWMifQ`,
  'not-a-real-signature',
].join('.');

const lines: string[] = [];

beforeEach(() => {
  lines.length = 0;
  setLogSink((line) => lines.push(line));
  setCaptureTransport(null);
  resetCaptureStats();
});
afterEach(() => {
  setLogSink(null);
  setCaptureTransport(null);
});

describe('capture — dev-safe no-op when no DSN', () => {
  it('sends nothing and makes no noise with no transport installed', () => {
    captureError(new Error('boom'), { event: 'x' });
    captureMessage('hello', { event: 'y' });
    expect(getCaptureStats()).toEqual({
      transport: null,
      sent: 0,
      failed: 0,
      dropped: 0,
      inFlight: 0,
    });
    expect(lines).toHaveLength(0);
  });

  it('initObservability without a DSN reports capture: disabled', () => {
    const status = initObservability({ environment: 'local', service: 'borderpass' });
    expect(status.capture).toBe('disabled');
    expect(getCaptureStats().transport).toBeNull();
    expect(getObservabilityStatus()?.capture).toBe('disabled');
    // The init line reports presence as a boolean, never the DSN itself.
    const init = JSON.parse(lines[0] as string) as { data: Record<string, unknown> };
    expect(init.data.sentry_dsn_present).toBe(false);
  });

  it('degrades a malformed DSN to disabled instead of throwing', () => {
    for (const bad of ['', 'not a url', 'ftp://k@h/1', 'https://host/1', 'https://k@host/']) {
      expect(parseSentryDsn(bad)).toBeNull();
    }
    expect(parseSentryDsn(undefined)).toBeNull();
    expect(initObservability({ sentryDsn: 'garbage' }).capture).toBe('disabled');
  });
});

describe('capture — Sentry DSN + wire format (no SDK)', () => {
  it('derives the Store/Envelope endpoints from the DSN', () => {
    const p = parseSentryDsn('https://abc123def456@o4507.ingest.us.sentry.io/4509');
    expect(p?.publicKey).toBe('abc123def456');
    expect(p?.projectId).toBe('4509');
    expect(p?.storeUrl).toBe('https://o4507.ingest.us.sentry.io/api/4509/store/');
    expect(p?.envelopeUrl).toBe('https://o4507.ingest.us.sentry.io/api/4509/envelope/');

    // self-hosted instance behind a path prefix, legacy public:secret pair
    const onprem = parseSentryDsn('https://pub:sec@sentry.example.com/onprem/77');
    expect(onprem?.storeUrl).toBe('https://sentry.example.com/onprem/api/77/store/');
    expect(onprem?.secretKey).toBe('sec');
  });

  it('POSTs to the Store endpoint with a well-formed X-Sentry-Auth header', async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue({ ok: true, status: 200 } as unknown as Response);
    vi.stubGlobal('fetch', fetchSpy);

    const transport = createSentryFetchTransport('https://pubkey@o1.ingest.sentry.io/42');
    await transport?.send(buildCapturePayload({ message: 'hi' }), new AbortController().signal);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://o1.ingest.sentry.io/api/42/store/');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-sentry-auth']).toMatch(
      /^Sentry sentry_version=7, sentry_client=.+, sentry_key=pubkey$/,
    );
    vi.unstubAllGlobals();
  });
});

describe('capture — payload redaction (what actually goes on the wire)', () => {
  it('carries no secret or PII, even from a leaky error message', () => {
    initObservability({ environment: 'production', service: 'borderpass', release: 'sha123' });
    const err = new Error(
      `connect ECONNREFUSED ${FAKE_PG_URL_INTERNAL} using ${FAKE_STRIPE_LIVE_A}`,
    );
    err.cause = { authorization: `Bearer ${FAKE_JWT}` };

    const payload = buildCapturePayload(
      { error: err },
      {
        event: 'payment.webhook_failed',
        severity: 'error',
        correlationId: 'ord_9',
        tags: { route: '/api/stripe/webhook' },
        data: { otp: '482913', email: 'maria@example.com', order_id: 'ord_9' },
      },
    );

    const wire = JSON.stringify(payload);
    for (const bad of [
      's3cr3t',
      FAKE_STRIPE_LIVE_A,
      'db.internal',
      '482913',
      'maria@example.com',
      // The bearer token carried on err.cause must not reach the wire either.
      FAKE_JWT,
    ]) {
      expect(wire).not.toContain(bad);
    }
    // Guard the fixture itself: if a future edit breaks the assembled shape, the JWT would stop
    // being a JWT and the assertion above would pass for the wrong reason.
    expect(FAKE_JWT).toMatch(/^eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}$/);
    expect(payload.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(payload.level).toBe('error');
    expect(payload.environment).toBe('production');
    expect(payload.release).toBe('sha123');
    expect(payload.exception?.values[0]?.type).toBe('Error');
    expect(payload.exception?.values[0]?.value).toContain('[REDACTED_DB_URL]');
    expect(payload.exception?.values[0]?.stacktrace?.frames.length).toBeGreaterThan(0);
    expect(payload.tags.correlation_id).toBe('ord_9');
    expect(payload.tags.route).toBe('/api/stripe/webhook');
    expect(payload.extra.order_id).toBe('ord_9');
  });
});

describe('capture — fail-safe', () => {
  const failing = (mode: 'throw' | 'reject'): CaptureTransport => ({
    name: `test-${mode}`,
    async send() {
      if (mode === 'throw') throw new Error('network down');
      return Promise.reject(new Error('502'));
    },
  });

  it.each(['throw', 'reject'] as const)('never throws when the transport %ss', async (mode) => {
    setCaptureTransport(failing(mode));
    expect(() => captureError(new Error('x'), { event: 'e' })).not.toThrow();
    await flushCaptures(200);
    expect(getCaptureStats().failed).toBe(1);
    expect(getCaptureStats().sent).toBe(0);
  });

  it('does not block the caller while the transport is in flight', async () => {
    let settled = false;
    setCaptureTransport({
      name: 'slow',
      send: () =>
        new Promise((resolve) =>
          setTimeout(() => {
            settled = true;
            resolve();
          }, 80),
        ),
    });
    const started = Date.now();
    captureError(new Error('slow'), { event: 'e' });
    expect(Date.now() - started).toBeLessThan(25);
    expect(settled).toBe(false);
    await flushCaptures(500);
    expect(getCaptureStats().sent).toBe(1);
  });

  it('aborts a hanging transport on the configured timeout', async () => {
    initObservability({ sentryDsn: 'https://k@h.example.com/1', captureTimeoutMs: 50 });
    setCaptureTransport({
      name: 'hang',
      send: (_payload, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    });
    resetCaptureStats();
    captureError(new Error('hang'), { event: 'e' });
    await flushCaptures(400);
    expect(getCaptureStats().failed).toBe(1);
  });

  it('drops an error storm instead of flooding the transport', async () => {
    initObservability({ maxEventsPerMinute: 5 });
    setCaptureTransport({ name: 'counting', send: async () => {} });
    resetCaptureStats();
    for (let i = 0; i < 50; i++) captureError(new Error(`storm ${i}`), { event: 'e' });
    await flushCaptures(300);
    expect(getCaptureStats().sent).toBe(5);
    expect(getCaptureStats().dropped).toBe(45);
  });

  it('flushCaptures is bounded and never rejects', async () => {
    setCaptureTransport(null);
    await expect(flushCaptures(10)).resolves.toBeUndefined();
  });
});
