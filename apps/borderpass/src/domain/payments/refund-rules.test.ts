import { describe, it, expect } from 'vitest';
import { canInitiateRefund, paymentRefundCascadeTarget } from './refund-rules';

describe('refund rules (Phase 8D, ADR-0015)', () => {
  it('allows a full refund on a succeeded payment', () => {
    const r = canInitiateRefund({ paymentStatus: 'succeeded', paymentAmountMinor: 10000, alreadyRefundedMinor: 0, requestedMinor: 10000 });
    expect(r.ok && r.kind).toBe('full');
  });
  it('allows a partial refund', () => {
    const r = canInitiateRefund({ paymentStatus: 'succeeded', paymentAmountMinor: 10000, alreadyRefundedMinor: 0, requestedMinor: 4000 });
    expect(r.ok && r.kind).toBe('partial');
  });
  it('allows a further refund on a partially_refunded payment', () => {
    const r = canInitiateRefund({ paymentStatus: 'partially_refunded', paymentAmountMinor: 10000, alreadyRefundedMinor: 4000, requestedMinor: 6000 });
    expect(r.ok && r.kind).toBe('full');
  });
  it('rejects over-refund, zero/negative, and non-refundable payment', () => {
    expect(canInitiateRefund({ paymentStatus: 'succeeded', paymentAmountMinor: 10000, alreadyRefundedMinor: 7000, requestedMinor: 4000 })).toEqual({ ok: false, code: 'exceeds_remaining' });
    expect(canInitiateRefund({ paymentStatus: 'succeeded', paymentAmountMinor: 10000, alreadyRefundedMinor: 0, requestedMinor: 0 })).toEqual({ ok: false, code: 'invalid_amount' });
    expect(canInitiateRefund({ paymentStatus: 'failed', paymentAmountMinor: 10000, alreadyRefundedMinor: 0, requestedMinor: 100 })).toEqual({ ok: false, code: 'payment_not_refundable' });
  });
  it('cascade target: full → refunded, partial → partially_refunded, zero → null', () => {
    expect(paymentRefundCascadeTarget('succeeded', 10000, 10000)).toBe('refunded');
    expect(paymentRefundCascadeTarget('succeeded', 4000, 10000)).toBe('partially_refunded');
    expect(paymentRefundCascadeTarget('succeeded', 0, 10000)).toBeNull();
  });
});
