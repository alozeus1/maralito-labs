'use server';
import { desc, eq } from 'drizzle-orm';
import { OrderCreate, OrderDraftPatch, OrderSubmit } from '@maralito/schemas';
import { withTenant, orders, orderItems, customerProfiles, newId } from '@maralito/db';
import { requireCustomerAccess } from '@maralito/auth';
import { z } from 'zod';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { writeAudit } from '@/server/audit';
import { transitionOrder } from '@/server/order-transitions';
import { orderRef, submitMissingFields } from '@/domain/orders/rules';
import type { OrderStatus } from '@/domain/orders/state-machine';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: { code: string; message: string; details?: unknown } };
const guard = async () => {
  const s = await getAppSession();
  if (!s) return { s: null, err: { code: 'unauthenticated', message: 'Sign in required.' } };
  try { requireCustomerAccess(s); } catch { return { s: null, err: { code: 'forbidden', message: 'Not allowed.' } }; }
  if (!getServerEnv().DATABASE_URL) return { s: null, err: { code: 'dependency_unavailable', message: 'Not configured.' } };
  return { s, err: null };
};

/** Create a draft order owned by the caller. */
export async function createOrder(input: unknown): Promise<Result<{ order_id: string; order_ref: string }>> {
  const { s, err } = await guard(); if (!s) return { ok: false, error: err! };
  const parsed = OrderCreate.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid order.', details: parsed.error.flatten() } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const profile = await tx.query.customerProfiles.findFirst({ where: eq(customerProfiles.authUserId, s.sub) });
    if (!profile) return { ok: false, error: { code: 'not_found', message: 'Profile missing.' } };
    const id = newId('ord'); const ref = orderRef();
    await tx.insert(orders).values({
      id, orderRef: ref, customerId: profile.id, orgId: s.orgId, serviceType: parsed.data.service_type,
      status: 'draft', purpose: parsed.data.purpose ?? null, declaredValue: parsed.data.declared_value ?? null,
      deliveryAddressId: parsed.data.delivery_address_id ?? null, hubAddressId: parsed.data.hub_address_id ?? null, correlationId: id,
    });
    for (const it of parsed.data.items ?? []) {
      await tx.insert(orderItems).values({ id: newId('itm'), orderId: id, description: it.description, productUrl: it.product_url ?? null, quantity: it.quantity, variant: it.variant ?? null, unitValue: it.unit_value, category: it.category ?? null });
    }
    await writeAudit({ action: 'order.created', orgId: s.orgId, actorUserId: s.sub, actorRole: 'customer', entityType: 'order', entityId: id });
    return { ok: true, data: { order_id: id, order_ref: ref } };
  });
}

/** Patch a draft order (owner only; only while draft/missing_information). */
export async function updateDraftOrder(input: unknown): Promise<Result> {
  const { s, err } = await guard(); if (!s) return { ok: false, error: err! };
  const schema = z.object({ order_id: z.string().regex(/^ord_/), patch: OrderDraftPatch });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid patch.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const o = await tx.query.orders.findFirst({ where: eq(orders.id, parsed.data.order_id) }); // RLS scopes to owner
    if (!o) return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
    if (o.status !== 'draft' && o.status !== 'missing_information') return { ok: false, error: { code: 'conflict_state', message: 'Order not editable.' } };
    const p = parsed.data.patch;
    await tx.update(orders).set({
      ...(p.purpose !== undefined ? { purpose: p.purpose } : {}),
      ...(p.declared_value !== undefined ? { declaredValue: p.declared_value } : {}),
      ...(p.delivery_address_id !== undefined ? { deliveryAddressId: p.delivery_address_id } : {}),
      ...(p.hub_address_id !== undefined ? { hubAddressId: p.hub_address_id } : {}),
      updatedAt: new Date(),
    }).where(eq(orders.id, o.id));
    return { ok: true };
  });
}

/** Submit a draft order: full validation → transition draft→submitted (the seam). */
export async function submitOrder(input: unknown): Promise<Result> {
  const { s, err } = await guard(); if (!s) return { ok: false, error: err! };
  const parsed = OrderSubmit.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'validation_failed', message: 'Invalid request.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const o = await tx.query.orders.findFirst({ where: eq(orders.id, parsed.data.order_id) });
    if (!o) return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    const missing = submitMissingFields({ status: o.status as OrderStatus, purpose: o.purpose, declaredValue: o.declaredValue, serviceType: o.serviceType, itemCount: items.length, deliveryAddressId: o.deliveryAddressId, hubAddressId: o.hubAddressId });
    if (missing.length) return { ok: false, error: { code: 'validation_failed', message: 'Missing information.', details: missing } };
    await transitionOrder(tx, { id: o.id, orgId: o.orgId, status: o.status as OrderStatus }, 'submitted', { userId: s.sub, role: 'customer' });
    return { ok: true };
  });
}

/** List the caller's own orders (RLS-scoped). */
export async function listMyOrders(): Promise<Result<{ id: string; order_ref: string; status: string; service_type: string }[]>> {
  const { s, err } = await guard(); if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const rows = await tx.select().from(orders).orderBy(desc(orders.createdAt)).limit(50);
    return { ok: true, data: rows.map((o) => ({ id: o.id, order_ref: o.orderRef, status: o.status, service_type: o.serviceType })) };
  });
}

/** Get one own order + items (RLS-scoped). */
export async function getMyOrder(orderId: string): Promise<Result<unknown>> {
  const { s, err } = await guard(); if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const o = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!o) return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    return { ok: true, data: { order: o, items } };
  });
}
