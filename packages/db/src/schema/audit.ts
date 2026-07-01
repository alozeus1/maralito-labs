import { pgTable, text, uuid, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id'),
    actorUserId: uuid('actor_user_id'),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    metadata: jsonb('metadata'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    actorIdx: index('audit_actor_idx').on(t.actorUserId),
    entityIdx: index('audit_entity_idx').on(t.entityType, t.entityId),
    actionIdx: index('audit_action_idx').on(t.action),
    createdIdx: index('audit_created_idx').on(t.createdAt),
    orgIdx: index('audit_org_idx').on(t.orgId),
  }),
);
