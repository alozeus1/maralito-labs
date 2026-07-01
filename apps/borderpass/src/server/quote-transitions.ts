import 'server-only';
import { eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, quotes, quoteStatusHistory, newId } from '@maralito/db';
import { assertQuoteTransition, type QuoteStatus } from '@/domain/quotes/state-machine';
import { writeAudit } from './audit';
import { emitQuoteEvent } from './quote-events';

const EVENT_FOR: Partial<Record<QuoteStatus, string>> = {
  pending_finance_approval: 'quote.submitted_for_approval', approved: 'quote.approved',
  sent_to_customer: 'quote.sent', accepted: 'quote.accepted', declined: 'quote.declined',
  expired: 'quote.expired', cancelled: 'quote.cancelled', superseded: 'quote.superseded',
};

/**
 * THE single quote status-mutation seam. Asserts legality (role-gated), updates status + timestamps,
 * writes quote_status_history, audits, emits an event placeholder. Runs privileged + audited (a
 * durable workflow wraps it later). Authorization is checked by the CALLER before invoking this.
 */
export async function transitionQuote(
  q: { id: string; orderId: string; orgId: string; status: QuoteStatus },
  to: QuoteStatus,
  actor: { userId: string; role: string },
  meta?: { reason?: string; extra?: Record<string, unknown> },
): Promise<void> {
  assertQuoteTransition(q.status, to, actor.role);
  await withPrivilegedDbAccess(`quote.transition:${q.status}->${to}`, async (db) => {
    const patch: Record<string, unknown> = { status: to, updatedAt: new Date() };
    const now = new Date();
    if (to === 'approved') { patch.approvedAt = now; patch.approvedBy = actor.userId; }
    if (to === 'sent_to_customer') patch.sentAt = now;
    if (to === 'accepted') patch.acceptedAt = now;
    if (to === 'declined') { patch.declinedAt = now; if (meta?.reason) patch.declineReason = meta.reason; }
    await db.update(quotes).set(patch).where(eq(quotes.id, q.id));
    await db.insert(quoteStatusHistory).values({ id: newId('qsh'), quoteId: q.id, fromStatus: q.status, toStatus: to, actorUserId: actor.userId, actorRole: actor.role, reason: meta?.reason ?? null });
  });
  await writeAudit({ action: 'quote.status_changed', orgId: q.orgId, actorUserId: actor.userId, actorRole: actor.role, entityType: 'quote', entityId: q.id, before: { status: q.status }, after: { status: to, ...(meta?.extra ?? {}) } });
  const evt = EVENT_FOR[to]; if (evt) await emitQuoteEvent(evt, { quote_id: q.id, order_id: q.orderId });
}
