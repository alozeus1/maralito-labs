'use server';
import { and, desc, eq } from 'drizzle-orm';
import { CreateQuoteDraft, UpdateQuoteDraft, QuoteLineItemInput, SubmitForApproval, ApproveQuote, RejectQuote, SendQuote, QuoteIdParam } from '@maralito/schemas';
import { z } from 'zod';
import { withTenant, withPrivilegedDbAccess, quotes, quoteLineItems, quoteApprovals, orders, newId } from '@maralito/db';
import { requireAdminAccess, type AppSession } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { writeAudit } from '@/server/audit';
import { transitionQuote } from '@/server/quote-transitions';
import { emitQuoteEvent } from '@/server/quote-events';
import { transitionOrderPrivileged } from '@/server/order-transitions';
import { calculateQuoteTotals, type QuoteLine } from '@/domain/quotes/totals';
import { requiresFinanceApproval } from '@/domain/quotes/config';
import { canTransitionQuoteStatus, IllegalQuoteTransitionError, type QuoteStatus } from '@/domain/quotes/state-machine';
import type { OrderStatus } from '@/domain/orders/state-machine';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: { code: string; message: string; details?: unknown } };

async function staffGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try { requireAdminAccess(s); } catch { await writeAudit({ action: 'quote.unauthorized_access_attempt', actorUserId: s?.sub }); return { s: null, err: { code: 'not_found', message: 'Not found.' } }; }
  if (!getServerEnv().DATABASE_URL) return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}
const FINANCE_ROLE_KEYS = ['finance_admin', 'operations_manager', 'super_admin'] as const;
const isFinance = (s: AppSession) => s.roles.some((r) => (FINANCE_ROLE_KEYS as readonly string[]).includes(r));
/** The actual finance role the user holds (the role that satisfied the guard) — never positional roles[0]. */
const financeRoleOf = (s: AppSession) => s.roles.find((r) => (FINANCE_ROLE_KEYS as readonly string[]).includes(r))!;
/** A staff role the user holds (for staff-class transitions) — falls back to roles[0]. */
const staffRoleOf = (s: AppSession) => s.roles[0]!;
/** Maps an IllegalQuoteTransitionError (and only that) to a structured conflict result. */
function asConflict<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  return fn().catch((e) => {
    if (e instanceof IllegalQuoteTransitionError) return { ok: false, error: { code: 'conflict_state', message: 'Illegal quote transition.' } } as Result<T>;
    throw e;
  });
}

async function recalc(tx: Parameters<Parameters<import('@maralito/db').Db['transaction']>[0]>[0], quoteId: string) {
  const lines = await tx.select().from(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
  const ql: QuoteLine[] = lines.map((l) => ({ kind: l.kind, total_amount_minor: l.totalAmountMinor, currency: l.currency, customer_visible: l.customerVisible, internal_only: l.internalOnly }));
  const t = calculateQuoteTotals(ql);
  await tx.update(quotes).set({ ...t, updatedAt: new Date() }).where(eq(quotes.id, quoteId));
}

export async function createQuoteDraft(input: unknown): Promise<Result<{ quote_id: string }>> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  const parsed = CreateQuoteDraft.safeParse(input); if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid quote.', details: parsed.error.flatten() } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, parsed.data.order_id) });
    if (!order) return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
    const id = newId('qte');
    await tx.insert(quotes).values({ id, orderId: order.id, customerId: order.customerId, orgId: s.orgId, status: 'draft', currency: parsed.data.currency, customerMessage: parsed.data.customer_message ?? null, internalNotes: parsed.data.internal_notes ?? null });
    for (const it of parsed.data.items ?? []) {
      await tx.insert(quoteLineItems).values({ id: newId('qli'), quoteId: id, kind: it.kind, description: it.description, quantity: it.quantity, unitAmountMinor: it.unit_amount_minor, totalAmountMinor: it.total_amount_minor, currency: it.currency, taxable: it.taxable ?? false, customerVisible: it.customer_visible ?? true, internalOnly: it.internal_only ?? false, metadata: it.metadata });
    }
    await recalc(tx, id);
    await writeAudit({ action: 'quote.created', orgId: s.orgId, actorUserId: s.sub, actorRole: staffRoleOf(s), entityType: 'quote', entityId: id });
    await emitQuoteEvent('quote.created', { quote_id: id, order_id: order.id });
    return { ok: true, data: { quote_id: id } };
  });
}

const editable = (status: string) => status === 'draft';

