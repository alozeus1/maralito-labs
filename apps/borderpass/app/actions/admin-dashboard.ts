'use server';
import { desc, eq } from 'drizzle-orm';
import {
  withTenant,
  withPrivilegedDbAccess,
  orders,
  payments,
  customerProfiles,
} from '@maralito/db';
import { requireAdminAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';

type Result<T = void> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

async function staffGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try {
    requireAdminAccess(s);
  } catch {
    return { s: null, err: { code: 'forbidden', message: 'Not allowed.' } };
  }
  if (!getServerEnv().DATABASE_URL)
    return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

// Status groupings for the command center. Kept here (not the customer journey) because staff care
// about operational buckets, not the customer-facing milestone labels.
const DELIVERED = ['delivered'];
const ISSUES = ['rejected', 'inspection_failed', 'delivery_failed', 'cancelled', 'refunded'];
const REVIEW = [
  'submitted',
  'under_review',
  'missing_information',
  'quote_ready',
  'awaiting_payment',
];
const PIPELINE: { key: string; label: string }[] = [
  { key: 'placed', label: 'Placed' },
  { key: 'paid', label: 'Paid' },
  { key: 'purchased', label: 'Purchased' },
  { key: 'received', label: 'Received' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'crossing', label: 'Crossing' },
  { key: 'delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];
const STAGE_OF: Record<string, string> = {
  submitted: 'placed',
  under_review: 'placed',
  missing_information: 'placed',
  quote_ready: 'placed',
  awaiting_payment: 'placed',
  paid: 'paid',
  purchasing: 'paid',
  purchased: 'purchased',
  awaiting_package: 'purchased',
  received_el_paso: 'received',
  inspection_pending: 'inspection',
  inspection_passed: 'inspection',
  border_documentation_ready: 'crossing',
  ready_for_crossing: 'crossing',
  border_crossing: 'crossing',
  customs_processing: 'crossing',
  arrived_juarez: 'delivery',
  out_for_delivery: 'delivery',
  delivered: 'delivered',
};

export interface AdminMetrics {
  customers: number;
  orders: number;
  inProgress: number;
  delivered: number;
  issues: number;
  needsReview: number;
  incomeMinor: number;
  currency: string;
  pipeline: { key: string; label: string; count: number }[];
}

/** Aggregate command-center metrics: counts, income, and the order pipeline breakdown. */
export async function adminMetrics(): Promise<Result<AdminMetrics>> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };

  // Orders + payments are staff-readable under RLS.
  const { orderRows, incomeMinor } = await withTenant(
    { authUserId: s.sub, orgId: s.orgId },
    async (tx) => {
      const orderRows = await tx
        .select({ status: orders.status })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(2000);
      const payRows = await tx
        .select({ amount: payments.amountMinor, status: payments.status })
        .from(payments);
      const incomeMinor = payRows
        .filter((p) => p.status === 'succeeded')
        .reduce((sum, p) => sum + (p.amount ?? 0), 0);
      return { orderRows, incomeMinor };
    },
  );

  // customer_profiles has no staff RLS policy; count via a privileged read scoped to the org.
  const customers = await withPrivilegedDbAccess('admin.metrics.customer_count', async (db) => {
    const rows = await db
      .select({ id: customerProfiles.id })
      .from(customerProfiles)
      .where(eq(customerProfiles.orgId, s.orgId));
    return rows.length;
  });

  const statuses = orderRows.map((o) => o.status);
  const inStage = (stage: string) => statuses.filter((st) => STAGE_OF[st] === stage).length;

  return {
    ok: true,
    data: {
      customers,
      orders: statuses.length,
      delivered: statuses.filter((st) => DELIVERED.includes(st)).length,
      issues: statuses.filter((st) => ISSUES.includes(st)).length,
      needsReview: statuses.filter((st) => REVIEW.includes(st)).length,
      inProgress: statuses.filter(
        (st) => !DELIVERED.includes(st) && !ISSUES.includes(st) && st !== 'draft',
      ).length,
      incomeMinor,
      currency: 'USD',
      pipeline: PIPELINE.map((p) => ({ ...p, count: inStage(p.key) })),
    },
  };
}

export interface AdminCustomer {
  id: string;
  display_name: string;
  orders: number;
}

/** List customers with their order counts (privileged read, org-scoped, admin-guarded). */
export async function adminListCustomers(): Promise<Result<AdminCustomer[]>> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  const custRows = await withPrivilegedDbAccess('admin.list_customers', async (db) =>
    db
      .select({ id: customerProfiles.id, name: customerProfiles.displayName })
      .from(customerProfiles)
      .where(eq(customerProfiles.orgId, s.orgId)),
  );
  const orderRows = await withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) =>
    tx.select({ customerId: orders.customerId }).from(orders).limit(2000),
  );
  const counts = new Map<string, number>();
  for (const o of orderRows) counts.set(o.customerId, (counts.get(o.customerId) ?? 0) + 1);
  return {
    ok: true,
    data: custRows
      .map((c) => ({ id: c.id, display_name: c.name, orders: counts.get(c.id) ?? 0 }))
      .sort((a, b) => b.orders - a.orders),
  };
}

export interface AdminIssue {
  id: string;
  order_ref: string;
  status: string;
  service_type: string;
}

/** Orders currently in a problem state (rejected / failed / cancelled / refunded). */
export async function adminListIssues(): Promise<Result<AdminIssue[]>> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  const rows = await withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) =>
    tx
      .select({
        id: orders.id,
        order_ref: orders.orderRef,
        status: orders.status,
        service_type: orders.serviceType,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(500),
  );
  return { ok: true, data: rows.filter((o) => ISSUES.includes(o.status)) };
}
