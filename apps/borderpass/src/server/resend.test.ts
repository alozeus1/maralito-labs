import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendEmail, isResendConfigured, isDeliveryEnabled } from './resend';

// These env keys are set/cleared per test; snapshot + restore so tests don't leak into each other.
const KEYS = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'EMAIL_FROM_DEFAULT',
  'EMAIL_FROM_ORDERS',
  'EMAIL_REPLY_TO',
  'EMAIL_DELIVERY_ENABLED',
  'EMAIL_SAFE_RECIPIENT',
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  KEYS.forEach((k) => delete process.env[k]);
});
afterEach(() => {
  KEYS.forEach((k) => {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  });
  vi.unstubAllGlobals();
});

describe('config + delivery gate', () => {
  it('isResendConfigured requires a key and a From', () => {
    expect(isResendConfigured()).toBe(false);
    process.env.RESEND_API_KEY = 're_test';
    expect(isResendConfigured()).toBe(false);
    process.env.EMAIL_FROM_DEFAULT = 'BorderPass <notifications@notifications.maralito.uk>';
    expect(isResendConfigured()).toBe(true);
  });

  it('isDeliveryEnabled is true unless explicitly "false"', () => {
    expect(isDeliveryEnabled()).toBe(true);
    process.env.EMAIL_DELIVERY_ENABLED = 'false';
    expect(isDeliveryEnabled()).toBe(false);
    process.env.EMAIL_DELIVERY_ENABLED = 'true';
    expect(isDeliveryEnabled()).toBe(true);
  });

  it('does not send (or fetch) when unconfigured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await sendEmail({ to: 'x@example.com', subject: 's', html: '<p>h</p>' });
    expect(r).toEqual({ ok: false, error: 'resend_not_configured', retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send (or fetch) when delivery is disabled', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM_DEFAULT = 'BorderPass <notifications@notifications.maralito.uk>';
    process.env.EMAIL_DELIVERY_ENABLED = 'false';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await sendEmail({ to: 'x@example.com', subject: 's', html: '<p>h</p>' });
    expect(r).toEqual({ ok: false, error: 'delivery_disabled', retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('send payload', () => {
  function stubOk() {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: 're_123' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('uses the kind-specific verified From, adds text + reply-to + tags, returns the id', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM_DEFAULT = 'BorderPass <notifications@notifications.maralito.uk>';
    process.env.EMAIL_FROM_ORDERS = 'BorderPass Orders <orders@notifications.maralito.uk>';
    process.env.EMAIL_REPLY_TO = 'support@maralito.uk';
    const fetchMock = stubOk();

    const r = await sendEmail({
      to: 'customer@example.com',
      subject: 'Your order',
      html: '<p>Hi</p><p><a href="https://borderpass.example/x">Link</a></p>',
      kind: 'orders',
    });

    expect(r).toEqual({ ok: true, id: 're_123' });
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    );
    expect(body.from).toBe('BorderPass Orders <orders@notifications.maralito.uk>');
    expect(body.reply_to).toBe('support@maralito.uk');
    expect(typeof body.text).toBe('string');
    expect(body.text).toContain('Link (https://borderpass.example/x)'); // html→text fallback
    expect(body.tags).toEqual(
      expect.arrayContaining([
        { name: 'application', value: 'borderpass' },
        { name: 'kind', value: 'orders' },
      ]),
    );
  });

  it('redirects every recipient to EMAIL_SAFE_RECIPIENT when set (preview safety)', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM_DEFAULT = 'BorderPass <notifications@notifications.maralito.uk>';
    process.env.EMAIL_SAFE_RECIPIENT = 'safe@internal.test';
    const fetchMock = stubOk();

    await sendEmail({ to: 'real-customer@example.com', subject: 's', html: '<p>h</p>' });
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    );
    expect(body.to).toBe('safe@internal.test');
  });
});
