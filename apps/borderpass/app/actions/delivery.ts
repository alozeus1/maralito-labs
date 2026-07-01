'use server';
import { desc, eq } from 'drizzle-orm';
import { withTenant, deliveryPreparations } from '@maralito/db';
import { requireCustomerAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import type { DeliveryPrepStatus } from '@/domain/delivery/state-machine';

type Result<T = void> =
  { ok: true; data?: T } | { ok: false; error: { code: string; message: string } };

async function custGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try {
    requireCustomerAccess(s);
  } catch {
    return { s: null, err: { code: 'forbidden', message: 'Not allowed.' } };
  }
  if (!getServerEnv().DATABASE_URL)
    return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

/**
 * Customer-safe delivery summary. NEVER includes staff_notes, delivery_address_ref, history, actor
 * metadata, or any address/PII content.
 */
export interface DeliverySummaryView {
  order_id: string;
  delivery_prep_id: string;
  status: DeliveryPrepStatus;
  customer_summary: string | null;
  scheduled_window_start: string | null;
  scheduled_window_end: string | null;
  updated_at: string | null;
}

/** Read the delivery summary for one of the caller's OWN orders. Read-only; RLS-scoped. */
export async function getMyOrderDelivery(
  orderId: string,
): Promise<Result<DeliverySummaryView | null>> {
  const { s, err } = await custGuard();
  if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const d =
      (
        await tx
          .select()
          .from(deliveryPreparations)
          .where(eq(deliveryPreparations.orderId, orderId))
          .orderBy(desc(deliveryPreparations.createdAt))
          .limit(1)
      )[0] ?? null; // RLS → own
    if (!d) return { ok: true, data: null };
    const view: DeliverySummaryView = {
      order_id: d.orderId,
      delivery_prep_id: d.id,
      status: d.status as DeliveryPrepStatus,
      customer_summary: d.customerSummary ?? null,
      scheduled_window_start: d.scheduledWindowStart ? d.scheduledWindowStart.toISOString() : null,
      scheduled_window_end: d.scheduledWindowEnd ? d.scheduledWindowEnd.toISOString() : null,
      updated_at: d.updatedAt ? d.updatedAt.toISOString() : null,
    };
    return { ok: true, data: view };
  });
}
