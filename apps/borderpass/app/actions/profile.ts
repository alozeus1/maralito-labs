'use server';
import { eq } from 'drizzle-orm';
import { ProfileUpdate } from '@maralito/schemas';
import { withTenant, customerProfiles, newId } from '@maralito/db';
import { requireCustomerAccess } from '@maralito/auth';
import { getAppSession } from '@/server/auth';
import { getServerEnv } from '@/server/env';
import { writeAudit } from '@/server/audit';

type Result = { ok: true } | { ok: false; error: { code: string; message: string } };

/** Read the caller's own profile (RLS-scoped). Non-PII display + preference fields only. */
export async function getMyProfile(): Promise<
  | {
      ok: true;
      data: { display_name: string; language: string; channels: string[] } | null;
    }
  | { ok: false }
> {
  const session = await getAppSession();
  if (!session) return { ok: false };
  try {
    requireCustomerAccess(session);
  } catch {
    return { ok: false };
  }
  if (!getServerEnv().DATABASE_URL) return { ok: false };
  return withTenant({ authUserId: session.sub, orgId: session.orgId }, async (tx) => {
    const p = await tx.query.customerProfiles.findFirst({
      where: eq(customerProfiles.authUserId, session.sub),
    });
    return {
      ok: true as const,
      data: p
        ? {
            display_name: p.displayName ?? 'Customer',
            language: p.language ?? 'es',
            channels: p.notificationPrefs?.channels ?? ['email'],
          }
        : null,
    };
  });
}

export async function upsertMyProfile(input: unknown): Promise<Result> {
  const session = await getAppSession();
  if (!session)
    return { ok: false, error: { code: 'unauthenticated', message: 'Sign in required.' } };
  try {
    requireCustomerAccess(session);
  } catch {
    return { ok: false, error: { code: 'forbidden', message: 'Not allowed.' } };
  }

  const parsed = ProfileUpdate.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: 'validation_failed', message: 'Invalid profile.' } };
  if (!getServerEnv().DATABASE_URL)
    return { ok: false, error: { code: 'dependency_unavailable', message: 'Not configured.' } };

  const ctx = { authUserId: session.sub, orgId: session.orgId };
  const result = await withTenant(ctx, async (tx) => {
    const existing = await tx.query.customerProfiles.findFirst({
      where: eq(customerProfiles.authUserId, session.sub),
    });
    if (existing) {
      await tx
        .update(customerProfiles)
        .set({
          ...(parsed.data.display_name !== undefined
            ? { displayName: parsed.data.display_name }
            : {}),
          ...(parsed.data.language !== undefined ? { language: parsed.data.language } : {}),
          ...(parsed.data.notification_prefs !== undefined
            ? {
                notificationPrefs: {
                  ...(parsed.data.notification_prefs.channels !== undefined
                    ? { channels: parsed.data.notification_prefs.channels }
                    : {}),
                  ...(parsed.data.notification_prefs.quietHours !== undefined
                    ? { quietHours: parsed.data.notification_prefs.quietHours }
                    : {}),
                },
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(customerProfiles.authUserId, session.sub));
      return { kind: 'updated' as const, id: existing.id, before: existing };
    }
    const id = newId('cust');
    await tx.insert(customerProfiles).values({
      id,
      authUserId: session.sub,
      orgId: session.orgId,
      displayName: parsed.data.display_name ?? 'Customer',
      language: parsed.data.language ?? 'es',
    });
    return { kind: 'created' as const, id, before: undefined };
  });

  await writeAudit({
    action: result.kind === 'created' ? 'user.created' : 'profile.updated',
    orgId: session.orgId,
    actorUserId: session.sub,
    actorRole: 'customer',
    entityType: 'customer_profile',
    entityId: result.id,
    before: result.before,
    after: parsed.data,
  });
  return { ok: true };
}
