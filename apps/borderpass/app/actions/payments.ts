'use server';
import { and, desc, eq } from 'drizzle-orm';
import { InitiateQuotePayment } from '@maralito/schemas';
import { withTenant, withPrivilegedDbAccess, quotes, orders, payments, newId } from '@maralito/db';
import { requireCustomerAccess } from '@maralito/auth';
import { isStripeConfigured, createPaymentIntent, retrievePaymentIntent, type SafePaymentIntentView } from '@maralito/payments';
import { canInitiatePayment } from '@/domain/payments/rules';
import { toPaymentDisplayState, type PaymentSummaryView } from '@/domain/payments/display';
import { getCustomerVisibleQuoteStatus, type QuoteStatus } from '@/domain/quotes/state-machine';
import type { PaymentStatus } from '@/domain/payments/state-machine';
import type { OrderStatus } from '@/domain/orders/state-machine';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { writeAudit } from '@/server/audit';
import { emitPaymentEvent } from '@/server/payment-events';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: { code: string; message: string } };

async function custGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try { requireCustomerAccess(s); } catch { return { s: null, err: { code: 'forbidden', message: 'Not allowed.' } }; }
  if (!getServerEnv().DATABASE_URL) return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

/** Stable idempotency key per quote — Stripe + our payments row both dedupe on this. */
const idemKeyFor = (quoteId: string) => `pi_${quoteId}`;

/**
 * Read the customer-safe payment summary for one of the caller's OWN orders. Read-only.
 * Returns the accepted-quote amount + the authoritative (webhook-driven) payment status mapped to a
 * display state. NEVER exposes payment_events, the webhook ledger, internal_notes, or any secret.
 * RLS scopes the quote/order/payment to the caller's own rows.
 */
export async function getMyOrderPaymentSummary(orderId: string): Promise<Result<PaymentSummaryView>> {
  const { s, err } = await custGuard(); if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) }); // RLS → own order
    if (!order) return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.orderId, orderId) }); // RLS → own quote
    if (!q) return { ok: false, error: { code: 'not_found', message: 'Quote not found.' } };
    // Latest payment for this order (RLS → own payments only). May be null before initiation.
    const pay = (await tx.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt)).limit(1))[0] ?? null;

    const summary: PaymentSummaryView = {
      order_id: order.id,
      quote: { quote_id: q.id, currency: q.currency, total_minor: q.totalMinor, status: getCustomerVisibleQuoteStatus(q.status as QuoteStatus) },
      amount_due_minor: q.totalMinor,
      currency: q.currency,
      payment: pay ? { payment_id: pay.id, status: pay.status as PaymentStatus } : null,
      display_state: toPaymentDisplayState((pay?.status as PaymentStatus) ?? null, order.status as OrderStatus),
    };
    return { ok: true, data: summary };
  });
}

/**
 * Customer initiates payment for an ACCEPTED quote whose order is AWAITING_PAYMENT.
 * Ownership + preconditions are enforced via withTenant (RLS scopes the quote to the caller's own
 * order). The payment record + Stripe PaymentIntent are created idempotently via the privileged seam
 * (customers cannot write payment rows under RLS). Returns ONLY safe client-facing fields — no secret.
 */
