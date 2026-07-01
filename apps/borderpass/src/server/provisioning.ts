import 'server-only';
import { withPrivilegedDbAccess, provisionUserCore } from '@maralito/db';
import { writeAudit } from './audit';

/** Single shared BorderPass customer org (ADR-0007). Per-customer isolation = owner predicate. */
const defaultCustomerOrg = () => process.env.BORDERPASS_DEFAULT_CUSTOMER_ORG_ID ?? 'org_dev0000000bp';

/**
 * Provision a newly authenticated user: ensure identity + default customer role + baseline profile.
 * Idempotent, privileged (bootstrap writes), audited. Safe on failure. Never logs OTP/token.
 */
export async function provisionAuthenticatedUser(
  authUserId: string,
  email?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.DATABASE_URL) return { ok: false, error: 'not_configured' };
  try {
    const orgId = defaultCustomerOrg();
    await withPrivilegedDbAccess('provision:new_user', (db) =>
      provisionUserCore(db, { authUserId, orgId, ...(email ? { email } : {}) }));
    await writeAudit({
      action: 'user.provisioned', orgId, actorUserId: authUserId, actorRole: 'customer',
      entityType: 'user_identity', entityId: authUserId,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'provisioning_failed' };
  }
}
