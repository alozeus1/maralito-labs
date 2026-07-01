/**
 * Pure delivery-preparation business rules (Phase 6, ADR-0012). No I/O. Keeps the precondition + the
 * order-join target unit-testable without the DB stack.
 */
import type { OrderStatus } from '@/domain/orders/state-machine';
import type { DeliveryPrepStatus } from './state-machine';

/**
 * Order statuses for which delivery preparation may begin — the post-inspection chain (inspection
 * passed) up to (but not past) the Juárez handoff. Prefers requiring inspection passed.
 */
const DELIVERY_ELIGIBLE_ORDER: readonly OrderStatus[] = [
  'inspection_passed',
  'border_documentation_ready',
  'ready_for_crossing',
  'border_crossing',
  'customs_processing',
  'arrived_juarez',
];

/** Delivery prep can be created only once the order has passed inspection (post-inspection chain). */
export function canCreateDeliveryPrep(orderStatus: OrderStatus): boolean {
  return DELIVERY_ELIGIBLE_ORDER.includes(orderStatus);
}

/** Scheduling is allowed only from the `ready` sub-status (ready → scheduled). */
export function canScheduleDeliveryPrep(status: DeliveryPrepStatus): boolean {
  return status === 'ready';
}

/**
 * The ONLY order edge a delivery-prep status may drive, and only when the order is at `arrived_juarez`.
 * `handed_off → out_for_delivery` (an EXISTING legal order edge); everything else → null. Delivery-prep
 * statuses `ready`/`scheduled` are record sub-statuses, NOT order states. Pure (returns target only).
 */
export function deliveryOrderJoinTarget(
  deliveryPrepTo: DeliveryPrepStatus,
  orderStatus: OrderStatus,
): 'out_for_delivery' | null {
  if (deliveryPrepTo !== 'handed_off') return null;
  if (orderStatus === 'arrived_juarez') return 'out_for_delivery';
  return null;
}

/** Approved milestones that enqueue a placeholder customer notification (Phase 6 decision). */
export function shouldNotifyDelivery(status: DeliveryPrepStatus): boolean {
  return status === 'ready' || status === 'scheduled' || status === 'handed_off';
}
