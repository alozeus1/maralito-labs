import { describe, it, expect } from 'vitest';
import {
  canTransitionQuoteStatus,
  getNextAllowedQuoteStatuses,
  isTerminalQuoteStatus,
  getCustomerVisibleQuoteStatus,
  canEditQuote,
  canCustomerAcceptQuote,
  canCustomerDeclineQuote,
  assertQuoteTransition,
  IllegalQuoteTransitionError,
  QUOTE_STATUSES,
} from './state-machine';
import { calculateQuoteTotals } from './totals';
import { requiresFinanceApproval } from './config';
import { isLegalTransition } from '../orders/state-machine';

describe('quote state machine', () => {
  it('9 statuses', () => expect(QUOTE_STATUSES).toHaveLength(9));
  it('only staff submits; only finance approves', () => {
    expect(canTransitionQuoteStatus('draft', 'pending_finance_approval', 'concierge')).toBe(true);
    expect(canTransitionQuoteStatus('draft', 'pending_finance_approval', 'customer')).toBe(false);
    expect(canTransitionQuoteStatus('pending_finance_approval', 'approved', 'finance_admin')).toBe(
      true,
    );
    expect(canTransitionQuoteStatus('pending_finance_approval', 'approved', 'concierge')).toBe(
      false,
    );
  });
  it('only customer accepts/declines a sent quote', () => {
    expect(canTransitionQuoteStatus('sent_to_customer', 'accepted', 'customer')).toBe(true);
    expect(canTransitionQuoteStatus('sent_to_customer', 'accepted', 'finance_admin')).toBe(false);
  });
  it('illegal transition throws', () =>
    expect(() => assertQuoteTransition('draft', 'accepted', 'customer')).toThrow(
      IllegalQuoteTransitionError,
    ));
  it('auto-approve: system may move draft→approved (no finance needed); customer/staff may not', () => {
    expect(canTransitionQuoteStatus('draft', 'approved', 'system')).toBe(true); // B1 fix
    expect(canTransitionQuoteStatus('draft', 'approved', 'finance_admin')).toBe(true);
    expect(canTransitionQuoteStatus('draft', 'approved', 'concierge')).toBe(false);
    expect(canTransitionQuoteStatus('draft', 'approved', 'customer')).toBe(false);
  });
  it('multi-role finance: the finance role (not positional roles[0]) satisfies pending→approved', () => {
    // Simulates a user holding ['concierge','finance_admin']: the finance role must be the one passed.
    expect(canTransitionQuoteStatus('pending_finance_approval', 'approved', 'concierge')).toBe(
      false,
    );
    expect(canTransitionQuoteStatus('pending_finance_approval', 'approved', 'finance_admin')).toBe(
      true,
    );
  });
  it('helpers', () => {
    expect(isTerminalQuoteStatus('accepted')).toBe(true);
    expect(getCustomerVisibleQuoteStatus('pending_finance_approval')).toBe('preparing');
    expect(getCustomerVisibleQuoteStatus('sent_to_customer')).toBe('quote_ready');
    expect(canEditQuote('draft', 'finance_admin')).toBe(true);
    expect(canEditQuote('sent_to_customer', 'finance_admin')).toBe(false);
    expect(canCustomerAcceptQuote('sent_to_customer', null)).toBe(true);
    expect(canCustomerAcceptQuote('sent_to_customer', new Date(Date.now() - 1000))).toBe(false);
    expect(canCustomerAcceptQuote('draft', null)).toBe(false);
    expect(canCustomerDeclineQuote('sent_to_customer')).toBe(true);
    expect(getNextAllowedQuoteStatuses('approved', 'concierge')).toContain('sent_to_customer');
  });
});
describe('order-integration cascade targets are legal order transitions', () => {
  it('quote sent → order under_review→quote_ready', () =>
    expect(isLegalTransition('under_review', 'quote_ready')).toBe(true));
  it('quote accepted → order quote_ready→awaiting_payment', () =>
    expect(isLegalTransition('quote_ready', 'awaiting_payment')).toBe(true));
});
describe('quote totals (integer minor units)', () => {
  it('sums customer-visible chargeable lines; category subtotals', () => {
    const t = calculateQuoteTotals([
      {
        kind: 'product_cost',
        total_amount_minor: 10000,
        currency: 'USD',
        customer_visible: true,
        internal_only: false,
      },
      {
        kind: 'service_fee',
        total_amount_minor: 1500,
        currency: 'USD',
        customer_visible: true,
        internal_only: false,
      },
      {
        kind: 'discount',
        total_amount_minor: -500,
        currency: 'USD',
        customer_visible: true,
        internal_only: false,
      },
      {
        kind: 'adjustment',
        total_amount_minor: 999,
        currency: 'USD',
        customer_visible: false,
        internal_only: true,
      },
    ]);
    expect(t.subtotal_minor).toBe(10000);
    expect(t.discount_minor).toBe(-500);
    expect(t.total_minor).toBe(11000);
  });
  it('rejects mixed currency + negative non-discount', () => {
    expect(() =>
      calculateQuoteTotals([
        {
          kind: 'product_cost',
          total_amount_minor: 1,
          currency: 'USD',
          customer_visible: true,
          internal_only: false,
        },
        {
          kind: 'service_fee',
          total_amount_minor: 1,
          currency: 'MXN',
          customer_visible: true,
          internal_only: false,
        },
      ]),
    ).toThrow();
    expect(() =>
      calculateQuoteTotals([
        {
          kind: 'product_cost',
          total_amount_minor: -1,
          currency: 'USD',
          customer_visible: true,
          internal_only: false,
        },
      ]),
    ).toThrow();
  });
});
describe('finance approval', () => {
  it('triggers on threshold/discount/business/flag', () => {
    expect(
      requiresFinanceApproval({
        total_minor: 5000,
        discount_minor: 0,
        has_manual_adjustment: false,
        service_type: 'buy_for_me',
        marked_requires_approval: false,
      }),
    ).toBe(false);
    expect(
      requiresFinanceApproval({
        total_minor: 200000,
        discount_minor: 0,
        has_manual_adjustment: false,
        service_type: 'buy_for_me',
        marked_requires_approval: false,
      }),
    ).toBe(true);
    expect(
      requiresFinanceApproval({
        total_minor: 100,
        discount_minor: 0,
        has_manual_adjustment: true,
        service_type: 'buy_for_me',
        marked_requires_approval: false,
      }),
    ).toBe(true);
    expect(
      requiresFinanceApproval({
        total_minor: 100,
        discount_minor: 0,
        has_manual_adjustment: false,
        service_type: 'business_delivery',
        marked_requires_approval: false,
      }),
    ).toBe(true);
  });
});
