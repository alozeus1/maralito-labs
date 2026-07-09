'use server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withTenant, messages, customerProfiles, orders, newId } from '@maralito/db';
import { requireCustomerAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';

type Result<T = void> =
  { ok: true; data?: T } | { ok: false; error: { code: string; message: string } };

const guard = async () => {
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
};

export interface MessageView {
  id: string;
  sender_role: 'customer' | 'staff';
  body: string;
  created_at: string;
}

/** List the caller's concierge thread (RLS-scoped). Optional orderId filters to that order. */
export async function listMyMessages(orderId?: string): Promise<Result<MessageView[]>> {
  const { s, err } = await guard();
  if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const profile = await tx.query.customerProfiles.findFirst({
      where: eq(customerProfiles.authUserId, s.sub),
    });
    if (!profile) return { ok: true as const, data: [] };
    const where = orderId
      ? and(eq(messages.customerId, profile.id), eq(messages.orderId, orderId))
      : eq(messages.customerId, profile.id);
    const rows = await tx.select().from(messages).where(where).orderBy(asc(messages.createdAt));
    return {
      ok: true as const,
      data: rows.map((r) => ({
        id: r.id,
        sender_role: r.senderRole,
        body: r.body,
        created_at: r.createdAt.toISOString(),
      })),
    };
  });
}

const SendInput = z.object({
  body: z.string().trim().min(1).max(2000),
  order_id: z.string().regex(/^ord_/).optional(),
});

/** Post a message as the caller (sender_role forced to 'customer'; RLS enforces ownership). */
export async function sendMessage(input: unknown): Promise<Result<{ id: string }>> {
  const { s, err } = await guard();
  if (!s) return { ok: false, error: err! };
  const parsed = SendInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: 'validation_failed', message: 'Invalid message.' } };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const profile = await tx.query.customerProfiles.findFirst({
      where: eq(customerProfiles.authUserId, s.sub),
    });
    if (!profile) return { ok: false, error: { code: 'not_found', message: 'Profile missing.' } };
    // If an order is referenced, it must be the caller's own (RLS also enforces this).
    if (parsed.data.order_id) {
      const o = await tx.query.orders.findFirst({ where: eq(orders.id, parsed.data.order_id) });
      if (!o) return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };
    }
    const id = newId('msg');
    await tx.insert(messages).values({
      id,
      orgId: s.orgId,
      customerId: profile.id,
      orderId: parsed.data.order_id ?? null,
      senderRole: 'customer',
      body: parsed.data.body,
    });
    return { ok: true as const, data: { id } };
  });
}
