/**
 * Delivery-preparation sub-status machine (Phase 6, ADR-0012). Pure, status-only (staff/system-driven;
 * the action layer enforces staff authorization). This is a DOMAIN machine on the delivery_preparations
 * record — it does NOT add order states. The order's real delivery edges are driven only via
 * transitionOrder (Increment 6.4). Order transitions are NOT wired here.
 */
export const DELIVERY_PREP_STATUSES = ['pending', 'preparing', 'ready', 'scheduled', 'handed_off'] as const;
export type DeliveryPrepStatus = (typeof DELIVERY_PREP_STATUSES)[number];

/** Legal transitions (status-only). */
export const LEGAL_DELIVERY_PREP_TRANSITIONS: Record<DeliveryPrepStatus, readonly DeliveryPrepStatus[]> = {
  pending: ['preparing'],
  preparing: ['ready'],
  ready: ['scheduled'],
  scheduled: ['handed_off'],
  handed_off: [],
};

const TERMINAL: readonly DeliveryPrepStatus[] = ['handed_off'];

export function isLegalDeliveryPrepTransition(from: DeliveryPrepStatus, to: DeliveryPrepStatus): boolean {
  return LEGAL_DELIVERY_PREP_TRANSITIONS[from]?.includes(to) ?? false;
}
export function getNextAllowedDeliveryPrepStatuses(from: DeliveryPrepStatus): DeliveryPrepStatus[] {
  return [...(LEGAL_DELIVERY_PREP_TRANSITIONS[from] ?? [])];
}
export function isTerminalDeliveryPrepStatus(status: DeliveryPrepStatus): boolean {
  return TERMINAL.includes(status);
}
export class IllegalDeliveryPrepTransitionError extends Error {
  constructor(readonly from: DeliveryPrepStatus, readonly to: DeliveryPrepStatus) {
    super(`illegal delivery-prep transition: ${from} → ${to}`);
    this.name = 'IllegalDeliveryPrepTransitionError';
  }
}
export function assertDeliveryPrepTransition(from: DeliveryPrepStatus, to: DeliveryPrepStatus): void {
  if (!isLegalDeliveryPrepTransition(from, to)) throw new IllegalDeliveryPrepTransitionError(from, to);
}
