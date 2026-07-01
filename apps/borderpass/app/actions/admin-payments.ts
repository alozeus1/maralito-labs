'use server';
import { desc, eq } from 'drizzle-orm';
import { withTenant, payments, quotes, orders } from '@maralito/db';
import { requireAdminAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { writeAudit } from '@/server/audit';
import { toPaymentDisplayState, type PaymentDisplayState } from '@/domain/payments/display';
import type { PaymentStatus } from '@/domain/payments/state-machine';
import type { OrderStatus } from '@/domain/orders/state-machine';

type Result<T = void> =
  { ok: true; data?: T } | { ok: false; error: { code: string; message: string } };

/** Staff-safe, READ-ONLY payment summary. No client_secret, events, ledger, card data, or PII. */
export interface StaffPaymentSummary {
  order_id: string;
  quote_id: string | null;
  payment_id: string | null;
  amount_minor: number | null;
  currency: string | null;
  payment_status: PaymentStatus | null;
  display_state: PaymentDisplayState;
  updated_at: string | null;
}

async function staffGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try {
    requireAdminAccess(s);
  } catch {
    await writeAudit({ action: 'payment.unauthorized_access_attempt', actorUserId: s?.sub });
    return { s: null, err: { code: 'not_found', message: 'Not found.' } };
  }
  if (!getServerEnv().DATABASE_URL)
    return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

/**
 * READ-ONLY org-scoped payment summary for staff/admin/ops/finance. RLS (payments/orders/quotes staff
 * policies) scopes everything to the caller's org — cross-org reads return nothing. No mutation path.
 */
export async function getOrderPaymentForStaff(
  orderId: string,
): Promise<Result<StaffPaymentSummary>> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) }); // staff RLS → org-scoped
    if (!order) return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
    const q = await tx.query.quotes.findFirst({ where: eq(quotes.orderId, orderId) });
    const pay =
      (
        await tx
          .select()
          .from(payments)
          .where(eq(payments.orderId, orderId))
          .orderBy(desc(payments.createdAt))
          .limit(1)
      )[0] ?? null;

    const summary: StaffPaymentSummary = {
      order_id: order.id,
      quote_id: q?.id ?? null,
      payment_id: pay?.id ?? null,
      amount_minor: q?.totalMinor ?? pay?.amountMinor ?? null,
      currency: q?.currency ?? pay?.currency ?? null,
      payment_status: (pay?.status as PaymentStatus) ?? null,
      display_state: toPaymentDisplayState(
        (pay?.status as PaymentStatus) ?? null,
        order.status as OrderStatus,
      ),
      updated_at: pay?.updatedAt ? pay.updatedAt.toISOString() : null,
    };
    return { ok: true, data: summary };
  });
}
