'use server';
import { asc, eq } from 'drizzle-orm';
import { withTenant, messages, orders, newId } from '@maralito/db';
import { requireAdminAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { signMessageImage, uploadMessageImage, isMediaConfigured } from '@/server/message-media';
import type { MessageView } from './messages';

type Result<T = void> =
  { ok: true; data?: T } | { ok: false; error: { code: string; message: string } };

const guard = async () => {
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
};

/** Staff view of an order's message thread (org-scoped by RLS). */
export async function listOrderThread(orderId: string): Promise<Result<MessageView[]>> {
  const { s, err } = await guard();
  if (!s) return { ok: false, error: err! };
  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    const rows = await tx
      .select()
      .from(messages)
      .where(eq(messages.orderId, orderId))
      .orderBy(asc(messages.createdAt));
    const data = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        sender_role: r.senderRole,
        body: r.body,
        image_url: await signMessageImage(r.imagePath),
        created_at: r.createdAt.toISOString(),
      })),
    );
    return { ok: true as const, data };
  });
}

/** Send a staff message (optionally with a photo) into an order's customer thread. */
export async function sendStaffMessage(formData: FormData): Promise<Result<{ id: string }>> {
  const { s, err } = await guard();
  if (!s) return { ok: false, error: err! };
  const orderId = String(formData.get('order_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  const file = formData.get('image');
  const hasImage = file instanceof File && file.size > 0;
  if (!orderId.startsWith('ord_'))
    return { ok: false, error: { code: 'validation_failed', message: 'Invalid order.' } };
  if (!body && !hasImage)
    return { ok: false, error: { code: 'validation_failed', message: 'Message is empty.' } };
  if (body.length > 2000)
    return { ok: false, error: { code: 'validation_failed', message: 'Message too long.' } };

  return withTenant({ authUserId: s.sub, orgId: s.orgId }, async (tx) => {
    // Order must be in the staff member's org (RLS also scopes this select).
    const o = await tx.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!o || o.orgId !== s.orgId)
      return { ok: false, error: { code: 'not_found', message: 'Order not found.' } };

    let imagePath: string | null = null;
    if (hasImage) {
      if (!isMediaConfigured())
        return { ok: false, error: { code: 'media_unavailable', message: 'Photos not enabled.' } };
      const up = await uploadMessageImage(s.orgId, o.customerId, file);
      if (!up.ok)
        return {
          ok: false,
          error: {
            code: up.error,
            message:
              up.error === 'invalid_type'
                ? 'Unsupported image type.'
                : up.error === 'too_large'
                  ? 'Image is too large (max 8 MB).'
                  : 'Could not upload the photo.',
          },
        };
      imagePath = up.path;
    }

    const id = newId('msg');
    await tx.insert(messages).values({
      id,
      orgId: s.orgId,
      customerId: o.customerId,
      orderId,
      senderRole: 'staff',
      body: body || '📷 Photo',
      imagePath,
    });
    return { ok: true as const, data: { id } };
  });
}
