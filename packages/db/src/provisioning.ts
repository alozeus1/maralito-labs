import { userIdentities, userRoles, customerProfiles } from './schema/index';
import { newId } from './ids';
import type { Db } from './client';

export interface ProvisionParams {
  authUserId: string;
  orgId: string;
  email?: string;
}

/**
 * Idempotent core provisioning: ensure identity + default customer role + baseline profile.
 * Pure (takes a db/tx) so it's testable against PGlite and runnable behind withPrivilegedDbAccess.
 * Repeats are no-ops (unique constraints + onConflictDoNothing).
 */
export async function provisionUserCore(db: Db, p: ProvisionParams): Promise<void> {
  await db
    .insert(userIdentities)
    .values({ id: newId('uid'), authUserId: p.authUserId, orgId: p.orgId })
    .onConflictDoNothing();
  await db
    .insert(userRoles)
    .values({ id: newId('ur'), authUserId: p.authUserId, orgId: p.orgId, roleKey: 'customer' })
    .onConflictDoNothing();
  const display = (p.email?.split('@')[0] || 'Customer').slice(0, 120);
  await db
    .insert(customerProfiles)
    .values({
      id: newId('cust'),
      authUserId: p.authUserId,
      orgId: p.orgId,
      displayName: display,
      language: 'es',
    })
    .onConflictDoNothing();
}
