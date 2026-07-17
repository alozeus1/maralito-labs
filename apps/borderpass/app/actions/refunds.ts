'use server';
import { desc, eq } from 'drizzle-orm';
import { withTenant, refunds, paymentDisputes } from '@maralito/db';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import type { RefundStatus } from '@/domain/payments/refund-state-machine';

type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

/** Customer-safe, READ-ONLY refund projection. No internal fields, no Stripe ids, no history ledger. */
export interface CustomerRefundView {
  refund_id: string;
  amount_minor: number;
  currency: string;
  status: RefundStatus;
  created_at: string | null;
}
/** Customer-safe dispute projection (status only; never internal detail). */
export interface CustomerDisputeView {
  status: string;
  amount_minor: number;
  currency: string;
}

/**
 * Phase 8D (ADR-0015) — customer READ-ONLY refunds for an order. RLS scopes to the caller's own payments;
 * cross-customer/cross-org reads return nothing. No mutation path. Safe projection only.
 */
export async function getMyOrderRefunds(orderId: string): Promise<Result<CustomerRefundView[]>> {
  const s = await getAppSession();
  if (!s) return { ok: false, error: { code: 'unauthenticated', message: 'Sign in required.' } };
  if (!getServerEnv().DATABASE_URL)
    return { ok: false, error: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const rows = await tx
      .select({
        id: refunds.id,
        amountMinor: refunds.amountMinor,
        currency: refunds.currency,
        status: refunds.status,
        createdAt: refunds.createdAt,
      })
      .from(refunds)
      .where(eq(refunds.orderId, orderId)) // RLS additionally scopes to own customer_id
      .orderBy(desc(refunds.createdAt));
    return {
      ok: true as const,
      data: rows.map((r) => ({
        refund_id: r.id,
        amount_minor: r.amountMinor,
        currency: r.currency,
        status: r.status as RefundStatus,
        created_at: r.createdAt ? r.createdAt.toISOString() : null,
      })),
    };
  });
}

/** Phase 8D — customer READ-ONLY disputes for an order (status only). RLS-scoped to own payments. */
export async function getMyOrderDisputes(orderId: string): Promise<Result<CustomerDisputeView[]>> {
  const s = await getAppSession();
  if (!s) return { ok: false, error: { code: 'unauthenticated', message: 'Sign in required.' } };
  if (!getServerEnv().DATABASE_URL)
    return { ok: false, error: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const rows = await tx
      .select({
        status: paymentDisputes.status,
        amountMinor: paymentDisputes.amountMinor,
        currency: paymentDisputes.currency,
      })
      .from(paymentDisputes)
      .where(eq(paymentDisputes.orderId, orderId));
    return {
      ok: true as const,
      data: rows.map((r) => ({ status: r.status, amount_minor: r.amountMinor, currency: r.currency })),
    };
  });
}
