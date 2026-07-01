import 'server-only';
import { and, eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, userRoles, newId } from '@maralito/db';
import { requirePermission, type AppSession } from '@maralito/auth';
import { writeAudit } from './audit';

export async function assignRole(
  actor: AppSession,
  targetAuthUserId: string,
  orgId: string,
  roleKey: string,
) {
  requirePermission(actor, 'roles.manage');
  await withPrivilegedDbAccess(`role.assign:${roleKey}`, async (db) => {
    await db
      .insert(userRoles)
      .values({
        id: newId('ur'),
        authUserId: targetAuthUserId,
        orgId,
        roleKey,
        assignedBy: actor.sub,
      })
      .onConflictDoNothing();
  });
  await writeAudit({
    action: 'role.assigned',
    orgId,
    actorUserId: actor.sub,
    actorRole: 'super_admin',
    entityType: 'user_role',
    entityId: targetAuthUserId,
    after: { roleKey },
  });
}

export async function removeRole(
  actor: AppSession,
  targetAuthUserId: string,
  orgId: string,
  roleKey: string,
) {
  requirePermission(actor, 'roles.manage');
  await withPrivilegedDbAccess(`role.remove:${roleKey}`, async (db) => {
    await db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.authUserId, targetAuthUserId),
          eq(userRoles.orgId, orgId),
          eq(userRoles.roleKey, roleKey),
        ),
      );
  });
  await writeAudit({
    action: 'role.removed',
    orgId,
    actorUserId: actor.sub,
    actorRole: 'super_admin',
    entityType: 'user_role',
    entityId: targetAuthUserId,
    before: { roleKey },
  });
}
