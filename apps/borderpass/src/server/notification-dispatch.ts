import 'server-only';
import { and, eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, notificationOutbox } from '@maralito/db';
import { sendEmail, isResendConfigured } from './resend';

/**
 * Phase 8C — outbox dispatcher. Reads `queued` notification_outbox rows and sends them via Resend,
 * then marks each `sent` or `failed`. Idempotent per row (claims `queued → sending` first, so a
 * concurrent run won't double-send the same row).
 *
 * PII GATE (ADR-0014 / 8B): the outbox intentionally stores NO recipient address. Turning a row into
 * an email needs the customer's real contact info, which is real PII and stays gated on Phase 8B
 * (KMS). We therefore INJECT a `resolveRecipient` function: in dev it returns a synthetic address; a
 * real-recipient resolver is only wired after 8B + consent handling. With no resolver (default), rows
 * are skipped — never sent — so this is safe to ship dark.
 */

type OutboxRow = typeof notificationOutbox.$inferSelect;

export interface DispatchOptions {
  /** Max rows to process in one pass. */
  limit?: number;
  /** Resolve a row to a recipient email, or null to skip. Real-PII resolvers are 8B-gated. */
  resolveRecipient: (row: OutboxRow) => Promise<string | null>;
  /** Absolute base URL for order links in the email body (e.g. the preview host). */
  appBaseUrl?: string;
}

export interface DispatchSummary {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
}

/** Minimal, NON-PII email bodies keyed by template. Links to the order; no names/amounts/addresses. */
function renderTemplate(row: OutboxRow, appBaseUrl: string): { subject: string; html: string } {
  const orderLink = `${appBaseUrl}/orders/${row.orderId}/quote`;
  const view = `<p><a href="${orderLink}">View your order</a></p>`;
  switch (row.templateKey) {
    case 'payment_receipt':
      return {
        subject: 'BorderPass — payment received',
        html: `<p>We received your payment.</p>${view}`,
      };
    case 'inspection_update':
      return {
        subject: 'BorderPass — inspection update',
        html: `<p>There is an update on your inspection.</p>${view}`,
      };
    case 'delivery_update':
      return {
        subject: 'BorderPass — delivery update',
        html: `<p>There is an update on your delivery.</p>${view}`,
      };
    default:
      return {
        subject: 'BorderPass — order update',
        html: `<p>There is an update on your order.</p>${view}`,
      };
  }
}

export async function dispatchQueuedNotifications(opts: DispatchOptions): Promise<DispatchSummary> {
  const summary: DispatchSummary = { scanned: 0, sent: 0, failed: 0, skipped: 0 };
  if (!isResendConfigured()) return summary; // ship-dark: no provider configured → no-op

  const limit = opts.limit ?? 50;
  const base = opts.appBaseUrl ?? process.env.BORDERPASS_APP_BASE_URL ?? '';

  const rows = await withPrivilegedDbAccess('notifications.dispatch:read', (db) =>
    db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.status, 'queued'))
      .limit(limit),
  );
  summary.scanned = rows.length;

  for (const row of rows) {
    const to = await opts.resolveRecipient(row);
    if (!to) {
      summary.skipped++;
      continue;
    }

    // Claim the row (queued → sending) so a concurrent pass can't double-send it.
    const claimed = await withPrivilegedDbAccess('notifications.dispatch:claim', (db) =>
      db
        .update(notificationOutbox)
        .set({ status: 'sending', updatedAt: new Date() })
        .where(and(eq(notificationOutbox.id, row.id), eq(notificationOutbox.status, 'queued')))
        .returning({ id: notificationOutbox.id }),
    );
    if (claimed.length === 0) {
      summary.skipped++; // someone else claimed it
      continue;
    }

    const { subject, html } = renderTemplate(row, base);
    const result = await sendEmail({ to, subject, html });
    // Failed + retryable → back to `queued` for a later pass; non-retryable → `failed`.
    const nextStatus = result.ok ? 'sent' : result.retryable ? 'queued' : 'failed';
    await withPrivilegedDbAccess('notifications.dispatch:mark', (db) =>
      db
        .update(notificationOutbox)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(notificationOutbox.id, row.id)),
    );
    if (result.ok) summary.sent++;
    else if (nextStatus === 'failed') summary.failed++;
    else summary.skipped++;
  }

  return summary;
}
