import 'server-only';
import {
  withPrivilegedDbAccess,
  customerProfiles,
  orders,
  notificationOutbox,
  newId,
  ORDER_SERVICE_TYPES,
} from '@maralito/db';

/**
 * DEV-ONLY: enqueue ONE synthetic `queued` notification so the outbox dispatcher can be exercised
 * end-to-end without running a full order→payment flow. Creates a synthetic customer_profile + order
 * in the default org, then a `payment_receipt` outbox row. Synthetic data only — no real PII.
 * Idempotent-ish: unique auth_user_id per call, onConflictDoNothing on the outbox idempotency key.
 */
export async function seedSyntheticNotification(): Promise<{ orderId: string; outboxId: string }> {
  const orgId = process.env.BORDERPASS_DEFAULT_CUSTOMER_ORG_ID ?? 'org_dev0000000bp';
  const authUserId = crypto.randomUUID();
  const custId = newId('cust');
  const orderId = newId('ord');
  const outboxId = newId('nob');
  await withPrivilegedDbAccess('dev.seed_synthetic_notification', async (db) => {
    await db
      .insert(customerProfiles)
      .values({ id: custId, authUserId, orgId, displayName: 'Synthetic Tester', language: 'es' })
      .onConflictDoNothing();
    await db
      .insert(orders)
      .values({
        id: orderId,
        orderRef: `BP-DEV-${orderId.slice(-6)}`,
        customerId: custId,
        orgId,
        serviceType: ORDER_SERVICE_TYPES[0],
        correlationId: orderId,
      })
      .onConflictDoNothing();
    await db
      .insert(notificationOutbox)
      .values({
        id: outboxId,
        orgId,
        customerId: custId,
        orderId,
        channel: 'receipt_placeholder',
        templateKey: 'payment_receipt',
        status: 'queued',
        idempotencyKey: `dev-seed:${orderId}`,
      })
      .onConflictDoNothing({ target: notificationOutbox.idempotencyKey });
  });
  return { orderId, outboxId };
}
