/** Customer/staff-safe delivery-prep status label (Phase 6, ADR-0012). Pure. No PII. */
import type { DeliveryPrepStatus } from './state-machine';

export function deliveryPrepStatusLabel(status: DeliveryPrepStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'preparing':
      return 'Preparing';
    case 'ready':
      return 'Ready';
    case 'scheduled':
      return 'Scheduled';
    case 'handed_off':
      return 'Handed off';
  }
}
