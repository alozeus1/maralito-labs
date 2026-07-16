import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyResendWebhook } from './resend-webhook';

// Build a valid Svix signature the same way Resend does, so we can assert accept/reject paths.
const SECRET = 'whsec_' + Buffer.from('deadbeefdeadbeefdeadbeefdeadbeef').toString('base64');
function sign(id: string, ts: string, payload: string): string {
  const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${ts}.${payload}`).digest('base64');
  return `v1,${sig}`;
}

const NOW_MS = 1_700_000_000_000;
const TS = String(Math.floor(NOW_MS / 1000));
const PAYLOAD = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });

describe('verifyResendWebhook', () => {
  it('accepts a valid, in-tolerance signature', () => {
    const headers = { id: 'msg_1', timestamp: TS, signature: sign('msg_1', TS, PAYLOAD) };
    expect(verifyResendWebhook(PAYLOAD, headers, SECRET, NOW_MS)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const headers = { id: 'msg_1', timestamp: TS, signature: sign('msg_1', TS, PAYLOAD) };
    expect(verifyResendWebhook(PAYLOAD + 'x', headers, SECRET, NOW_MS)).toBe(false);
  });

  it('rejects an out-of-tolerance timestamp (replay)', () => {
    const headers = { id: 'msg_1', timestamp: TS, signature: sign('msg_1', TS, PAYLOAD) };
    // now is 10 minutes after the signed timestamp → beyond the 5-minute window.
    expect(verifyResendWebhook(PAYLOAD, headers, SECRET, NOW_MS + 600_000)).toBe(false);
  });

  it('rejects missing headers or secret', () => {
    const good = sign('msg_1', TS, PAYLOAD);
    expect(
      verifyResendWebhook(PAYLOAD, { id: null, timestamp: TS, signature: good }, SECRET, NOW_MS),
    ).toBe(false);
    expect(
      verifyResendWebhook(PAYLOAD, { id: 'msg_1', timestamp: TS, signature: good }, '', NOW_MS),
    ).toBe(false);
  });

  it('accepts when one of several space-separated signatures matches (rotation)', () => {
    const good = sign('msg_1', TS, PAYLOAD).split(',')[1];
    const headers = { id: 'msg_1', timestamp: TS, signature: `v1,AAAA v1,${good}` };
    expect(verifyResendWebhook(PAYLOAD, headers, SECRET, NOW_MS)).toBe(true);
  });
});
