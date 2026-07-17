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
  it('has 9 statuses (7 core + Phase 8D partially_refunded/refunded)', () =>
    expect(PAYMENT_STATUSES).toHaveLength(9));

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
      // Phase 8D refund cascade (ADR-0015).
      ['succeeded', 'partially_refunded'],
      ['succeeded', 'refunded'],
      ['partially_refunded', 'partially_refunded'],
      ['partially_refunded', 'refunded'],
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
      'partially_refunded',
      'refunded',
    ] as PaymentStatus[])
      expect(paymentSucceeds(s)).toBe(false);
  });

  it('terminals are canceled + refunded + refunded_placeholder', () => {
    expect(isTerminalPaymentStatus('canceled')).toBe(true);
    expect(isTerminalPaymentStatus('refunded')).toBe(true);
    expect(isTerminalPaymentStatus('refunded_placeholder')).toBe(true);
    expect(getNextAllowedPaymentStatuses('canceled')).toHaveLength(0);
    expect(getNextAllowedPaymentStatuses('refunded')).toHaveLength(0);
    // partially_refunded is NOT terminal — further partials or a full refund may follow.
    expect(isTerminalPaymentStatus('partially_refunded')).toBe(false);
  });
});
