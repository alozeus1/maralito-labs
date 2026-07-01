import { describe, it, expect } from 'vitest';
import {
  canCreateDeliveryPrep,
  canScheduleDeliveryPrep,
  deliveryOrderJoinTarget,
  shouldNotifyDelivery,
} from './rules';
import type { OrderStatus } from '@/domain/orders/state-machine';
import type { DeliveryPrepStatus } from './state-machine';

describe('canCreateDeliveryPrep', () => {
  it('allows the post-inspection chain (inspection passed → arrived_juarez)', () => {
    for (const os of [
      'inspection_passed',
      'border_documentation_ready',
      'ready_for_crossing',
      'border_crossing',
      'customs_processing',
      'arrived_juarez',
    ] as OrderStatus[])
      expect(canCreateDeliveryPrep(os)).toBe(true);
  });
  it('rejects pre-inspection / pre-paid / post-delivery states', () => {
    for (const os of [
      'draft',
      'awaiting_payment',
      'paid',
      'received_el_paso',
      'inspection_pending',
      'inspection_failed',
      'out_for_delivery',
      'delivered',
      'cancelled',
    ] as OrderStatus[])
      expect(canCreateDeliveryPrep(os)).toBe(false);
  });
});

describe('canScheduleDeliveryPrep', () => {
  it('allows scheduling only from ready', () => {
    expect(canScheduleDeliveryPrep('ready')).toBe(true);
    for (const st of ['pending', 'preparing', 'scheduled', 'handed_off'] as DeliveryPrepStatus[])
      expect(canScheduleDeliveryPrep(st)).toBe(false);
  });
});

describe('deliveryOrderJoinTarget — only handed_off at arrived_juarez', () => {
  it('handed_off + arrived_juarez → out_for_delivery (existing edge)', () =>
    expect(deliveryOrderJoinTarget('handed_off', 'arrived_juarez')).toBe('out_for_delivery'));
  it('no join when not handed_off, or order not at arrived_juarez', () => {
    for (const st of ['pending', 'preparing', 'ready', 'scheduled'] as DeliveryPrepStatus[])
      expect(deliveryOrderJoinTarget(st, 'arrived_juarez')).toBeNull();
    for (const os of [
      'paid',
      'inspection_passed',
      'customs_processing',
      'out_for_delivery',
      'delivered',
    ] as OrderStatus[])
      expect(deliveryOrderJoinTarget('handed_off', os)).toBeNull();
  });
});

describe('shouldNotifyDelivery — milestone gate (ready/scheduled/handed_off)', () => {
  it('notifies only for ready, scheduled, handed_off', () => {
    for (const st of ['ready', 'scheduled', 'handed_off'] as DeliveryPrepStatus[])
      expect(shouldNotifyDelivery(st)).toBe(true);
    for (const st of ['pending', 'preparing'] as DeliveryPrepStatus[])
      expect(shouldNotifyDelivery(st)).toBe(false);
  });
});
