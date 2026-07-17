import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, payments, stripeWebhookEvents, newId } from '@maralito/db';
import { isStripeConfigured, verifyStripeWebhook } from '@maralito/payments';
import { transitionPayment } from '@/server/payment-transitions';
import { isLegalPaymentTransition, type PaymentStatus } from '@/domain/payments/state-machine';
import { writeAudit } from '@/server/audit';
import { emitPaymentEvent } from '@/server/payment-events';
import {
  handleStripeRefundUpdate,
  handleStripeDispute,
  REFUND_WEBHOOK_EVENTS,
  DISPUTE_WEBHOOK_EVENTS,
} from '@/server/refund-webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Stripe SDK needs Node crypto — never the edge runtime

/** Supported Phase 4 events → target payment status. Anything else is safely ignored. */
const EVENT_MAP: Record<string, PaymentStatus> = {
  'payment_intent.succeeded': 'succeeded',
  'payment_intent.payment_failed': 'failed',
  'payment_intent.processing': 'processing',
  'payment_intent.canceled': 'canceled',
  'payment_intent.requires_action': 'requires_action',
};

type WebhookOutcome = 'completed' | 'ignored' | 'failed';
async function markWebhook(
  stripeEventId: string,
  status: WebhookOutcome,
  errorMessage?: string,
): Promise<void> {
  await withPrivilegedDbAccess('webhook.mark', async (db) => {
    await db
      .update(stripeWebhookEvents)
      .set({
        processingStatus: status,
        processedAt: new Date(),
        errorMessage: errorMessage ?? null,
      })
      .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
  });
}

/**
 * Stripe webhook (ADR-0010). Development-only. FAIL CLOSED on signature; idempotent via the
 * stripe_webhook_events ledger; routes the 5 supported payment_intent.* events through the
 * transitionPayment seam (succeeded → order awaiting_payment→paid). Never logs payload/secret/card data.
 * Privileged DB access only (no tenant session on a webhook).
 */
export async function POST(req: Request): Promise<Response> {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  const signature = req.headers.get('stripe-signature');
  const rawBody = await req.text(); // RAW body required for signature verification
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  // 1) Verify signature — fail closed.
  let event: Stripe.Event;
  try {
    event = verifyStripeWebhook(rawBody, signature);
  } catch {
    await writeAudit({
      action: 'payment.webhook_failed',
      entityType: 'stripe_event',
      after: { reason: 'invalid_signature' },
    });
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  // 2) Idempotency ledger — a re-delivered event is a no-op.
  const seen = await withPrivilegedDbAccess(
    'webhook.lookup',
    async (db) =>
      (
        await db
          .select()
          .from(stripeWebhookEvents)
          .where(eq(stripeWebhookEvents.stripeEventId, event.id))
          .limit(1)
      )[0] ?? null,
  );
  if (seen && seen.processingStatus !== 'received') {
    return NextResponse.json({ received: true, idempotent: true }, { status: 200 });
  }
  if (!seen) {
    await withPrivilegedDbAccess('webhook.record', async (db) => {
      await db
        .insert(stripeWebhookEvents)
        .values({
          id: newId('swe'),
          stripeEventId: event.id,
          eventType: event.type,
          apiVersion: event.api_version ?? null,
          livemode: event.livemode,
          processingStatus: 'received',
        })
        .onConflictDoNothing();
    });
  }
  await writeAudit({
    action: 'payment.webhook_received',
    entityType: 'stripe_event',
    entityId: event.id,
    after: { type: event.type },
  });
  await emitPaymentEvent('payment.webhook_received', {
    stripe_event_id: event.id,
    event_type: event.type,
  });

  // 3a) Phase 8D — refund + dispute events (idempotent; refunds settle the refund + cascade the payment,
  // disputes are RECORD-ONLY and never move money). Handled before the payment_intent routing below.
  if (REFUND_WEBHOOK_EVENTS.has(event.type) || DISPUTE_WEBHOOK_EVENTS.has(event.type)) {
    try {
      if (REFUND_WEBHOOK_EVENTS.has(event.type)) await handleStripeRefundUpdate(event);
      else await handleStripeDispute(event);
      await markWebhook(event.id, 'completed');
      return NextResponse.json({ received: true }, { status: 200 });
    } catch {
      await markWebhook(event.id, 'failed', 'refund_processing_error');
      await writeAudit({
        action: 'payment.webhook_failed',
        entityType: 'stripe_event',
        entityId: event.id,
        after: { reason: 'refund_processing_error', type: event.type },
      });
      return NextResponse.json({ error: 'processing_error' }, { status: 500 });
    }
  }

  // 3b) Route supported payment_intent events; ignore the rest safely.
  const target = EVENT_MAP[event.type];
  if (!target) {
    await markWebhook(event.id, 'ignored');
    await writeAudit({
      action: 'payment.webhook_ignored',
      entityType: 'stripe_event',
      entityId: event.id,
      after: { type: event.type },
    });
    await emitPaymentEvent('payment.webhook_ignored', {
      stripe_event_id: event.id,
      event_type: event.type,
    });
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  try {
    const pi = event.data.object as Stripe.PaymentIntent;
    const payment = await withPrivilegedDbAccess(
      'webhook.find_payment',
      async (db) =>
        (
          await db.select().from(payments).where(eq(payments.stripePaymentIntentId, pi.id)).limit(1)
        )[0] ?? null,
    );
    if (!payment) {
      await markWebhook(event.id, 'failed', 'no matching payment record');
      await writeAudit({
        action: 'payment.webhook_failed',
        entityType: 'stripe_event',
        entityId: event.id,
        after: { reason: 'no_matching_payment', payment_intent: pi.id },
      });
      await emitPaymentEvent('payment.webhook_failed', {
        stripe_event_id: event.id,
        reason: 'no_matching_payment',
      });
      return NextResponse.json({ received: true, unmatched: true }, { status: 200 });
    }

    const from = payment.status as PaymentStatus;
    // Only transition when legal; an out-of-order / re-delivered event is an idempotent no-op.
    if (isLegalPaymentTransition(from, target)) {
      await transitionPayment(
        {
          id: payment.id,
          orgId: payment.orgId,
          orderId: payment.orderId,
          quoteId: payment.quoteId,
          status: from,
        },
        target,
        { userId: 'system', role: 'system' },
        {
          eventType: `webhook.${event.type}`,
          providerEventId: event.id,
          payloadSummary: { payment_intent: pi.id, stripe_status: pi.status },
        },
      );
    }
    await markWebhook(event.id, 'completed');
    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    // Unexpected internal error → 500 so Stripe retries; record the failure (no sensitive detail).
    await markWebhook(event.id, 'failed', 'processing_error');
    await writeAudit({
      action: 'payment.webhook_failed',
      entityType: 'stripe_event',
      entityId: event.id,
      after: { reason: 'processing_error' },
    });
    await emitPaymentEvent('payment.webhook_failed', {
      stripe_event_id: event.id,
      reason: 'processing_error',
    });
    return NextResponse.json({ error: 'processing_error' }, { status: 500 });
  }
}
