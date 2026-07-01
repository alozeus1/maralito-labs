import { describe, it, expect } from 'vitest';
import { OrderCreate, OrderItemInput, OrderSubmit } from './index';

describe('order schemas', () => {
  it('OrderItemInput requires qty>=1 + Money', () => {
    expect(() =>
      OrderItemInput.parse({
        description: 'x',
        quantity: 0,
        unit_value: { amount_minor: 1, currency: 'USD' },
      }),
    ).toThrow();
    expect(
      OrderItemInput.parse({
        description: 'x',
        quantity: 2,
        unit_value: { amount_minor: 100, currency: 'USD' },
      }).quantity,
    ).toBe(2);
  });
  it('OrderCreate validates service_type', () => {
    expect(() => OrderCreate.parse({ service_type: 'nope' })).toThrow();
    expect(OrderCreate.parse({ service_type: 'buy_for_me' }).service_type).toBe('buy_for_me');
  });
  it('OrderSubmit needs ord_ id', () => {
    expect(() => OrderSubmit.parse({ order_id: 'x' })).toThrow();
    expect(OrderSubmit.parse({ order_id: 'ord_1' }).order_id).toBe('ord_1');
  });
});
