import 'server-only';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { withPrivilegedDbAccess, emailSuppressions, newId } from '@maralito/db';

/**
 * Email suppression list (Phase 8D). Recipients that hard-bounced or complained must not receive
 * further non-essential mail. Keyed by a SHA-256 hash of the lowercased address so no recipient email
 * is stored at rest (ADR-0014). Written by the Resend webhook; checked on the send path.
 */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/** True when the recipient has hard-bounced or complained. */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const hash = hashEmail(email);
  const rows = await withPrivilegedDbAccess('email.suppression:check', (db) =>
    db
      .select({ id: emailSuppressions.id })
      .from(emailSuppressions)
      .where(eq(emailSuppressions.emailHash, hash))
      .limit(1),
  );
  return rows.length > 0;
}

/** Record a suppression (idempotent by email hash). */
export async function suppressEmail(
  email: string,
  reason: 'bounced' | 'complained',
): Promise<void> {
  const hash = hashEmail(email);
  await withPrivilegedDbAccess('email.suppression:add', (db) =>
    db
      .insert(emailSuppressions)
      .values({ id: newId('sup'), emailHash: hash, reason })
      .onConflictDoNothing({ target: emailSuppressions.emailHash }),
  );
}
