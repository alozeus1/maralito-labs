import { describe, it, expect } from 'vitest';
import {
  DELIVERY_PREP_STATUSES, isLegalDeliveryPrepTransition, assertDeliveryPrepTransition,
  IllegalDeliveryPrepTransitionError, isTerminalDeliveryPrepStatus, getNextAllowedDeliveryPrepStatuses,
  type DeliveryPrepStatus,
} from './state-machine';

describe('delivery-prep state machine', () => {
  it('has 5 statuses', () => expect(DELIVERY_PREP_STATUSES).toHaveLength(5));

  it('allows the linear path pending→preparing→ready→scheduled→handed_off', () => {
    const legal: [DeliveryPrepStatus, DeliveryPrepStatus][] = [
      ['pending', 'preparing'], ['preparing', 'ready'], ['ready', 'scheduled'], ['scheduled', 'handed_off'],
    ];
    for (const [f, t] of legal) expect(isLegalDeliveryPrepTransition(f, t)).toBe(true);
  });

  it('rejects skips and backwards/terminal-escape transitions', () => {
    const illegal: [DeliveryPrepStatus, DeliveryPrepStatus][] = [
      ['pending', 'ready'], ['pending', 'scheduled'], ['preparing', 'scheduled'],
      ['ready', 'handed_off'], ['scheduled', 'ready'], ['preparing', 'pending'],
      ['handed_off', 'scheduled'], ['handed_off', 'pending'],
    ];
    for (const [f, t] of illegal) expect(isLegalDeliveryPrepTransition(f, t)).toBe(false);
  });

  it('assert throws on illegal', () =>
    expect(() => assertDeliveryPrepTransition('pending', 'handed_off')).toThrow(IllegalDeliveryPrepTransitionError));

  it('handed_off is terminal (no out-edges)', () => {
    expect(isTerminalDeliveryPrepStatus('handed_off')).toBe(true);
    expect(getNextAllowedDeliveryPrepStatuses('handed_off')).toHaveLength(0);
    for (const s of ['pending', 'preparing', 'ready', 'scheduled'] as DeliveryPrepStatus[])
      expect(isTerminalDeliveryPrepStatus(s)).toBe(false);
  });
});