export async function initiateQuotePayment(input: unknown): Promise<Result<SafePaymentIntentView>> {
  const { s, err } = await custGuard(); if (!s) return { ok: false, error: err! };
  const parsed = InitiateQuotePayment.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid request.' } };

  // 1) Tenant-scoped read: ownership (RLS) + preconditions.
  const loaded = await withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.id, parsed.data.quote_id) }); // RLS → own order only
    if (!q) return { code: 'not_found' as const };
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, q.orderId) });
    if (!order) return { code: 'not_found' as const };
    const chk = canInitiatePayment({ quoteStatus: q.status as QuoteStatus, orderStatus: order.status as OrderStatus, totalMinor: q.totalMinor });
    if (!chk.ok) return { code: chk.code };
    return { q, order };
  });
  if ('code' in loaded) {
    const map: Record<string, string> = {
      not_found: 'Quote not found.',
      quote_not_accepted: 'Quote is not accepted.',
      order_not_awaiting_payment: 'Order is not awaiting payment.',
      invalid_amount: 'Quote amount is invalid.',
    };
    return { ok: false, error: { code: loaded.code === 'not_found' ? 'not_found' : 'conflict_state', message: map[loaded.code] ?? 'Cannot initiate payment.' } };
  }
  const { q } = loaded;

  // 2) Fail closed (gracefully) when Stripe isn't configured in this dev environment.
  if (!isStripeConfigured()) {
    return { ok: false, error: { code: 'dependency_unavailable', message: 'Payments are not configured in this environment.' } };
  }

  const idem = idemKeyFor(q.id);

  // 3) Idempotent get-or-create. Stripe network calls run OUTSIDE the DB transaction.
  const existing = await withPrivilegedDbAccess('payment.lookup', async (db) =>
    (await db.select().from(payments).where(and(eq(payments.provider, 'stripe'), eq(payments.idempotencyKey, idem))).limit(1))[0] ?? null,
  );

  let paymentId: string;
  let statusOut: string;
  let amountOut: number;
  let currencyOut: string;
  let clientSecret: string | null;
  let created = false;

  if (existing?.stripePaymentIntentId) {
    const pi = await retrievePaymentIntent(existing.stripePaymentIntentId);
    paymentId = existing.id; statusOut = existing.status; amountOut = existing.amountMinor;
    currencyOut = existing.currency; clientSecret = pi.clientSecret;
  } else {
    paymentId = existing?.id ?? newId('pay');
    amountOut = existing?.amountMinor ?? q.totalMinor;
    currencyOut = existing?.currency ?? q.currency;
    const pi = await createPaymentIntent({
      amountMinor: amountOut,
      currency: currencyOut.toLowerCase(),
      idempotencyKey: idem,
      metadata: { org_id: q.orgId, customer_id: q.customerId, order_id: q.orderId, quote_id: q.id, payment_id: paymentId },
    });
    clientSecret = pi.clientSecret;

    if (existing) {
      // We already had a payment row (without an intent) — attach the intent.
      await withPrivilegedDbAccess('payment.initiate', async (db) => {
        await db.update(payments).set({ stripePaymentIntentId: pi.id, updatedAt: new Date() }).where(eq(payments.id, existing.id));
      });
      statusOut = existing.status;
    } else {
      // First creation. Insert idempotently on (provider, idempotency_key). If a concurrent
      // initiation for the same quote won the race, ADOPT its row instead of creating a duplicate —
      // the shared Stripe idempotency key means both refer to the SAME PaymentIntent, so our
      // client_secret is valid. Unexpected DB errors still propagate (fail closed).
      const res = await withPrivilegedDbAccess('payment.initiate', async (db) => {
        const inserted = await db.insert(payments).values({
          id: paymentId, orgId: q.orgId, customerId: q.customerId, orderId: q.orderId, quoteId: q.id,
          provider: 'stripe', status: 'requires_payment', amountMinor: amountOut, currency: q.currency,
          idempotencyKey: idem, stripePaymentIntentId: pi.id,
        }).onConflictDoNothing({ target: [payments.provider, payments.idempotencyKey] }).returning({ id: payments.id });
        if (inserted.length > 0) return { kind: 'created' as const };
        const winner = (await db.select().from(payments).where(and(eq(payments.provider, 'stripe'), eq(payments.idempotencyKey, idem))).limit(1))[0];
        return winner ? { kind: 'adopted' as const, winner } : { kind: 'conflict' as const };
      });
      if (res.kind === 'created') {
        statusOut = 'requires_payment';
        created = true;
      } else if (res.kind === 'adopted') {
        paymentId = res.winner.id; amountOut = res.winner.amountMinor; currencyOut = res.winner.currency; statusOut = res.winner.status;
        // created stays false → no duplicate audit/event; no second payment row; no second Stripe intent.
      } else {
        // Conflict but the row vanished on re-read — fail closed rather than guess.
        return { ok: false, error: { code: 'conflict_state', message: 'Could not initiate payment, please retry.' } };
      }
    }
  }

  // 4) Audit + event only on first creation (never log client_secret / card data).
  if (created) {
    await writeAudit({
      action: 'payment.intent_created', orgId: q.orgId, actorUserId: s.sub, actorRole: 'customer',
      entityType: 'payment', entityId: paymentId, after: { amount_minor: amountOut, currency: currencyOut },
    });
    await emitPaymentEvent('payment.intent_created', { payment_id: paymentId, order_id: q.orderId, quote_id: q.id });
  }

  // 5) Safe client-facing view only.
  return { ok: true, data: { payment_id: paymentId, status: statusOut, amount_minor: amountOut, currency: currencyOut, client_secret: clientSecret } };
}
