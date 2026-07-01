import { pgTable, text, uuid, timestamp, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './identity';

export const roles = pgTable('roles', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').$type<'app' | 'system'>().notNull().default('app'),
});

export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  description: text('description').notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleKey: text('role_key').notNull().references(() => roles.key),
    permissionKey: text('permission_key').notNull().references(() => permissions.key),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleKey, t.permissionKey] }),
    roleIdx: index('role_permissions_role_idx').on(t.roleKey),
    permIdx: index('role_permissions_perm_idx').on(t.permissionKey),
  }),
);

export const userRoles = pgTable(
  'user_roles',
  {
    id: text('id').primaryKey(),
    authUserId: uuid('auth_user_id').notNull(),
    orgId: text('org_id').notNull().references(() => organizations.id),
    roleKey: text('role_key').notNull().references(() => roles.key),
    assignedBy: uuid('assigned_by'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uq: uniqueIndex('user_roles_user_org_role_uq').on(t.authUserId, t.orgId, t.roleKey),
    userIdx: index('user_roles_user_idx').on(t.authUserId),
    roleIdx: index('user_roles_role_idx').on(t.roleKey),
    orgIdx: index('user_roles_org_idx').on(t.orgId),
  }),
);
