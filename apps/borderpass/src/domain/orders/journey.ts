// Customer-facing journey model: condenses the ~25-state order machine into the milestones a
// customer actually tracks (Stitch border-journey design). Pure — derives milestone states from
// the real order status only; no fabricated timestamps or data.

export interface JourneyMilestone {
  key: string;
  label: string;
  state: 'done' | 'current' | 'upcoming';
}

export interface OrderJourney {
  milestones: JourneyMilestone[];
  /** Set when the order left the happy path (cancelled/rejected/refunded/failed). */
  halted?: { label: string };
}

// Ordered happy-path stages; each groups one or more machine statuses.
const STAGES: { key: string; label: string; statuses: string[] }[] = [
  {
    key: 'placed',
    label: 'Order placed',
    statuses: [
      'submitted',
      'under_review',
      'missing_information',
      'quote_ready',
      'awaiting_payment',
    ],
  },
  { key: 'paid', label: 'Payment received', statuses: ['paid', 'purchasing'] },
  { key: 'purchased', label: 'Purchased', statuses: ['purchased', 'awaiting_package'] },
  { key: 'received', label: 'Received in El Paso', statuses: ['received_el_paso'] },
  {
    key: 'inspection',
    label: 'Inspection',
    statuses: ['inspection_pending', 'inspection_passed'],
  },
  {
    key: 'crossing',
    label: 'Border crossing',
    statuses: ['border_documentation_ready', 'ready_for_crossing', 'border_crossing'],
  },
  { key: 'customs', label: 'Customs', statuses: ['customs_processing', 'arrived_juarez'] },
  { key: 'delivery', label: 'Out for delivery', statuses: ['out_for_delivery'] },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'] },
];

// Halted (off-happy-path) statuses. `stage` = the last stage actually reached before the halt, so
// the timeline shows real progress instead of marking every milestone (incl. Delivered) as done.
const HALTED: Record<string, { label: string; stage: string }> = {
  rejected: { label: 'This order was not approved.', stage: 'placed' },
  cancelled: { label: 'This order was cancelled.', stage: 'placed' },
  refunded: { label: 'This order was refunded.', stage: 'paid' },
  inspection_failed: { label: 'The inspection found an issue.', stage: 'inspection' },
  delivery_failed: { label: 'Delivery could not be completed.', stage: 'delivery' },
};

/** Build the milestone list + state for an order status. */
export function orderJourney(status: string): OrderJourney {
  const halted = HALTED[status];
  if (halted) {
    // Mark done only through the last reached stage; the rest stay upcoming + the halt message.
    const haltIdx = STAGES.findIndex((s) => s.key === halted.stage);
    const milestones = STAGES.map((s, i) => ({
      key: s.key,
      label: s.label,
      state: (i <= haltIdx ? 'done' : 'upcoming') as JourneyMilestone['state'],
    }));
    return { milestones, halted: { label: halted.label } };
  }

  // Happy path: earlier stages done, the matched stage current, later stages upcoming.
  // Draft (or any unmatched status) → nothing reached yet. `delivered` is terminal-complete, so
  // its stage is done (not "in progress").
  const idx = STAGES.findIndex((s) => s.statuses.includes(status));
  const complete = status === 'delivered';
  const milestones = STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: (i < idx
      ? 'done'
      : i === idx
        ? complete
          ? 'done'
          : 'current'
        : 'upcoming') as JourneyMilestone['state'],
  }));
  return { milestones };
}
