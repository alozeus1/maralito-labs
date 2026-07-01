import { describe, it, expect } from 'vitest';
import {
  toPaymentDisplayState, shouldShowPaymentForm, shouldPollPaymentStatus,
  isSettledDisplayState, canRetryPayment, isPaidView, type PaymentDisplayState,
} from './display';
import type { PaymentStatus } from './state-machine';
import type { OrderStatus } from '@/domain/orders/state-machine';

const ALL_DISPLAY: PaymentDisplayState[] = ['none', 'ready_to_pay', 'processing', 'requires_action', 'succeeded', 'failed', 'canceled'];

describe('toPaymentDisplayState', () => {
  it('order awaiting_payment + no payment → ready_to_pay', () =>
    expect(toPaymentDisplayState(null, 'awaiting_payment')).toBe('ready_to_pay'));

  it('order awaiting_payment + requires_payment → ready_to_pay', () =>
    expect(toPaymentDisplayState('requires_payment', 'awaiting_payment')).toBe('ready_to_pay'));

  it('maps in-flight payment statuses while awaiting_payment', () => {
    expect(toPaymentDisplayState('processing', 'awaiting_payment')).toBe('processing');
    expect(toPaymentDisplayState('requires_action', 'awaiting_payment')).toBe('requires_action');
    expect(toPaymentDisplayState('failed', 'awaiting_payment')).toBe('failed');
    expect(toPaymentDisplayState('canceled', 'awaiting_payment')).toBe('canceled');
  });

  it('succeeded payment shows success even before the order cascade lands', () =>
    expect(toPaymentDisplayState('succeeded', 'awaiting_payment')).toBe('succeeded'));

  it('order at/beyond paid → succeeded regardless of payment row', () => {
    for (const os of ['paid', 'purchasing', 'delivered', 'refunded'] as OrderStatus[])
      expect(toPaymentDisplayState(null, os)).toBe('succeeded');
    expect(toPaymentDisplayState('succeeded', 'paid')).toBe('succeeded');
  });

  it('pre-payment order states (not awaiting_payment) → none', () => {
    for (const os of ['draft', 'submitted', 'under_review', 'quote_ready'] as OrderStatus[])
      expect(toPaymentDisplayState(null, os)).toBe('none');
  });

  it('terminal non-paid order states → canceled', () => {
    expect(toPaymentDisplayState(null, 'cancelled')).toBe('canceled');
    expect(toPaymentDisplayState(null, 'rejected')).toBe('canceled');
  });

  it('INVARIANT: never returns succeeded for failed/canceled/requires_action while awaiting_payment', () => {
    for (const ps of ['failed', 'canceled', 'requires_action', 'processing', 'requires_payment'] as PaymentStatus[])
      expect(toPaymentDisplayState(ps, 'awaiting_payment')).not.toBe('succeeded');
  });
});

describe('shouldShowPaymentForm', () => {
  it('shows the form only for ready_to_pay and requires_action', () => {
    expect(shouldShowPaymentForm('ready_to_pay')).toBe(true);
    expect(shouldShowPaymentForm('requires_action')).toBe(true);
    for (const st of ['none', 'processing', 'succeeded', 'failed', 'canceled'] as const)
      expect(shouldShowPaymentForm(st)).toBe(false);
  });
});

describe('5.4 flow helpers', () => {
  it('polls only while processing', () => {
    expect(shouldPollPaymentStatus('processing')).toBe(true);
    for (const st of ALL_DISPLAY.filter((s) => s !== 'processing')) expect(shouldPollPaymentStatus(st)).toBe(false);
  });
  it('settled states are succeeded/failed/canceled/none', () => {
    for (const st of ['succeeded', 'failed', 'canceled', 'none'] as PaymentDisplayState[]) expect(isSettledDisplayState(st)).toBe(true);
    for (const st of ['ready_to_pay', 'processing', 'requires_action'] as PaymentDisplayState[]) expect(isSettledDisplayState(st)).toBe(false);
  });
  it('retry only for failed or ready_to_pay', () => {
    expect(canRetryPayment('failed')).toBe(true);
    expect(canRetryPayment('ready_to_pay')).toBe(true);
    for (const st of ['none', 'processing', 'requires_action', 'succeeded', 'canceled'] as PaymentDisplayState[]) expect(canRetryPayment(st)).toBe(false);
  });
  it('INVARIANT: the paid/success view renders ONLY for succeeded', () => {
    expect(isPaidView('succeeded')).toBe(true);
    for (const st of ALL_DISPLAY.filter((s) => s !== 'succeeded')) expect(isPaidView(st)).toBe(false);
  });
});
