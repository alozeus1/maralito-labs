'use server';
import { desc, eq } from 'drizzle-orm';
import {
  CreateInspection,
  InspectionIdParam,
  PassInspection,
  FailInspection,
} from '@maralito/schemas';
import { withTenant, inspections, orders, newId } from '@maralito/db';
import { requireAdminAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { writeAudit } from '@/server/audit';
import { transitionInspection } from '@/server/inspection-transitions';
import { emitInspectionEvent } from '@/server/inspection-events';
import { canStartInspection } from '@/domain/inspections/rules';
import {
  IllegalInspectionTransitionError,
  type InspectionStatus,
  type InspectionResult,
} from '@/domain/inspections/state-machine';
import type { OrderStatus } from '@/domain/orders/state-machine';

type Result<T = void> =
  { ok: true; data?: T } | { ok: false; error: { code: string; message: string } };

/** Staff-visible inspection view (READ-ONLY). Staff may see staff_notes (operational); no PII/documents stored. */
export interface StaffInspectionView {
  inspection_id: string;
  status: InspectionStatus;
  result: InspectionResult | null;
  staff_notes: string | null;
  customer_summary: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
}

async function staffGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try {
    requireAdminAccess(s);
  } catch {
    await writeAudit({ action: 'inspection.unauthorized_access_attempt', actorUserId: s?.sub });
    return { s: null, err: { code: 'not_found', message: 'Not found.' } };
  }
  if (!getServerEnv().DATABASE_URL)
    return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

/** Maps an IllegalInspectionTransitionError (only that) to a structured conflict result. */
function asConflict<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  return fn().catch((e) => {
    if (e instanceof IllegalInspectionTransitionError)
      return {
        ok: false,
        error: { code: 'conflict_state', message: 'Illegal inspection transition.' },
      } as Result<T>;
    throw e;
  });
}

/** Staff creates an inspection for a PAID (or post-paid) order. Customers cannot call this. */
export async function createInspection(input: unknown): Promise<Result<{ inspection_id: string }>> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  const parsed = CreateInspection.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: 'validation_failed', message: 'Invalid request.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, parsed.data.order_id) }); // staff RLS → org
    if (!order) return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
    if (!canStartInspection(order.status as OrderStatus))
      return {
        ok: false,
        error: {
          code: 'conflict_state',
          message: 'Order is not ready for inspection (must be paid).',
        },
      };
    const id = newId('insp');
    await tx.insert(inspections).values({
      id,
      orgId: s.orgId,
      customerId: order.customerId,
      orderId: order.id,
      status: 'scheduled',
    });
    await writeAudit({
      action: 'inspection.created',
      orgId: s.orgId,
      actorUserId: s.sub,
      actorRole: s.roles[0]!,
      entityType: 'inspection',
      entityId: id,
    });
    await emitInspectionEvent('inspection.created', {
      inspection_id: id,
      order_id: order.id,
      status: 'scheduled',
    });
    return { ok: true, data: { inspection_id: id } };
  });
}

/** Shared: load an org inspection (staff RLS) and run a transition via the seam. */
async function runTransition(
  inspectionId: string,
  to: InspectionStatus,
  meta?: { reason?: string; customerSummary?: string },
): Promise<Result> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  return asConflict(() =>
    withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
      const i = await tx.query.inspections.findFirst({ where: eq(inspections.id, inspectionId) }); // staff RLS → org
      if (!i) return { ok: false, error: { code: 'not_found', message: 'Inspection not found.' } };
      await transitionInspection(
        { id: i.id, orgId: i.orgId, orderId: i.orderId, status: i.status as InspectionStatus },
        to,
        { userId: s.sub, role: s.roles[0]! },
        meta,
      );
      return { ok: true };
    }),
  );
}

export async function startInspection(input: unknown): Promise<Result> {
  const p = InspectionIdParam.safeParse(input);
  if (!p.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return runTransition(p.data.inspection_id, 'in_progress');
}
export async function holdInspection(input: unknown): Promise<Result> {
  const p = InspectionIdParam.safeParse(input);
  if (!p.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return runTransition(p.data.inspection_id, 'on_hold');
}
export async function resumeInspection(input: unknown): Promise<Result> {
  const p = InspectionIdParam.safeParse(input);
  if (!p.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return runTransition(p.data.inspection_id, 'in_progress');
}
export async function passInspection(input: unknown): Promise<Result> {
  const p = PassInspection.safeParse(input);
  if (!p.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  const meta =
    p.data.customer_summary !== undefined
      ? { customerSummary: p.data.customer_summary }
      : undefined;
  return runTransition(p.data.inspection_id, 'passed', meta);
}
export async function failInspection(input: unknown): Promise<Result> {
  const p = FailInspection.safeParse(input);
  if (!p.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  const meta = {
    ...(p.data.reason !== undefined ? { reason: p.data.reason } : {}),
    ...(p.data.customer_summary !== undefined ? { customerSummary: p.data.customer_summary } : {}),
  };
  return runTransition(p.data.inspection_id, 'failed', meta);
}

/** READ-ONLY org-scoped inspection summary for the admin panel. No mutation. */
export async function getOrderInspectionForStaff(
  orderId: string,
): Promise<Result<StaffInspectionView | null>> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const i =
      (
        await tx
          .select()
          .from(inspections)
          .where(eq(inspections.orderId, orderId))
          .orderBy(desc(inspections.createdAt))
          .limit(1)
      )[0] ?? null;
    if (!i) return { ok: true, data: null };
    const view: StaffInspectionView = {
      inspection_id: i.id,
      status: i.status as InspectionStatus,
      result: (i.result as InspectionResult | null) ?? null,
      staff_notes: i.staffNotes ?? null,
      customer_summary: i.customerSummary ?? null,
      scheduled_for: i.scheduledFor ? i.scheduledFor.toISOString() : null,
      completed_at: i.completedAt ? i.completedAt.toISOString() : null,
    };
    return { ok: true, data: view };
  });
}
