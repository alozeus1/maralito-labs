import { describe, it, expect } from 'vitest';
import {
  assertTransition,
  isLegalTransition,
  isTerminal,
  IllegalTransitionError,
  ORDER_STATUSES,
} from './state-machine';
import { submitMissingFields, orderRef } from './rules';

describe('order state machine', () => {
  it('has 25 statuses', () => expect(ORDER_STATUSES).toHaveLength(25));
  it('legal transitions', () => {
    expect(isLegalTransition('draft', 'submitted')).toBe(true);
    expect(isLegalTransition('under_review', 'quote_ready')).toBe(true);
    expect(isLegalTransition('out_for_delivery', 'delivered')).toBe(true);
  });
  it('illegal transition throws', () =>
    expect(() => assertTransition('draft', 'delivered')).toThrow(IllegalTransitionError));
  it('terminal states have no exits', () => {
    expect(isTerminal('delivered')).toBe(true);
    expect(isLegalTransition('cancelled', 'submitted')).toBe(false);
  });
});
describe('submit rules', () => {
  it('flags missing fields on empty draft', () => {
    const m = submitMissingFields({ status: 'draft', serviceType: 'buy_for_me', itemCount: 0 });
    expect(m).toEqual(
      expect.arrayContaining(['items', 'purpose', 'declared_value', 'delivery_address']),
    );
  });
  it('passes a complete buy-for-me draft', () =>
    expect(
      submitMissingFields({
        status: 'draft',
        serviceType: 'buy_for_me',
        itemCount: 1,
        purpose: 'personal',
        declaredValue: { amount_minor: 1500, currency: 'USD' },
        deliveryAddressId: 'addr_1',
      }),
    ).toHaveLength(0));
  it('orderRef format BP-####', () => expect(orderRef()).toMatch(/^BP-\d{4}$/));
});