export async function updateDraftQuote(input: unknown): Promise<Result> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  const parsed = UpdateQuoteDraft.safeParse(input); if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) });
    if (!q) return { ok: false, error: { code: 'not_found', message: 'Quote not found.' } };
    if (!editable(q.status)) return { ok: false, error: { code: 'conflict_state', message: 'Quote not editable.' } };
    await tx.update(quotes).set({ customerMessage: parsed.data.customer_message ?? null, internalNotes: parsed.data.internal_notes ?? null, requiresApproval: parsed.data.requires_approval ?? q.requiresApproval, updatedAt: new Date() }).where(eq(quotes.id, q.id));
    await writeAudit({ action: 'quote.updated', orgId: s.orgId, actorUserId: s.sub, actorRole: staffRoleOf(s), entityType: 'quote', entityId: q.id });
    await emitQuoteEvent('quote.updated', { quote_id: q.id, order_id: q.orderId });
    return { ok: true };
  });
}

export async function addQuoteLineItem(input: unknown): Promise<Result> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  const parsed = z.object({ quote_id: z.string().regex(/^qte_/), item: QuoteLineItemInput }).safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid line item.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) });
    if (!q) return { ok: false, error: { code: 'not_found', message: 'Quote not found.' } };
    if (!editable(q.status)) return { ok: false, error: { code: 'conflict_state', message: 'Quote not editable.' } };
    const it = parsed.data.item;
    if (it.currency !== q.currency) return { ok: false, error: { code: 'validation_failed', message: 'Line currency must match quote.' } };
    await tx.insert(quoteLineItems).values({ id: newId('qli'), quoteId: q.id, kind: it.kind, description: it.description, quantity: it.quantity, unitAmountMinor: it.unit_amount_minor, totalAmountMinor: it.total_amount_minor, currency: it.currency, taxable: it.taxable ?? false, customerVisible: it.customer_visible ?? true, internalOnly: it.internal_only ?? false, metadata: it.metadata });
    await recalc(tx, q.id);
    await writeAudit({ action: 'quote.line_item_added', orgId: s.orgId, actorUserId: s.sub, actorRole: staffRoleOf(s), entityType: 'quote', entityId: q.id });
    return { ok: true };
  });
}

export async function removeQuoteLineItem(input: unknown): Promise<Result> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  const parsed = z.object({ quote_id: z.string().regex(/^qte_/), line_id: z.string().regex(/^qli_/) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) });
    if (!q || !editable(q.status)) return { ok: false, error: { code: 'conflict_state', message: 'Quote not editable.' } };
    await tx.delete(quoteLineItems).where(and(eq(quoteLineItems.id, parsed.data.line_id), eq(quoteLineItems.quoteId, q.id)));
    await recalc(tx, q.id);
    await writeAudit({ action: 'quote.line_item_removed', orgId: s.orgId, actorUserId: s.sub, actorRole: staffRoleOf(s), entityType: 'quote', entityId: q.id });
    return { ok: true };
  });
}

export async function submitQuoteForApproval(input: unknown): Promise<Result> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  const parsed = SubmitForApproval.safeParse(input); if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return asConflict(() => withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) });
    if (!q || q.status !== 'draft') return { ok: false, error: { code: 'conflict_state', message: 'Only drafts can be submitted.' } };
    const lines = await tx.select().from(quoteLineItems).where(eq(quoteLineItems.quoteId, q.id));
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, q.orderId) });
    const needs = requiresFinanceApproval({ total_minor: q.totalMinor, discount_minor: q.discountMinor, has_manual_adjustment: lines.some((l) => l.kind === 'adjustment'), service_type: order?.serviceType ?? '', marked_requires_approval: q.requiresApproval });
    const target: QuoteStatus = needs ? 'pending_finance_approval' : 'approved';
    // needs → staff submits to finance queue; !needs → system auto-approves (draft→approved allowed for 'system').
    const role = needs ? staffRoleOf(s) : 'system';
    await transitionQuote({ id: q.id, orderId: q.orderId, orgId: q.orgId, status: 'draft' }, target, { userId: s.sub, role });
    return { ok: true };
  }));
}

export async function approveQuote(input: unknown): Promise<Result> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  if (!isFinance(s)) return { ok: false, error: { code: 'forbidden', message: 'Requires finance/ops/super_admin.' } };
  const parsed = ApproveQuote.safeParse(input); if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) });
    if (!q || q.status !== 'pending_finance_approval') return { ok: false, error: { code: 'conflict_state', message: 'Not pending approval.' } };
    await withPrivilegedDbAccess('quote.approval.record', async (db) => {
      await db.insert(quoteApprovals).values({ id: newId('qap'), quoteId: q.id, approverId: s.sub, decision: 'approve', reason: parsed.data.reason ?? null });
    });
    await transitionQuote({ id: q.id, orderId: q.orderId, orgId: q.orgId, status: 'pending_finance_approval' }, 'approved', { userId: s.sub, role: financeRoleOf(s) });
    return { ok: true };
  });
}

