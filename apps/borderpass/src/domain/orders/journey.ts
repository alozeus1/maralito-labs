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
    statuses: ['inspection_pending', 'inspection_passed', 'inspection_failed'],
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

const HALTED: Record<string, string> = {
  rejected: 'This order was not approved.',
  cancelled: 'This order was cancelled.',
  refunded: 'This order was refunded.',
  delivery_failed: 'Delivery could not be completed.',
  inspection_failed: 'The inspection found an issue.',
};

/** Build the milestone list + state for an order status. */
export function orderJourney(status: string): OrderJourney {
  const currentIndex = STAGES.findIndex((s) => s.statuses.includes(status));
  const halted = HALTED[status] ? { label: HALTED[status] } : undefined;

  // For a halted status that isn't itself in the happy-path index (e.g. cancelled), keep prior
  // progress; inspection_failed/ delivery_failed do map to a stage, so they still highlight there.
  const idx = currentIndex >= 0 ? currentIndex : status === 'draft' ? -1 : STAGES.length; // terminal-negative with no stage → treat everything as reached-then-halted

  const milestones = STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: (i < idx ? 'done' : i === idx ? 'current' : 'upcoming') as JourneyMilestone['state'],
  }));

  return halted ? { milestones, halted } : { milestones };
}
