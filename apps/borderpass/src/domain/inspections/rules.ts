/**
 * Pure inspection business rules (Phase 6, ADR-0012). No I/O. Keeps the safety-critical gates
 * (post-payment precondition + the order join target) unit-testable without the DB stack.
 */
import type { OrderStatus } from '@/domain/orders/state-machine';
import type { InspectionStatus } from './state-machine';

/** Order statuses for which the inspection lifecycle may begin (paid + post-paid pre-inspection chain). */
const INSPECTION_ELIGIBLE_ORDER: readonly OrderStatus[] = [
  'paid',
  'purchasing',
  'purchased',
  'awaiting_package',
  'received_el_paso',
  'inspection_pending',
];

/** Post-payment lifecycle gate: an inspection can be created only once the order is paid (or beyond). */
export function canStartInspection(orderStatus: OrderStatus): boolean {
  return INSPECTION_ELIGIBLE_ORDER.includes(orderStatus);
}

/**
 * The ONLY order edge an inspection result may drive, and only when the order is at `inspection_pending`.
 * `passed → inspection_passed`, `failed → inspection_failed`; everything else → null (no order change).
 * Both targets are EXISTING legal order edges (LEGAL_TRANSITIONS.inspection_pending) — no new states.
 * Returning a target (not performing the write) keeps this pure and exhaustively testable.
 */
export function inspectionOrderJoinTarget(
  inspectionTo: InspectionStatus,
  orderStatus: OrderStatus,
): 'inspection_passed' | 'inspection_failed' | null {
  if (orderStatus !== 'inspection_pending') return null;
  if (inspectionTo === 'passed') return 'inspection_passed';
  if (inspectionTo === 'failed') return 'inspection_failed';
  return null;
}

/** Approved milestones that enqueue a placeholder customer notification (Phase 6 decision). */
export function shouldNotifyInspection(status: InspectionStatus): boolean {
  return status === 'passed' || status === 'failed';
}
