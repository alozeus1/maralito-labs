/** Canonical 25-state order machine (docs/product/09-order-state-machine.md / contracts/04). Pure. */
export const ORDER_STATUSES = [
  'draft', 'submitted', 'missing_information', 'under_review', 'rejected',
  'quote_ready', 'awaiting_payment', 'paid', 'purchasing', 'purchased',
  'awaiting_package', 'received_el_paso', 'inspection_pending', 'inspection_passed',
  'inspection_failed', 'border_documentation_ready', 'ready_for_crossing', 'border_crossing',
  'customs_processing', 'arrived_juarez', 'out_for_delivery', 'delivered',
  'delivery_failed', 'cancelled', 'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['rejected', 'cancelled', 'refunded', 'delivered'];

/** Legal transitions. Status is mutated ONLY via transitionOrder(), which calls assertTransition(). */
export const LEGAL_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['missing_information', 'under_review', 'cancelled'],
  missing_information: ['submitted', 'cancelled'],
  under_review: ['rejected', 'quote_ready'],
  rejected: [],
  quote_ready: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['purchasing', 'awaiting_package', 'refunded'],
  purchasing: ['purchased'],
  purchased: ['awaiting_package'],
  awaiting_package: ['received_el_paso'],
  received_el_paso: ['inspection_pending'],
  inspection_pending: ['inspection_passed', 'inspection_failed'],
  inspection_passed: ['border_documentation_ready'],
  inspection_failed: ['refunded', 'cancelled'],
  border_documentation_ready: ['ready_for_crossing'],
  ready_for_crossing: ['border_crossing'],
  border_crossing: ['customs_processing'],
  customs_processing: ['arrived_juarez'],
  arrived_juarez: ['out_for_delivery'],
  out_for_delivery: ['delivered', 'delivery_failed'],
  delivered: [],
  delivery_failed: ['out_for_delivery', 'cancelled'],
  cancelled: [],
  refunded: [],
};

export function isLegalTransition(from: OrderStatus, to: OrderStatus): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}
export function isTerminal(s: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(s);
}
export class IllegalTransitionError extends Error {
  constructor(readonly from: OrderStatus, readonly to: OrderStatus) {
    super(`illegal order transition: ${from} → ${to}`);
    this.name = 'IllegalTransitionError';
  }
}
/** Guard used by the single mutation seam transitionOrder(). */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!isLegalTransition(from, to)) throw new IllegalTransitionError(from, to);
}
