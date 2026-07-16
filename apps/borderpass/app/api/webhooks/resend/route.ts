import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  withPrivilegedDbAccess,
  resendWebhookEvents,
  notificationOutbox,
  newId,
} from '@maralito/db';
import { verifyResendWebhook } from '@/server/resend-webhook';
import { suppressEmail } from '@/server/email-suppression';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // node crypto for signature verification — never the edge runtime

type OutboxStatus = (typeof notificationOutbox.$inferSelect)['status'];

// Resend event type → outbox delivery status. 'email.sent' is intentionally omitted: the row is already
// 'sent' after dispatch, and mapping it could regress a row that has already reached 'delivered'.
const STATUS_MAP: Record<string, OutboxStatus> = {
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

/**
 * Resend delivery webhook (Phase 8D). FAIL CLOSED on the Svix signature. Idempotent via the
 * resend_webhook_events ledger (svix-id unique) — a re-delivered event is a no-op. Advances the
 * correlated outbox row's delivery status, and suppresses hard bounces + complaints. Never logs the
 * payload (it contains recipient data): only the event type + svix id.
 */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const raw = await req.text(); // RAW body required for signature verification
  const headers = {
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
  };
  if (!secret || !verifyResendWebhook(raw, headers, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }
  const svixId = headers.id as string; // present: verify would have failed otherwise

  let event: { type?: string; data?: { email_id?: string; to?: string | string[] } };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const type = event.type ?? 'unknown';
  const providerMessageId = event.data?.email_id ?? null;

  // Idempotency: record the svix id first; a duplicate delivery loses the insert race and is a no-op.
  const inserted = await withPrivilegedDbAccess('resend.webhook:record', (db) =>
    db
      .insert(resendWebhookEvents)
      .values({
        id: newId('rwe'),
        svixId,
        eventType: type,
        providerMessageId,
        processingStatus: 'received',
      })
      .onConflictDoNothing({ target: resendWebhookEvents.svixId })
      .returning({ id: resendWebhookEvents.id }),
  );
  if (inserted.length === 0) {
    return NextResponse.json({ status: 'duplicate' }, { status: 200 });
  }

  try {
    // Suppress hard bounces + complaints. suppressEmail stores only a hash of the address.
    const toRaw = event.data?.to;
    const to = Array.isArray(toRaw) ? toRaw[0] : toRaw;
    if (to && (type === 'email.bounced' || type === 'email.complained')) {
      await suppressEmail(to, type === 'email.bounced' ? 'bounced' : 'complained');
    }

    // Advance the correlated outbox row, if this event maps to a delivery status and we have an id.
    const nextStatus = STATUS_MAP[type];
    if (providerMessageId && nextStatus) {
      await withPrivilegedDbAccess('resend.webhook:advance', (db) =>
        db
          .update(notificationOutbox)
          .set({ status: nextStatus, lastEventAt: new Date(), updatedAt: new Date() })
          .where(eq(notificationOutbox.providerMessageId, providerMessageId)),
      );
    }

    const handled = Boolean(nextStatus) || Boolean(to);
    await withPrivilegedDbAccess('resend.webhook:done', (db) =>
      db
        .update(resendWebhookEvents)
        .set({ processingStatus: handled ? 'processed' : 'ignored', processedAt: new Date() })
        .where(eq(resendWebhookEvents.svixId, svixId)),
    );
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch {
    await withPrivilegedDbAccess('resend.webhook:err', (db) =>
      db
        .update(resendWebhookEvents)
        .set({
          processingStatus: 'failed',
          processedAt: new Date(),
          errorMessage: 'processing_error',
        })
        .where(eq(resendWebhookEvents.svixId, svixId)),
    ).catch(() => {});
    return NextResponse.json({ error: 'processing_error' }, { status: 500 });
  }
}
