'use server';
import { desc, eq } from 'drizzle-orm';
import { AcceptQuote, DeclineQuote } from '@maralito/schemas';
import { withTenant, quotes, quoteLineItems, orders } from '@maralito/db';
import { requireCustomerAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { writeAudit } from '@/server/audit';
import { transitionQuote } from '@/server/quote-transitions';
import { transitionOrderPrivileged } from '@/server/order-transitions';
import { canCustomerAcceptQuote, canCustomerDeclineQuote, getCustomerVisibleQuoteStatus, type QuoteStatus } from '@/domain/quotes/state-machine';
import type { OrderStatus } from '@/domain/orders/state-machine';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: { code: string; message: string } };
async function custGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try { requireCustomerAccess(s); } catch { return { s: null, err: { code: 'forbidden', message: 'Not allowed.' } }; }
  if (!getServerEnv().DATABASE_URL) return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

/** Customer-safe quote projection (NEVER includes internal_notes / approval internals). */
function customerQuoteView(q: typeof quotes.$inferSelect) {
  return {
    id: q.id, order_id: q.orderId, status: getCustomerVisibleQuoteStatus(q.status as QuoteStatus),
    currency: q.currency, total_minor: q.totalMinor, subtotal_minor: q.subtotalMinor,
    service_fee_minor: q.serviceFeeMinor, delivery_fee_minor: q.deliveryFeeMinor,
    estimated_tax_minor: q.estimatedTaxMinor, inspection_fee_minor: q.inspectionFeeMinor,
    discount_minor: q.discountMinor, expires_at: q.expiresAt, customer_message: q.customerMessage,
  };
}

/** List the caller's own quotes (RLS-scoped to own orders). */
export async function listMyQuotes(): Promise<Result<ReturnType<typeof customerQuoteView>[]>> {
  const { s, err } = await custGuard(); if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const rows = await tx.select().from(quotes).orderBy(desc(quotes.createdAt)).limit(50);
    return { ok: true, data: rows.map(customerQuoteView) };
  });
}

/** Read the quote for one of the caller's own orders (safe projection + visible line items only). */
export async function getMyOrderQuote(orderId: string): Promise<Result<unknown>> {
  const { s, err } = await custGuard(); if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.orderId, orderId) }); // RLS scopes to own order
    if (!q) return { ok: false, error: { code: 'not_found', message: 'Quote not found.' } };
    const lines = await tx.select().from(quoteLineItems).where(eq(quoteLineItems.quoteId, q.id)); // RLS hides internal-only
    return { ok: true, data: { quote: customerQuoteView(q), line_items: lines.map((l) => ({ kind: l.kind, description: l.description, quantity: l.quantity, total_amount_minor: l.totalAmountMinor, currency: l.currency })) } };
  });
}

export async function acceptQuote(input: unknown): Promise<Result> {
  const { s, err } = await custGuard(); if (!s) return { ok: false, error: err! };
  const parsed = AcceptQuote.safeParse(input); if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid request.' } };
  const loaded = await withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) });
    if (!q) return null;
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, q.orderId) });
    return { q, order };
  });
  if (!loaded?.q) return { ok: false, error: { code: 'not_found', message: 'Quote not found.' } };
  const { q, order } = loaded;
  if (!canCustomerAcceptQuote(q.status as QuoteStatus, q.expiresAt)) {
    await writeAudit({ action: 'quote.invalid_transition_attempt', orgId: q.orgId, actorUserId: s.sub, actorRole: 'customer', entityType: 'quote', entityId: q.id, after: { attempted: 'accept', status: q.status } });
    return { ok: false, error: { code: 'conflict_state', message: 'Quote cannot be accepted (not sent or expired).' } };
  }
  await transitionQuote({ id: q.id, orderId: q.orderId, orgId: q.orgId, status: q.status as QuoteStatus }, 'accepted', { userId: s.sub, role: 'customer' });
  if (order && order.status === 'quote_ready') {
    await transitionOrderPrivileged({ id: order.id, orgId: order.orgId, status: order.status as OrderStatus }, 'awaiting_payment', { userId: s.sub, role: 'customer' });
  }
  return { ok: true };
}

export async function declineQuote(input: unknown): Promise<Result> {
  const { s, err } = await custGuard(); if (!s) return { ok: false, error: err! };
  const parsed = DeclineQuote.safeParse(input); if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid request.' } };
  const q = await withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) =>
    tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) }));
  if (!q) return { ok: false, error: { code: 'not_found', message: 'Quote not found.' } };
  if (!canCustomerDeclineQuote(q.status as QuoteStatus)) {
    await writeAudit({ action: 'quote.invalid_transition_attempt', orgId: q.orgId, actorUserId: s.sub, actorRole: 'customer', entityType: 'quote', entityId: q.id, after: { attempted: 'decline', status: q.status } });
    return { ok: false, error: { code: 'conflict_state', message: 'Quote cannot be declined.' } };
  }
  await transitionQuote(
    { id: q.id, orderId: q.orderId, orgId: q.orgId, status: q.status as QuoteStatus },
    'declined',
    { userId: s.sub, role: 'customer' },
    parsed.data.reason ? { reason: parsed.data.reason } : undefined,
  );
  return { ok: true };
}
