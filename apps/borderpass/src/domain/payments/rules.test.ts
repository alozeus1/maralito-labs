import { describe, it, expect } from 'vitest';
import { canInitiatePayment, orderPaidCascadeTarget } from './rules';
import type { PaymentStatus } from './state-machine';

describe('canInitiatePayment', () => {
  it('allows an accepted quote whose order is awaiting_payment with a positive total', () =>
    expect(canInitiatePayment({ quoteStatus: 'accepted', orderStatus: 'awaiting_payment', totalMinor: 10000 })).toEqual({ ok: true }));

  it('rejects a non-accepted quote', () =>
    expect(canInitiatePayment({ quoteStatus: 'sent_to_customer', orderStatus: 'awaiting_payment', totalMinor: 10000 }))
      .toEqual({ ok: false, code: 'quote_not_accepted' }));

  it('rejects when the order is not awaiting_payment', () =>
    expect(canInitiatePayment({ quoteStatus: 'accepted', orderStatus: 'quote_ready', totalMinor: 10000 }))
      .toEqual({ ok: false, code: 'order_not_awaiting_payment' }));

  it('rejects a zero / missing amount', () => {
    expect(canInitiatePayment({ quoteStatus: 'accepted', orderStatus: 'awaiting_payment', totalMinor: 0 })).toEqual({ ok: false, code: 'invalid_amount' });
    expect(canInitiatePayment({ quoteStatus: 'accepted', orderStatus: 'awaiting_payment', totalMinor: null })).toEqual({ ok: false, code: 'invalid_amount' });
  });
});

describe('orderPaidCascadeTarget — only succeeded marks paid', () => {
  it('succeeded + awaiting_payment → paid', () =>
    expect(orderPaidCascadeTarget('succeeded', 'awaiting_payment')).toBe('paid'));

  it('succeeded but order NOT awaiting_payment → null (idempotent no-op)', () => {
    expect(orderPaidCascadeTarget('succeeded', 'paid')).toBeNull();
    expect(orderPaidCascadeTarget('succeeded', 'quote_ready')).toBeNull();
  });

  it('failed / canceled / requires_action / processing NEVER mark paid', () => {
    for (const s of ['failed', 'canceled', 'requires_action', 'processing', 'requires_payment', 'refunded_placeholder'] as PaymentStatus[])
      expect(orderPaidCascadeTarget(s, 'awaiting_payment')).toBeNull();
  });
});
