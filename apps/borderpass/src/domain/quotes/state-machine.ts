/** Quote state machine (9 states) with role-gated transitions. Pure. ADR-0009. */
export const QUOTE_STATUSES = [
  'draft',
  'pending_finance_approval',
  'approved',
  'sent_to_customer',
  'accepted',
  'declined',
  'expired',
  'cancelled',
  'superseded',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const FINANCE_ROLES = ['finance_admin', 'operations_manager', 'super_admin'] as const;
type ActorClass = 'customer' | 'staff' | 'finance' | 'system';

function actorClasses(role: string): ActorClass[] {
  if (role === 'system') return ['system'];
  if (role === 'customer') return ['customer'];
  const c: ActorClass[] = ['staff'];
  if ((FINANCE_ROLES as readonly string[]).includes(role)) c.push('finance');
  return c;
}

/** from → { to: allowed actor classes }. */
const TRANSITIONS: Record<QuoteStatus, Partial<Record<QuoteStatus, ActorClass[]>>> = {
  draft: {
    pending_finance_approval: ['staff'],
    approved: ['finance', 'system'],
    cancelled: ['staff'],
  },
  pending_finance_approval: {
    approved: ['finance'],
    draft: ['finance'],
    cancelled: ['staff', 'finance'],
  },
  approved: { sent_to_customer: ['staff'], cancelled: ['staff'], superseded: ['staff'] },
  sent_to_customer: {
    accepted: ['customer'],
    declined: ['customer'],
    expired: ['system'],
    cancelled: ['staff'],
    superseded: ['staff'],
  },
  accepted: {},
  declined: { superseded: ['staff'] },
  expired: { superseded: ['staff'] },
  cancelled: {},
  superseded: {},
};

const TERMINAL: readonly QuoteStatus[] = [
  'accepted',
  'declined',
  'expired',
  'cancelled',
  'superseded',
];

export function canTransitionQuoteStatus(
  from: QuoteStatus,
  to: QuoteStatus,
  actorRole: string,
): boolean {
  const allowed = TRANSITIONS[from]?.[to] ?? [];
  const classes = actorClasses(actorRole);
  return allowed.some((c) => classes.includes(c));
}
export function getNextAllowedQuoteStatuses(status: QuoteStatus, actorRole: string): QuoteStatus[] {
  return (Object.keys(TRANSITIONS[status] ?? {}) as QuoteStatus[]).filter((to) =>
    canTransitionQuoteStatus(status, to, actorRole),
  );
}
export function isTerminalQuoteStatus(status: QuoteStatus): boolean {
  return TERMINAL.includes(status);
}
/** Customer-facing label (internal states collapse to neutral copy). */
export function getCustomerVisibleQuoteStatus(status: QuoteStatus): string {
  switch (status) {
    case 'draft':
    case 'pending_finance_approval':
    case 'approved':
      return 'preparing';
    case 'sent_to_customer':
      return 'quote_ready';
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'expired':
      return 'expired';
    case 'cancelled':
      return 'cancelled';
    case 'superseded':
      return 'updated';
  }
}
export function canEditQuote(status: QuoteStatus, actorRole: string): boolean {
  return status === 'draft' && actorRole !== 'customer';
}
export function canCustomerAcceptQuote(
  status: QuoteStatus,
  expiresAt: Date | null | undefined,
): boolean {
  return status === 'sent_to_customer' && (!expiresAt || expiresAt.getTime() > Date.now());
}
export function canCustomerDeclineQuote(status: QuoteStatus): boolean {
  return status === 'sent_to_customer';
}
export class IllegalQuoteTransitionError extends Error {
  constructor(
    readonly from: QuoteStatus,
    readonly to: QuoteStatus,
    readonly role: string,
  ) {
    super(`illegal quote transition ${from} → ${to} for role ${role}`);
    this.name = 'IllegalQuoteTransitionError';
  }
}
export function assertQuoteTransition(from: QuoteStatus, to: QuoteStatus, role: string): void {
  if (!canTransitionQuoteStatus(from, to, role))
    throw new IllegalQuoteTransitionError(from, to, role);
}
