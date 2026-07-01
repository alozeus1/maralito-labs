import { describe, it, expect } from 'vitest';
import { canStartInspection, inspectionOrderJoinTarget, shouldNotifyInspection } from './rules';
import type { OrderStatus } from '@/domain/orders/state-machine';
import type { InspectionStatus } from './state-machine';

describe('canStartInspection', () => {
  it('allows paid + post-paid pre-inspection order states', () => {
    for (const os of ['paid', 'purchasing', 'purchased', 'awaiting_package', 'received_el_paso', 'inspection_pending'] as OrderStatus[])
      expect(canStartInspection(os)).toBe(true);
  });
  it('rejects pre-paid and unrelated states', () => {
    for (const os of ['draft', 'submitted', 'under_review', 'quote_ready', 'awaiting_payment', 'inspection_passed', 'delivered', 'cancelled', 'refunded'] as OrderStatus[])
      expect(canStartInspection(os)).toBe(false);
  });
});

describe('inspectionOrderJoinTarget — only drives the existing inspection_pending edges', () => {
  it('passed/failed at inspection_pending → the matching existing order edge', () => {
    expect(inspectionOrderJoinTarget('passed', 'inspection_pending')).toBe('inspection_passed');
    expect(inspectionOrderJoinTarget('failed', 'inspection_pending')).toBe('inspection_failed');
  });
  it('no join when the order is NOT at inspection_pending', () => {
    for (const os of ['paid', 'received_el_paso', 'inspection_passed', 'delivered'] as OrderStatus[]) {
      expect(inspectionOrderJoinTarget('passed', os)).toBeNull();
      expect(inspectionOrderJoinTarget('failed', os)).toBeNull();
    }
  });
  it('non-terminal inspection statuses never drive an order edge', () => {
    for (const st of ['scheduled', 'in_progress', 'on_hold'] as InspectionStatus[])
      expect(inspectionOrderJoinTarget(st, 'inspection_pending')).toBeNull();
  });
});

describe('shouldNotifyInspection — milestone gate (passed/failed only)', () => {
  it('notifies only for passed and failed', () => {
    expect(shouldNotifyInspection('passed')).toBe(true);
    expect(shouldNotifyInspection('failed')).toBe(true);
    for (const st of ['scheduled', 'in_progress', 'on_hold'] as InspectionStatus[])
      expect(shouldNotifyInspection(st)).toBe(false);
  });
});
