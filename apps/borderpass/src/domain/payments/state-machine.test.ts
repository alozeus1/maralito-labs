import { describe, it, expect } from 'vitest';
import {
  PAYMENT_STATUSES,
  isLegalPaymentTransition,
  assertPaymentTransition,
  IllegalPaymentTransitionError,
  isTerminalPaymentStatus,
  paymentSucceeds,
  getNextAllowedPaymentStatuses,
  type PaymentStatus,
} from './state-machine';

describe('payment state machine', () => {
  it('has 7 statuses', () => expect(PAYMENT_STATUSES).toHaveLength(7));

  it('allows the spec-legal transitions (incl. Stripe card paths with no `processing` event)', () => {
    const legal: [PaymentStatus, PaymentStatus][] = [
      // Standard cards: requires_payment → succeeded/failed directly (no `processing` event emitted).
      ['requires_payment', 'processing'],
      ['requires_payment', 'requires_action'],
      ['requires_payment', 'succeeded'],
      ['requires_payment', 'failed'],
      ['requires_payment', 'canceled'],
      ['processing', 'succeeded'],
      ['processing', 'failed'],
      ['processing', 'requires_action'],
      ['processing', 'canceled'],
      // 3DS: requires_action → succeeded/failed/canceled (and back to processing).
      ['requires_action', 'processing'],
      ['requires_action', 'succeeded'],
      ['requires_action', 'failed'],
      ['requires_action', 'canceled'],
      ['failed', 'requires_payment'],
      ['succeeded', 'refunded_placeholder'],
    ];
    for (const [f, t] of legal) expect(isLegalPaymentTransition(f, t)).toBe(true);
  });

  it('rejects illegal state changes (no resurrection from terminal/settled states)', () => {
    const illegal: [PaymentStatus, PaymentStatus][] = [
      ['failed', 'succeeded'],
      ['canceled', 'succeeded'],
      ['refunded_placeholder', 'succeeded'],
      ['canceled', 'processing'],
      ['canceled', 'requires_payment'],
      ['succeeded', 'processing'],
      ['succeeded', 'failed'],
      ['processing', 'requires_payment'],
    ];
    for (const [f, t] of illegal) expect(isLegalPaymentTransition(f, t)).toBe(false);
  });

  it('assertPaymentTransition throws on illegal', () =>
    expect(() => assertPaymentTransition('failed', 'succeeded')).toThrow(
      IllegalPaymentTransitionError,
    ));

  it('paymentSucceeds is true only for succeeded', () => {
    expect(paymentSucceeds('succeeded')).toBe(true);
    for (const s of [
      'requires_payment',
      'processing',
      'requires_action',
      'failed',
      'canceled',
      'refunded_placeholder',
    ] as PaymentStatus[])
      expect(paymentSucceeds(s)).toBe(false);
  });

  it('terminals are canceled + refunded_placeholder', () => {
    expect(isTerminalPaymentStatus('canceled')).toBe(true);
    expect(isTerminalPaymentStatus('refunded_placeholder')).toBe(true);
    expect(getNextAllowedPaymentStatuses('canceled')).toHaveLength(0);
  });
});
