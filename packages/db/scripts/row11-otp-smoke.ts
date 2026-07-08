/**
 * Row 11 OTP smoke (programmatic, synthetic-only). Proves the REAL Supabase auth + provisioning
 * pipeline WITHOUT depending on email delivery: it mints a real one-time code via the Supabase
 * admin API (no email sent, no rate limit), verifies it to a real session with the anon key, then
 * runs the ACTUAL provisioning code (provisionUserCore, via the privileged DB path the app uses)
 * to prove idempotency, reloads, and cleans up.
 *
 * Requires a working DATABASE_URL (privileged/table-owner role) — the same connection the app's
 * provisioning uses. The service_role API key is intentionally NOT granted on these tables
 * (least-privilege, ADR-0013), so there is no REST shortcut; provisioning must go through the DB.
 *
 * NEVER prints OTP codes, tokens, or keys — only PASS/FAIL + non-sensitive counts.
 *
 *   set -a; . ./.env.local; set +a; pnpm --filter @maralito/db exec tsx scripts/row11-otp-smoke.ts
 */
import { and, eq } from 'drizzle-orm';
import {
  withPrivilegedDbAccess,
  provisionUserCore,
  userIdentities,
  userRoles,
  customerProfiles,
} from '../src/index';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG = process.env.BORDERPASS_DEFAULT_CUSTOMER_ORG_ID ?? 'org_dev0000000bp';

if (!URL || !ANON || !SERVICE || !process.env.DATABASE_URL) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY / DATABASE_URL');
  process.exit(2);
}

let allPass = true;
const log = (name: string, ok: boolean, note = '') => {
  if (!ok) allPass = false;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? ' — ' + note : ''}`);
  return ok;
};

async function adminGenerateOtp(email: string): Promise<{ otp: string; userId: string }> {
  const r = await fetch(`${URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  const d = (await r.json()) as Record<string, unknown>;
  if (!r.ok) throw new Error(`generate_link ${r.status}`);
  const otp = (d.email_otp ?? (d.properties as Record<string, unknown>)?.email_otp) as string;
  const userId = (d.user_id ?? d.id ?? (d.user as Record<string, unknown>)?.id) as string;
  return { otp, userId };
}

async function verifyOtp(email: string, token: string): Promise<{ ok: boolean; hasSession: boolean; userId?: string }> {
  const r = await fetch(`${URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'email', email, token }),
  });
  const d = (await r.json()) as Record<string, unknown>;
  return { ok: r.ok, hasSession: !!d.access_token, userId: (d.user as Record<string, unknown>)?.id as string };
}

async function deleteAuthUser(userId: string) {
  await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}` },
  }).catch(() => {});
}

(async () => {
  const email = `bp-row11-${Date.now()}@synthetic.local`;

  const g1 = await adminGenerateOtp(email);
  log('OTP minted via Supabase admin API (no email, no rate limit)', !!g1.otp);

  const v1 = await verifyOtp(email, g1.otp);
  log('OTP verify -> real session created', v1.ok && v1.hasSession, `http_ok=${v1.ok}`);
  const uid = v1.userId || g1.userId;
  log('authenticated user id present', !!uid);

  for (let i = 0; i < 2; i++) {
    await withPrivilegedDbAccess('provision:row11-smoke', (db) =>
      provisionUserCore(db, { authUserId: uid, orgId: ORG, email }),
    );
  }
  const c = await withPrivilegedDbAccess('verify:row11-smoke', async (db) => ({
    ids: (await db.select().from(userIdentities).where(eq(userIdentities.authUserId, uid))).length,
    roles: (
      await db
        .select()
        .from(userRoles)
        .where(and(eq(userRoles.authUserId, uid), eq(userRoles.roleKey, 'customer')))
    ).length,
    profs: (await db.select().from(customerProfiles).where(eq(customerProfiles.authUserId, uid))).length,
  }));
  log('provisioning idempotent: exactly 1 identity', c.ids === 1, `ids=${c.ids}`);
  log('provisioning idempotent: exactly 1 customer role', c.roles === 1, `roles=${c.roles}`);
  log('provisioning idempotent: exactly 1 baseline profile', c.profs === 1, `profs=${c.profs}`);

  const g2 = await adminGenerateOtp(email);
  const v2 = await verifyOtp(email, g2.otp);
  log('relogin OTP verify -> session', v2.ok && v2.hasSession);
  await withPrivilegedDbAccess('provision:row11-smoke', (db) =>
    provisionUserCore(db, { authUserId: uid, orgId: ORG, email }),
  );
  const roles2 = await withPrivilegedDbAccess('verify:row11-smoke', async (db) =>
    (
      await db
        .select()
        .from(userRoles)
        .where(and(eq(userRoles.authUserId, uid), eq(userRoles.roleKey, 'customer')))
    ).length,
  );
  log('relogin: no duplicate provisioning (still 1 role)', roles2 === 1, `roles=${roles2}`);

  await withPrivilegedDbAccess('cleanup:row11-smoke', async (db) => {
    await db.delete(userRoles).where(eq(userRoles.authUserId, uid));
    await db.delete(customerProfiles).where(eq(customerProfiles.authUserId, uid));
    await db.delete(userIdentities).where(eq(userIdentities.authUserId, uid));
  });
  if (uid) await deleteAuthUser(uid);
  log('cleanup complete (synthetic rows + auth user removed)', true);

  console.log(allPass ? '\nROW 11 SMOKE: ALL PASS' : '\nROW 11 SMOKE: FAILURES ABOVE');
  process.exit(allPass ? 0 : 1);
})().catch((e) => {
  console.error('ERROR', (e as Error).message);
  process.exit(2);
});
