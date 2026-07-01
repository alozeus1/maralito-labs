import 'server-only';
import { eq } from 'drizzle-orm';
import { buildSession, type AppSession, type Role } from '@maralito/auth';
import { withTenant, userIdentities, userRoles, rolePermissions } from '@maralito/db';
import { getServerSupabase } from './supabase';
import { getServerEnv } from './env';

/** Resolve AppSession; reads under withTenant (RLS-exercised). Read-only. Fail-closed → null. */
export async function getAppSession(): Promise<AppSession | null> {
  try {
    const supabase = await getServerSupabase();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    if (!getServerEnv().DATABASE_URL) return null;

    return await withTenant({ authUserId: user.id }, async (tx) => {
      const identity = await tx.query.userIdentities.findFirst({ where: eq(userIdentities.authUserId, user.id) });
      if (!identity) return null;
      const roleRows = await tx.select().from(userRoles).where(eq(userRoles.authUserId, user.id));
      const roles = roleRows.map((r) => r.roleKey as Role);
      const permissions = new Set<string>();
      for (const r of roles) {
        const perms = await tx.select().from(rolePermissions).where(eq(rolePermissions.roleKey, r));
        perms.forEach((p) => permissions.add(p.permissionKey));
      }
      return buildSession({ authUserId: user.id, orgId: identity.orgId, roles, permissions: [...permissions] });
    });
  } catch {
    return null;
  }
}
