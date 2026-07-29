'use server';
import { writeAudit } from './audit';
import { getServerSupabase } from './supabase';
import { getAppSession } from './auth';
import { revokeSessionOnSignOut } from './session-guard';

/** Audited access denial (authenticated-but-forbidden). Not called for plain unauthenticated redirects (noise). */
export async function auditAccessDenied(
  actorUserId: string,
  orgId: string | undefined,
  surface: 'admin' | 'customer',
) {
  await writeAudit({
    action: 'access.denied',
    actorUserId,
    ...(orgId ? { orgId } : {}),
    metadata: { surface },
  });
}
export async function auditPermissionDenied(actorUserId: string, permission: string) {
  await writeAudit({ action: 'permission.denied', actorUserId, metadata: { permission } });
}
export async function auditSignIn(authUserId: string, ok: boolean) {
  await writeAudit({
    action: ok ? 'auth.signin' : 'auth.signin_failed',
    ...(ok ? { actorUserId: authUserId } : {}),
  });
}

/**
 * Sign-out server action (audited).
 *
 * ORDER MATTERS: the session registry must be told BEFORE `supabase.auth.signOut()` clears the auth
 * cookies, because afterwards there is no token left to identify which row to revoke.
 * `revokeSessionOnSignOut()` is a no-op unless `BORDERPASS_SESSION_ENFORCEMENT === 'on'`, and is
 * best-effort in every case — it never throws, so a user can always sign out of Supabase even if the
 * registry write fails. Supabase's own sign-out remains the authoritative end of the browser session.
 */
export async function signOut() {
  const session = await getAppSession();
  await revokeSessionOnSignOut();
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  if (session)
    await writeAudit({ action: 'auth.signout', actorUserId: session.sub, orgId: session.orgId });
}
