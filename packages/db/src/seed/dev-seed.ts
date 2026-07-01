/**
 * Local/dev seed ONLY. Never run against production.
 * Seeds: one dev org, the 9 roles, a sample permission set, role->permission mappings,
 * and an optional super_admin bootstrap (SUPER_ADMIN_AUTH_USER_ID env).
 */
import { createRawDbClient } from '../client';
import { organizations, roles, permissions, rolePermissions, userRoles, auditLogs } from '../schema/index';
import { newId } from '../ids';

const ROLE_KEYS = [
  'customer', 'concierge', 'inspector', 'driver', 'operations_manager',
  'finance_admin', 'compliance_admin', 'support_agent', 'super_admin',
] as const;

const SAMPLE_PERMISSIONS: Array<[string, string]> = [
  ['profile.read', 'Read own profile'],
  ['profile.write', 'Update own profile'],
  ['order.read', 'Read orders (scoped)'],
  ['order.approve', 'Approve/reject order risk (compliance)'],
  ['quote.approve', 'Approve/send quote (finance)'],
  ['refund.create', 'Create/approve refund (finance)'],
  ['inspection.submit', 'Submit inspection (inspector)'],
  ['borderdocs.approve', 'Approve border documents (compliance)'],
  ['audit.read', 'Read audit logs'],
  ['roles.manage', 'Assign/revoke roles (super_admin)'],
];

// Minimal Phase-1 role->permission seed (full matrix lands with each domain phase).
const ROLE_PERMS: Record<string, string[]> = {
  customer: ['profile.read', 'profile.write', 'order.read'],
  super_admin: SAMPLE_PERMISSIONS.map(([k]) => k),
  compliance_admin: ['order.approve', 'borderdocs.approve', 'audit.read'],
  finance_admin: ['quote.approve', 'refund.create'],
  inspector: ['inspection.submit'],
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL required for seed');
  const db = createRawDbClient(url);

  const orgId = process.env.DEV_ORG_ID ?? 'org_dev0000000bp';
  await db.insert(organizations).values({ id: orgId, name: 'BorderPass Dev', type: 'internal' }).onConflictDoNothing();

  await db.insert(roles).values(ROLE_KEYS.map((key) => ({ key, name: key }))).onConflictDoNothing();
  await db.insert(permissions).values(SAMPLE_PERMISSIONS.map(([key, description]) => ({ key, description }))).onConflictDoNothing();

  for (const [roleKey, perms] of Object.entries(ROLE_PERMS)) {
    await db.insert(rolePermissions).values(perms.map((permissionKey) => ({ roleKey, permissionKey }))).onConflictDoNothing();
  }

  const superId = process.env.SUPER_ADMIN_AUTH_USER_ID;
  if (superId) {
    await db.insert(userRoles).values({ id: newId('ur'), authUserId: superId, orgId, roleKey: 'super_admin' }).onConflictDoNothing();
    await db.insert(auditLogs).values({
      id: newId('aud'), action: 'super_admin.bootstrap', orgId,
      actorUserId: null, actorRole: 'system', entityType: 'user_role', entityId: superId,
      after: { roleKey: 'super_admin' },
    }).onConflictDoNothing();
    console.log('seeded super_admin for', superId);
  }
  console.log('dev seed complete: org + roles + permissions');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
