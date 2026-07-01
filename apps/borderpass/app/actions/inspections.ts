'use server';
import { desc, eq } from 'drizzle-orm';
import { withTenant, inspections } from '@maralito/db';
import { requireCustomerAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import type { InspectionStatus, InspectionResult } from '@/domain/inspections/state-machine';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: { code: string; message: string } };

async function custGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try { requireCustomerAccess(s); } catch { return { s: null, err: { code: 'forbidden', message: 'Not allowed.' } }; }
  if (!getServerEnv().DATABASE_URL) return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

/** Customer-safe inspection summary (NEVER staff_notes, history, actor metadata, or any PII). */
export interface InspectionSummaryView {
  order_id: string;
  inspection_id: string;
  status: InspectionStatus;
  result: InspectionResult | null;
  customer_summary: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
}

/** Read the inspection summary for one of the caller's OWN orders. Read-only; RLS-scoped. */
export async function getMyOrderInspection(orderId: string): Promise<Result<InspectionSummaryView | null>> {
  const { s, err } = await custGuard(); if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const insp = (await tx.select().from(inspections).where(eq(inspections.orderId, orderId)).orderBy(desc(inspections.createdAt)).limit(1))[0] ?? null; // RLS → own
    if (!insp) return { ok: true, data: null };
    const view: InspectionSummaryView = {
      order_id: insp.orderId,
      inspection_id: insp.id,
      status: insp.status as InspectionStatus,
      result: (insp.result as InspectionResult | null) ?? null,
      customer_summary: insp.customerSummary ?? null,
      scheduled_for: insp.scheduledFor ? insp.scheduledFor.toISOString() : null,
      completed_at: insp.completedAt ? insp.completedAt.toISOString() : null,
    };
    return { ok: true, data: view };
  });
}
