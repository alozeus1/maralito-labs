import { describe, it, expect } from 'vitest';
import { orderJourney } from './journey';

const stateOf = (status: string, key: string) =>
  orderJourney(status).milestones.find((m) => m.key === key)?.state;

describe('orderJourney', () => {
  it('marks earlier stages done, the matched stage current, later upcoming (happy path)', () => {
    const j = orderJourney('border_crossing');
    expect(stateOf('border_crossing', 'placed')).toBe('done');
    expect(stateOf('border_crossing', 'inspection')).toBe('done');
    expect(stateOf('border_crossing', 'crossing')).toBe('current');
    expect(stateOf('border_crossing', 'customs')).toBe('upcoming');
    expect(stateOf('border_crossing', 'delivered')).toBe('upcoming');
    expect(j.halted).toBeUndefined();
  });

  it('treats delivered as fully complete (no "current" stage)', () => {
    const j = orderJourney('delivered');
    expect(j.milestones.every((m) => m.state === 'done')).toBe(true);
    expect(j.milestones.some((m) => m.state === 'current')).toBe(false);
  });

  it('draft has reached nothing yet', () => {
    const j = orderJourney('draft');
    expect(j.milestones.every((m) => m.state === 'upcoming')).toBe(true);
    expect(j.halted).toBeUndefined();
  });

  // Regression: halted statuses must NOT mark every milestone done (esp. Delivered).
  it('rejected stops at "placed" and does not complete the journey', () => {
    const j = orderJourney('rejected');
    expect(stateOf('rejected', 'placed')).toBe('done');
    expect(stateOf('rejected', 'paid')).toBe('upcoming');
    expect(stateOf('rejected', 'delivered')).toBe('upcoming');
    expect(j.halted?.label).toBeTruthy();
  });

  it('refunded shows progress through payment only', () => {
    expect(stateOf('refunded', 'paid')).toBe('done');
    expect(stateOf('refunded', 'purchased')).toBe('upcoming');
    expect(stateOf('refunded', 'delivered')).toBe('upcoming');
    expect(orderJourney('refunded').halted?.label).toBeTruthy();
  });

  it('delivery_failed shows progress through out-for-delivery but not delivered', () => {
    expect(stateOf('delivery_failed', 'delivery')).toBe('done');
    expect(stateOf('delivery_failed', 'delivered')).toBe('upcoming');
    expect(orderJourney('delivery_failed').halted?.label).toBeTruthy();
  });
});
