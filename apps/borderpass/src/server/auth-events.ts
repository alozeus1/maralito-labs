'use server';
import { writeAudit } from './audit';
import { getServerSupabase } from './supabase';
import { getAppSession } from './auth';

/** Audited access denial (authenticated-but-forbidden). Not called for plain unauthenticated redirects (noise). */
export async function auditAccessDenied(actorUserId: string, orgId: string | undefined, surface: 'admin' | 'customer') {
  await writeAudit({ action: 'access.denied', actorUserId, orgId, metadata: { surface } });
}
export async function auditPermissionDenied(actorUserId: string, permission: string) {
  await writeAudit({ action: 'permission.denied', actorUserId, metadata: { permission } });
}
export async function auditSignIn(authUserId: string, ok: boolean) {
  await writeAudit({ action: ok ? 'auth.signin' : 'auth.signin_failed', actorUserId: ok ? authUserId : undefined });
}

/** Sign-out server action (audited). */
export async function signOut() {
  const session = await getAppSession();
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  if (session) await writeAudit({ action: 'auth.signout', actorUserId: session.sub, orgId: session.orgId });
}
