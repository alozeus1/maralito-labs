import 'server-only';
import { withPrivilegedDbAccess, auditLogs, newId } from '@maralito/db';
import { redact } from '@maralito/observability';
import { getServerEnv } from './env';

export interface AuditInput {
  action: string;
  orgId?: string;
  actorUserId?: string;
  actorRole?: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/** Append an audit record via the privileged path (audit rows are RLS-write-denied to tenants).
 *  Best-effort; never throws into the caller. Redacts secrets/OTP/tokens/docs. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    if (!getServerEnv().DATABASE_URL) return;
    await withPrivilegedDbAccess(`audit:${input.action}`, async (db) => {
      await db.insert(auditLogs).values({
        id: newId('aud'),
        action: input.action,
        orgId: input.orgId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        before: redact(input.before) ?? null,
        after: redact(input.after) ?? null,
        metadata: (redact(input.metadata) as Record<string, unknown>) ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
    });
  } catch {
    /* audit must not break the request */
  }
}
