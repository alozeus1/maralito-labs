'use server';
import { desc, eq } from 'drizzle-orm';
import {
  CreateDeliveryPrep,
  DeliveryPrepIdParam,
  MarkDeliveryPrep,
  ScheduleDelivery,
  HandOffDelivery,
} from '@maralito/schemas';
import { withTenant, deliveryPreparations, orders, newId } from '@maralito/db';
import { requireAdminAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { writeAudit } from '@/server/audit';
import { transitionDeliveryPrep } from '@/server/delivery-transitions';
import { emitDeliveryEvent } from '@/server/delivery-events';
import { canCreateDeliveryPrep } from '@/domain/delivery/rules';
import {
  IllegalDeliveryPrepTransitionError,
  type DeliveryPrepStatus,
} from '@/domain/delivery/state-machine';
import type { OrderStatus } from '@/domain/orders/state-machine';

type Result<T = void> =
  { ok: true; data?: T } | { ok: false; error: { code: string; message: string } };

/** Staff-visible delivery view (READ-ONLY). Staff may see the opaque address ref + staff_notes; no PII stored. */
export interface StaffDeliveryView {
  delivery_prep_id: string;
  status: DeliveryPrepStatus;
  delivery_address_ref: string | null; // opaque reference only
  scheduled_window_start: string | null;
  scheduled_window_end: string | null;
  staff_notes: string | null;
  customer_summary: string | null;
}

async function staffGuard() {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try {
    requireAdminAccess(s);
  } catch {
    await writeAudit({ action: 'delivery.unauthorized_access_attempt', actorUserId: s?.sub });
    return { s: null, err: { code: 'not_found', message: 'Not found.' } };
  }
  if (!getServerEnv().DATABASE_URL)
    return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
}

function asConflict<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  return fn().catch((e) => {
    if (e instanceof IllegalDeliveryPrepTransitionError)
      return {
        ok: false,
        error: { code: 'conflict_state', message: 'Illegal delivery-prep transition.' },
      } as Result<T>;
    throw e;
  });
}

type TransitionMeta = {
  reason?: string;
  customerSummary?: string;
  scheduledWindowStart?: Date;
  scheduledWindowEnd?: Date;
};

/** Staff creates a delivery-prep for a post-inspection order (opaque address ref only). */
export async function createDeliveryPrep(
  input: unknown,
): Promise<Result<{ delivery_prep_id: string }>> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  const p = CreateDeliveryPrep.safeParse(input);
  if (!p.success)
    return { ok: false, error: { code: 'validation_failed', message: 'Invalid request.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.id, p.data.order_id) }); // staff RLS → org
    if (!order) return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
    if (!canCreateDeliveryPrep(order.status as OrderStatus))
      return {
        ok: false,
        error: {
          code: 'conflict_state',
          message: 'Order is not ready for delivery preparation (inspection must have passed).',
        },
      };
    const id = newId('dlp');
    await tx.insert(deliveryPreparations).values({
      id,
      orgId: s.orgId,
      customerId: order.customerId,
      orderId: order.id,
      status: 'pending',
      ...(p.data.delivery_address_ref !== undefined
        ? { deliveryAddressRef: p.data.delivery_address_ref }
        : {}),
    });
    await writeAudit({
      action: 'delivery.prep_created',
      orgId: s.orgId,
      actorUserId: s.sub,
      actorRole: s.roles[0]!,
      entityType: 'delivery_preparation',
      entityId: id,
    });
    await emitDeliveryEvent('delivery.prep_created', {
      delivery_prep_id: id,
      order_id: order.id,
      status: 'pending',
    });
    return { ok: true, data: { delivery_prep_id: id } };
  });
}

async function runTransition(
  prepId: string,
  to: DeliveryPrepStatus,
  meta?: TransitionMeta,
): Promise<Result> {
  const { s, err } = await staffGuard();
  if (!s) return { ok: false, error: err! };
  return asConflict(() =>
    withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
      const d = await tx.query.deliveryPreparations.findFirst({
        where: eq(deliveryPreparations.id, prepId),
      }); // staff RLS → org
      if (!d)
        return {
          ok: false,
          error: { code: 'not_found', message: 'Delivery preparation not found.' },
        };
      await transitionDeliveryPrep(
        { id: d.id, orgId: d.orgId, orderId: d.orderId, status: d.status as DeliveryPrepStatus },
        to,
        { userId: s.sub, role: s.roles[0]! },
        meta,
      );
      return { ok: true };
    }),
  );
}

export async function markPreparing(input: unknown): Promise<Result> {
  const p = DeliveryPrepIdParam.safeParse(input);
  if (!p.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  return runTransition(p.data.delivery_prep_id, 'preparing');
}
export async function markReady(input: unknown): Promise<Result> {
  const p = MarkDeliveryPrep.safeParse(input);
  if (!p.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  const meta =
    p.data.customer_summary !== undefined
      ? { customerSummary: p.data.customer_summary }
      : undefined;
  return runTransition(p.data.delivery_prep_id, 'ready', meta);
}
export async function scheduleDelivery(input: unknown): Promise<Result> {
  const p = ScheduleDelivery.safeParse(input);
  if (!p.success)
    return {
      ok: false,
      error: { code: 'validation_failed', message: 'Invalid scheduling window.' },
    };
  const meta: TransitionMeta = {
    scheduledWindowStart: new Date(p.data.scheduled_window_start),
    scheduledWindowEnd: new Date(p.data.scheduled_window_end),
    ...(p.data.customer_summary !== undefined ? { customerSummary: p.data.customer_summary } : {}),
  };
  return runTransition(p.data.delivery_prep_id, 'scheduled', meta);
}
export async function markHandedOff(input: unknown): Promise<Result> {
  const p = HandOffDelivery.safeParse(input);
  if (!p.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid.' } };
  const meta: TransitionMeta = {
    ...(p.data.reason !== undefined ? { reason: p.data.reason } : {}),
    ...(p.data.customer_summary !== undefined ? { customerSummary: p.data.customer_summary } : {}),
  };
  return runTransition(p.data.delivery_prep_id, 'handed_off', meta);
}

/** READ-ONLY org-scoped delivery summary for the admin panel. No mutation. */
export async function getOrderDeliveryForStaff(
  orderId: string,
): Promise<Result<StaffDeliveryView | null>> {
  const { s, err } = await staffGuard();
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
      )[0] ?? null;
    if (!d) return { ok: true, data: null };
    const view: StaffDeliveryView = {
      delivery_prep_id: d.id,
      status: d.status as DeliveryPrepStatus,
      delivery_address_ref: d.deliveryAddressRef ?? null,
      scheduled_window_start: d.scheduledWindowStart ? d.scheduledWindowStart.toISOString() : null,
      scheduled_window_end: d.scheduledWindowEnd ? d.scheduledWindowEnd.toISOString() : null,
      staff_notes: d.staffNotes ?? null,
      customer_summary: d.customerSummary ?? null,
    };
    return { ok: true, data: view };
  });
}