export async function rejectQuote(input: unknown): Promise<Result> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  if (!isFinance(s)) return { ok: false, error: { code: 'forbidden', message: 'Requires finance/ops/super_admin.' } };
  const parsed = RejectQuote.safeParse(input); if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Reason required.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) });
    if (!q || q.status !== 'pending_finance_approval') return { ok: false, error: { code: 'conflict_state', message: 'Not pending approval.' } };
    await withPrivilegedDbAccess('quote.approval.record', async (db) => {
      await db.insert(quoteApprovals).values({ id: newId('qap'), quoteId: q.id, approverId: s.sub, decision: parsed.data.decision, reason: parsed.data.reason });
    });
    await writeAudit({ action: 'quote.rejected', orgId: s.orgId, actorUserId: s.sub, actorRole: staffRoleOf(s), entityType: 'quote', entityId: q.id, after: { decision: parsed.data.decision, reason: parsed.data.reason } });
    await emitQuoteEvent('quote.rejected', { quote_id: q.id, order_id: q.orderId });
    await transitionQuote({ id: q.id, orderId: q.orderId, orgId: q.orgId, status: 'pending_finance_approval' }, 'draft', { userId: s.sub, role: financeRoleOf(s) });
    return { ok: true };
  });
}

export async function sendQuote(input: unknown): Promise<Result> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  const parsed = SendQuote.safeParse(input); if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) });
    if (!q || q.status !== 'approved') return { ok: false, error: { code: 'conflict_state', message: 'Quote must be approved to send.' } };
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, q.orderId) });
    if (parsed.data.expires_in_hours) {
      const exp = new Date(Date.now() + parsed.data.expires_in_hours * 3600_000);
      await withPrivilegedDbAccess('quote.set_expiry', async (db) => { await db.update(quotes).set({ expiresAt: exp }).where(eq(quotes.id, q.id)); });
    }
    await transitionQuote({ id: q.id, orderId: q.orderId, orgId: q.orgId, status: 'approved' }, 'sent_to_customer', { userId: s.sub, role: s.roles[0]! });
    // ORDER cascade (system): under_review -> quote_ready (only if legal)
    if (order && order.status === 'under_review') {
      await transitionOrderPrivileged({ id: order.id, orgId: order.orgId, status: order.status as OrderStatus }, 'quote_ready', { userId: s.sub, role: 'system' });
    }
    return { ok: true };
  });
}

export async function cancelQuote(input: unknown): Promise<Result> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  const parsed = QuoteIdParam.safeParse(input); if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) });
    if (!q) return { ok: false, error: { code: 'not_found', message: 'Quote not found.' } };
    if (!canTransitionQuoteStatus(q.status as QuoteStatus, 'cancelled', s.roles[0]!)) return { ok: false, error: { code: 'conflict_state', message: 'Cannot cancel.' } };
    await transitionQuote({ id: q.id, orderId: q.orderId, orgId: q.orgId, status: q.status as QuoteStatus }, 'cancelled', { userId: s.sub, role: s.roles[0]! });
    return { ok: true };
  });
}

export async function supersedeQuote(input: unknown): Promise<Result> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  const parsed = QuoteIdParam.safeParse(input); if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) });
    if (!q) return { ok: false, error: { code: 'not_found', message: 'Quote not found.' } };
    if (!canTransitionQuoteStatus(q.status as QuoteStatus, 'superseded', s.roles[0]!)) return { ok: false, error: { code: 'conflict_state', message: 'Cannot supersede.' } };
    await transitionQuote({ id: q.id, orderId: q.orderId, orgId: q.orgId, status: q.status as QuoteStatus }, 'superseded', { userId: s.sub, role: s.roles[0]! });
    return { ok: true };
  });
}

export async function getQuoteStatusHistory(quoteId: string): Promise<Result<unknown>> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const { quoteStatusHistory } = await import('@maralito/db');
    const rows = await tx.select().from(quoteStatusHistory).where(eq(quoteStatusHistory.quoteId, quoteId)).orderBy(desc(quoteStatusHistory.createdAt));
    return { ok: true, data: rows };
  });
}
export async function getQuoteApprovals(quoteId: string): Promise<Result<unknown>> {
  const { s, err } = await staffGuard(); if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const rows = await tx.select().from(quoteApprovals).where(eq(quoteApprovals.quoteId, quoteId)).orderBy(desc(quoteApprovals.createdAt));
    return { ok: true, data: rows };
  });
}
