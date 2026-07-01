import { describe, it, expect } from 'vitest';
import { paymentStatusCopy, paymentStatusLabel, PAID_TITLE } from './copy';
import type { PaymentDisplayState } from './display';

const ALL: PaymentDisplayState[] = ['none', 'ready_to_pay', 'processing', 'requires_action', 'succeeded', 'failed', 'canceled'];

describe('paymentStatusCopy', () => {
  it('returns non-empty title + body for every state', () => {
    for (const st of ALL) {
      const c = paymentStatusCopy(st);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.body.length).toBeGreaterThan(0);
    }
  });

  it('INVARIANT: only succeeded uses the paid/confirmed title', () => {
    expect(paymentStatusCopy('succeeded').title).toBe(PAID_TITLE);
    for (const st of ALL.filter((s) => s !== 'succeeded'))
      expect(paymentStatusCopy(st).title).not.toBe(PAID_TITLE);
  });

  it('processing copy reassures without claiming completion', () => {
    const body = paymentStatusCopy('processing').body.toLowerCase();
    expect(body).toContain('moment');
    expect(body).not.toContain('paid');
  });
});

describe('paymentStatusLabel', () => {
  it('gives a short label for every state; only succeeded is "Paid"', () => {
    for (const st of ALL) expect(paymentStatusLabel(st).length).toBeGreaterThan(0);
    expect(paymentStatusLabel('succeeded')).toBe('Paid');
    for (const st of ALL.filter((s) => s !== 'succeeded')) expect(paymentStatusLabel(st)).not.toBe('Paid');
    expect(paymentStatusLabel('ready_to_pay')).toBe('Awaiting payment');
    expect(paymentStatusLabel('requires_action')).toBe('Action required');
  });
});
