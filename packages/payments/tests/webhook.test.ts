/**
 * Offline webhook signature verification test (ADR-0010). Uses Stripe's generateTestHeaderString to
 * sign payloads locally — NO live Stripe account or network required.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import Stripe from 'stripe';
import { verifyStripeWebhook } from '../src/stripe/webhook';
import { __resetStripeClientForTests } from '../src/stripe/client';

const WEBHOOK_SECRET = 'whsec_test_secret_123';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_123';
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  __resetStripeClientForTests();
});

function sign(payload: string): string {
  const stripe = new Stripe('sk_test_dummy_123');
  return stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
}

describe('verifyStripeWebhook (fail closed)', () => {
  it('accepts a correctly signed payload and returns the event', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
    const event = verifyStripeWebhook(payload, sign(payload));
    expect(event.id).toBe('evt_1');
    expect(event.type).toBe('payment_intent.succeeded');
  });

  it('rejects a garbage / forged signature header', () => {
    const payload = JSON.stringify({ id: 'evt_2', type: 'payment_intent.succeeded' });
    expect(() => verifyStripeWebhook(payload, 't=123,v1=deadbeef')).toThrow();
  });

  it('rejects when the payload is altered after signing', () => {
    const header = sign(JSON.stringify({ id: 'evt_3' }));
    expect(() => verifyStripeWebhook(JSON.stringify({ id: 'evt_3_tampered' }), header)).toThrow();
  });
});
