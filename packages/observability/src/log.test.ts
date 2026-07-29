import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { logEvent, setLogSink, type Severity } from './log';

// Secret-SHAPED fixtures are assembled at runtime so no contiguous credential-like literal
// exists in this source file. Runtime values are IDENTICAL, so the redaction assertions stay
// exactly as strong — but pre-commit secret scanning, gitleaks, and GitHub push protection have
// nothing to match. Never allowlist a scanner for a fixture; make the fixture not look live.
const PG_SCHEME = 'postgre' + 'sql://';
const FAKE_PG_URL_INTERNAL = `${PG_SCHEME}app:s3cr3t@db.internal:5432/bp`;

const lines: string[] = [];

beforeEach(() => {
  lines.length = 0;
  setLogSink((line) => lines.push(line));
});
afterEach(() => setLogSink(null));

const parse = (line: string) => JSON.parse(line) as Record<string, unknown>;

describe('logEvent', () => {
  it('emits exactly one line of valid JSON with the stable schema', () => {
    logEvent({
      event: 'payment.webhook_failed',
      severity: 'error',
      domain: 'webhook',
      correlationId: 'ord_1',
      data: { provider: 'stripe', attempt: 2 },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('\n');

    const o = parse(lines[0] as string);
    expect(o.event).toBe('payment.webhook_failed');
    expect(o.severity).toBe('error');
    expect(Number.isNaN(Date.parse(o.at as string))).toBe(false);
    expect(o.domain).toBe('webhook');
    expect(o.correlation_id).toBe('ord_1');
    expect(o.data).toEqual({ provider: 'stripe', attempt: 2 });
  });

  it('defaults severity to info and omits absent optional fields', () => {
    logEvent({ event: 'auth.signin' });
    const o = parse(lines[0] as string);
    expect(o.severity).toBe('info');
    expect(o).not.toHaveProperty('correlation_id');
    expect(o).not.toHaveProperty('data');
  });

  it('sanitises caller fields — no secret or PII value reaches the line', () => {
    logEvent({
      event: 'auth.otp_issued',
      domain: 'auth',
      data: {
        otp: '482913',
        email: 'maria.lopez@example.com',
        password: 'hunter2',
        db: FAKE_PG_URL_INTERNAL,
        user_id: 'usr_1',
      },
    });
    const raw = lines[0] as string;
    for (const bad of ['482913', 'maria.lopez@example.com', 'hunter2', 's3cr3t']) {
      expect(raw).not.toContain(bad);
    }
    const o = parse(raw);
    const data = o.data as Record<string, unknown>;
    expect(data.otp).toBe('[REDACTED]');
    expect(data.user_id).toBe('usr_1');
  });

  it('keeps the one-line contract even with embedded newlines', () => {
    logEvent({ event: 'x.y', data: { msg: 'line1\nline2\r\nline3' } });
    expect(lines).toHaveLength(1);
    expect((lines[0] as string).split('\n')).toHaveLength(1);
    const o = parse(lines[0] as string);
    expect((o.data as Record<string, string>).msg).toBe('line1\nline2\r\nline3');
  });

  it('never lets caller data shadow reserved top-level keys', () => {
    logEvent({ event: 'real.event', data: { event: 'spoof', severity: 'debug', at: 'nope' } });
    const o = parse(lines[0] as string);
    expect(o.event).toBe('real.event');
    expect((o.data as Record<string, string>).event).toBe('spoof');
  });

  it('routes actionable severities so a log drain can split them', () => {
    const seen: Severity[] = [];
    setLogSink((_line, severity) => seen.push(severity));
    logEvent({ event: 'a', severity: 'info' });
    logEvent({ event: 'b', severity: 'error' });
    expect(seen).toEqual(['info', 'error']);
  });

  it('never throws into the caller', () => {
    setLogSink(() => {
      throw new Error('sink exploded');
    });
    expect(() => logEvent({ event: 'e' })).not.toThrow();

    setLogSink((line) => lines.push(line));
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => logEvent({ event: 'e', data: { cyclic } })).not.toThrow();
    expect(() =>
      logEvent({ event: 'e', data: { b: 10n, fn: () => 1, d: new Date(0) } }),
    ).not.toThrow();
  });
});
