import 'server-only';
import { eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, payments, inspections, deliveryPreparations, notificationOutbox, newId } from '@maralito/db';

/**
 * Phase 5 — receipt PLACEHOLDER seam (ADR-0011). Enqueues exactly ONE placeholder receipt row per
 * succeeded payment. Idempotent (unique `receipt:<payment_id>` + onConflictDoNothing). It does NOT
 * send anything, render a body, or call any provider, and it stores NO PII/secret/message body —
 * only safe references + queue metadata. Privileged server-only write (customers cannot write).
 *
 * Self-contained + defense-in-depth: it re-reads the payment and only enqueues when the payment is
 * actually `succeeded`, so it can never queue a receipt for failed/canceled/requires_action/processing.
 */
export async function queuePaymentReceipt(input: { paymentId: string }): Promise<void> {
  await withPrivilegedDbAccess('notifications.queue_receipt', async (db) => {
    const pay = (await db
      .select({ orgId: payments.orgId, customerId: payments.customerId, orderId: payments.orderId, status: payments.status })
      .from(payments).where(eq(payments.id, input.paymentId)).limit(1))[0];
    if (!pay || pay.status !== 'succeeded') return; // only succeeded payments get a receipt
    await db.insert(notificationOutbox).values({
      id: newId('nob'),
      orgId: pay.orgId, customerId: pay.customerId, orderId: pay.orderId, paymentId: input.paymentId,
      channel: 'receipt_placeholder', templateKey: 'payment_receipt', status: 'queued',
      idempotencyKey: `receipt:${input.paymentId}`,
    }).onConflictDoNothing({ target: notificationOutbox.idempotencyKey });
  });
}

/**
 * Phase 6 — inspection milestone notification PLACEHOLDER (ADR-0012). Enqueues exactly ONE placeholder
 * row per (inspection_id, status). Idempotent; self-contained (re-reads the inspection for safe refs);
 * NO provider/send/body/PII. References + status only.
 */
export async function queueInspectionUpdateNotification(input: { inspectionId: string; status: string }): Promise<void> {
  await withPrivilegedDbAccess('notifications.queue_inspection_update', async (db) => {
    const i = (await db.select({ orgId: inspections.orgId, customerId: inspections.customerId, orderId: inspections.orderId })
      .from(inspections).where(eq(inspections.id, input.inspectionId)).limit(1))[0];
    if (!i) return;
    await db.insert(notificationOutbox).values({
      id: newId('nob'), orgId: i.orgId, customerId: i.customerId, orderId: i.orderId, inspectionId: input.inspectionId,
      channel: 'lifecycle_placeholder', templateKey: 'inspection_update', status: 'queued',
      idempotencyKey: `inspection_update:${input.inspectionId}:${input.status}`,
    }).onConflictDoNothing({ target: notificationOutbox.idempotencyKey });
  });
}

/**
 * Phase 6 — delivery milestone notification PLACEHOLDER (ADR-0012). Enqueues exactly ONE placeholder
 * row per (delivery_prep_id, status). Idempotent; self-contained; NO provider/send/body/PII/address.
 */
export async function queueDeliveryUpdateNotification(input: { deliveryPrepId: string; status: string }): Promise<void> {
  await withPrivilegedDbAccess('notifications.queue_delivery_update', async (db) => {
    const d = (await db.select({ orgId: deliveryPreparations.orgId, customerId: deliveryPreparations.customerId, orderId: deliveryPreparations.orderId })
      .from(deliveryPreparations).where(eq(deliveryPreparations.id, input.deliveryPrepId)).limit(1))[0];
    if (!d) return;
    await db.insert(notificationOutbox).values({
      id: newId('nob'), orgId: d.orgId, customerId: d.customerId, orderId: d.orderId, deliveryPrepId: input.deliveryPrepId,
      channel: 'lifecycle_placeholder', templateKey: 'delivery_update', status: 'queued',
      idempotencyKey: `delivery_update:${input.deliveryPrepId}:${input.status}`,
    }).onConflictDoNothing({ target: notificationOutbox.idempotencyKey });
  });
}
