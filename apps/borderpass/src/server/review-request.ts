import 'server-only';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { withPrivilegedDbAccess, orders, customerProfiles } from '@maralito/db';
import { getServerEnv } from './env';
import { isResendConfigured, sendEmail } from './resend';
import { buildReviewEmail } from './review-email';
import { writeAudit } from './audit';

/**
 * Post-delivery review request. Resolves an order → its customer → the customer's email (Supabase auth
 * admin API), renders a localized review-request email, and sends it via Resend. The app owns the
 * lookup, the copy, and the transport; the n8n workflow only schedules the 1-day delay and calls in.
 *
 * PII NOTE: resolving a real customer address is real PII that the outbox path (ADR-0014 / Phase 8B)
 * defers until KMS + consent. This path is the explicitly-authorized override for the review flow. It
 * still fails closed: no Resend key, no service-role key, or no address → a safe no-op (never sends).
 * The recipient address is never logged or stored — the audit row keeps only the outcome + locale.
 */
export type ReviewRequestResult =
  | { status: 'sent'; id: string }
  | {
      status: 'skipped';
      reason: 'resend_unconfigured' | 'service_unconfigured' | 'no_review_url' | 'no_email';
    }
  | { status: 'not_found' }
  | { status: 'not_deliverable'; orderStatus: string }
  | { status: 'send_failed'; error: string; retryable: boolean };

export async function sendOrderReviewRequest(orderId: string): Promise<ReviewRequestResult> {
  const env = getServerEnv();

  // 1) Resolve order + customer in one privileged read (no tenant session on an automation call).
  const rows = await withPrivilegedDbAccess('automation.review_request:read', (db) =>
    db
      .select({
        orderStatus: orders.status,
        orderRef: orders.orderRef,
        orgId: orders.orgId,
        authUserId: customerProfiles.authUserId,
        displayName: customerProfiles.displayName,
        language: customerProfiles.language,
      })
      .from(orders)
      .innerJoin(customerProfiles, eq(orders.customerId, customerProfiles.id))
      .where(eq(orders.id, orderId))
      .limit(1),
  );
  const row = rows[0];
  if (!row) return { status: 'not_found' };

  // 2) Defense in depth: only a delivered order earns a review request, even if n8n's filter changes.
  if (row.orderStatus !== 'delivered') {
    return { status: 'not_deliverable', orderStatus: row.orderStatus };
  }

  // 3) Config gates — every one is a safe no-op (never a real send) when unset.
  if (!isResendConfigured()) return { status: 'skipped', reason: 'resend_unconfigured' };
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return { status: 'skipped', reason: 'service_unconfigured' };
  const reviewUrl =
    env.BORDERPASS_REVIEW_URL ??
    (env.BORDERPASS_APP_URL ? `${env.BORDERPASS_APP_URL}/orders/${orderId}/quote` : null);
  if (!reviewUrl) return { status: 'skipped', reason: 'no_review_url' };

  // 4) Resolve the customer's email from Supabase auth (real PII — authorized override).
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.getUserById(row.authUserId);
  const email = data?.user?.email;
  if (error || !email) return { status: 'skipped', reason: 'no_email' };

  // 5) Localized copy (per-customer language; Spanish default) + send.
  const locale = row.language === 'en' ? 'en' : 'es';
  const { subject, html } = buildReviewEmail({
    locale,
    customerName: row.displayName,
    orderRef: row.orderRef,
    reviewUrl,
  });
  const result = await sendEmail({ to: email, subject, html });

  // 6) Audit the egress — outcome + locale only, never the recipient address.
  await writeAudit({
    action: 'automation.review_request',
    orgId: row.orgId,
    entityType: 'order',
    entityId: orderId,
    after: { outcome: result.ok ? 'sent' : 'failed', locale },
  });

  if (result.ok) return { status: 'sent', id: result.id };
  return { status: 'send_failed', error: result.error, retryable: result.retryable };
}
