/**
 * Production-readiness — `user_sessions` RLS isolation on real Postgres (PGlite), applying the REAL
 * policy files (`src/rls/policies.sql` + `src/rls/sessions-policies.sql`). No mocks, no hand-written
 * predicates: if the shipped SQL is wrong, these tests fail.
 *
 * What this proves:
 *   - a user reads ONLY their own session rows;
 *   - a same-org peer and a different-org user are both denied (own-rows-only, not org-scoped);
 *   - staff/ops get NOTHING (there is deliberately no staff select policy on this table);
 *   - anon (no grant, no policy) is denied outright;
 *   - a customer cannot INSERT / UPDATE / DELETE a session row even when the SQL-level privilege is
 *     granted — the denial comes from the ABSENCE of a write policy, which is what protects against
 *     session forgery and revocation evasion;
 *   - the token-hash unique index holds (one token → one session row);
 *   - the privileged (RLS-bypassing) seam can still revoke, which is how sign-out / device-limit /
 *     password-reset revocation actually lands.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-4000-8000-00000000000a'; // customer A (org_a)
const B = '00000000-0000-4000-8000-00000000000b'; // customer B (org_a) — same-org peer
const C = '00000000-0000-4000-8000-00000000000c'; // customer C (org_b) — cross-tenant
const OPS = '00000000-0000-4000-8000-0000000000d1'; // staff/ops (org_a)
let db: PGlite;

async function asRole<T>(
  sub: string | null,
  role: 'authenticated' | 'anon',
  fn: () => Promise<T>,
): Promise<T> {
  await db.query('begin');
  try {
    if (sub)
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub, role }),
      ]);
    await db.query(`set local role ${role}`);
    return await fn();
  } finally {
    await db.query('commit').catch(() => {});
  }
}
const asTenant = <T>(sub: string | null, fn: () => Promise<T>) => asRole(sub, 'authenticated', fn);
const rows = (sql: string, p: unknown[] = []) =>
  db.query(sql, p).then((r) => r.rows as Record<string, unknown>[]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims',true),'')::json->>'sub','')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::json->>'role','anon') $$;
    create table organizations(id text primary key, name text, type text, status text, created_at timestamptz default now());
    create table user_identities(id text primary key, auth_user_id uuid unique not null, org_id text not null, status text, created_at timestamptz default now());
    create table customer_profiles(id text primary key, auth_user_id uuid unique not null, org_id text not null, display_name text, language text, notification_prefs jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
    create table staff_profiles(id text primary key, auth_user_id uuid unique not null, org_id text not null, display_name text, role_keys jsonb, status text, created_at timestamptz default now(), updated_at timestamptz default now());
    create table roles(key text primary key, name text, scope text);
    create table permissions(key text primary key, description text);
    create table role_permissions(role_key text, permission_key text, primary key(role_key, permission_key));
    create table user_roles(id text primary key, auth_user_id uuid not null, org_id text not null, role_key text not null, assigned_by uuid, assigned_at timestamptz default now(), unique(auth_user_id, org_id, role_key));
    create table audit_logs(id text primary key, org_id text, actor_user_id uuid, actor_role text, action text, entity_type text, entity_id text, before jsonb, after jsonb, metadata jsonb, ip_address text, user_agent text, created_at timestamptz default now());
    create table platform_config(key text primary key, value jsonb, updated_at timestamptz default now());
    create table feature_flags(key text primary key, enabled boolean default false, description text, updated_at timestamptz default now());
    create table user_sessions(id text primary key, org_id text not null, auth_user_id uuid not null, session_token_hash text not null, device_label_hash text not null, ip_hash text, status text not null default 'active', issued_at timestamptz default now(), last_seen_at timestamptz default now(), absolute_expires_at timestamptz not null, idle_expires_at timestamptz not null, revoked_at timestamptz, revoked_reason text, created_at timestamptz default now(), updated_at timestamptz default now());
    create unique index user_sessions_token_hash_uq on user_sessions(session_token_hash);
    create role authenticated nologin;
    create role anon nologin;
    grant usage on schema public, auth to authenticated;
    grant usage on schema public, auth to anon;
    -- Deliberately OVER-granting SQL privileges here (production grants tenants select only). This
    -- forces the write-denial assertions below to be proven by RLS itself, not by a missing grant.
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated, anon;
  `);
  await db.exec(readFileSync(new URL('../src/rls/policies.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../src/rls/sessions-policies.sql', import.meta.url), 'utf8'));
  await db.exec('grant execute on all functions in schema public to authenticated, anon;');
  await db.exec(`
    insert into organizations(id,name) values('org_a','A'),('org_b','B');
    insert into user_identities(id,auth_user_id,org_id) values('uid_a','${A}','org_a'),('uid_b','${B}','org_a'),('uid_c','${C}','org_b'),('uid_ops','${OPS}','org_a');
    insert into customer_profiles(id,auth_user_id,org_id,display_name) values('cust_a','${A}','org_a','A'),('cust_b','${B}','org_a','B'),('cust_c','${C}','org_b','C');
    insert into staff_profiles(id,auth_user_id,org_id,display_name) values('staff_ops','${OPS}','org_a','Ops');
    insert into user_roles(id,auth_user_id,org_id,role_key) values('ur_a','${A}','org_a','customer'),('ur_b','${B}','org_a','customer'),('ur_c','${C}','org_b','customer'),('ur_ops','${OPS}','org_a','operations_manager');
    insert into user_sessions(id,org_id,auth_user_id,session_token_hash,device_label_hash,status,absolute_expires_at,idle_expires_at) values
      ('ses_a1','org_a','${A}','hash_a1','dev_chrome_macos','active', now() + interval '12 hours', now() + interval '30 minutes'),
      ('ses_a2','org_a','${A}','hash_a2','dev_safari_ios','active',  now() + interval '12 hours', now() + interval '30 minutes'),
      ('ses_b1','org_a','${B}','hash_b1','dev_chrome_macos','active', now() + interval '12 hours', now() + interval '30 minutes'),
      ('ses_c1','org_b','${C}','hash_c1','dev_firefox_linux','active',now() + interval '12 hours', now() + interval '30 minutes');
  `);
});

describe('user_sessions RLS — own rows only (real policy files on PGlite)', () => {
  it('user A sees exactly their own two sessions', async () => {
    const r = await asTenant(A, () => rows('select id from user_sessions order by id'));
    expect(r).toEqual([{ id: 'ses_a1' }, { id: 'ses_a2' }]);
  });

  it('a SAME-ORG peer cannot see another user’s sessions (not merely org-scoped)', async () => {
    const r = await asTenant(B, () => rows('select id from user_sessions order by id'));
    expect(r).toEqual([{ id: 'ses_b1' }]);
  });

  it('a CROSS-TENANT user sees only their own org’s own row, never org_a’s', async () => {
    const r = await asTenant(C, () => rows('select id, org_id from user_sessions'));
    expect(r).toEqual([{ id: 'ses_c1', org_id: 'org_b' }]);
  });

  it('staff/ops get NOTHING — there is deliberately no staff select policy on sessions', async () => {
    expect(await asTenant(OPS, () => rows('select * from user_sessions'))).toHaveLength(0);
  });

  it('missing JWT claims → zero rows (fail closed)', async () => {
    expect(await asTenant(null, () => rows('select * from user_sessions'))).toHaveLength(0);
  });

  it('anon is denied outright (no grant, no policy)', async () => {
    await expect(asRole(null, 'anon', () => rows('select * from user_sessions'))).rejects.toThrow();
    await expect(asRole(A, 'anon', () => rows('select * from user_sessions'))).rejects.toThrow();
  });

  it('a targeted read of someone else’s session id returns nothing (no row-existence leak)', async () => {
    expect(
      await asTenant(B, () => rows("select id from user_sessions where id = 'ses_a1'")),
    ).toHaveLength(0);
  });

  it('an aggregate cannot count rows the caller cannot see', async () => {
    const r = await asTenant(B, () => rows('select count(*)::int as n from user_sessions'));
    expect(r[0]).toEqual({ n: 1 });
  });
});

describe('user_sessions RLS — no client writes (session forgery / revocation evasion)', () => {
  it('a customer CANNOT insert a session row for themselves (no insert policy)', async () => {
    await expect(
      asTenant(A, () =>
        rows(
          `insert into user_sessions(id,org_id,auth_user_id,session_token_hash,device_label_hash,absolute_expires_at,idle_expires_at)
           values('ses_forged','org_a','${A}','hash_forged','dev_x', now() + interval '99 hours', now() + interval '99 hours') returning id`,
        ),
      ),
    ).rejects.toThrow();
  });

  it('a customer CANNOT insert a session row impersonating another user', async () => {
    await expect(
      asTenant(B, () =>
        rows(
          `insert into user_sessions(id,org_id,auth_user_id,session_token_hash,device_label_hash,absolute_expires_at,idle_expires_at)
           values('ses_impersonate','org_a','${A}','hash_imp','dev_x', now() + interval '1 hour', now() + interval '1 hour') returning id`,
        ),
      ),
    ).rejects.toThrow();
  });

  it('a customer CANNOT extend their own session expiry (no update policy)', async () => {
    const updated = await asTenant(A, () =>
      rows(
        "update user_sessions set absolute_expires_at = now() + interval '999 hours' where id='ses_a1' returning id",
      ),
    );
    expect(updated).toHaveLength(0); // update sees zero updatable rows → silently affects nothing
    const check = await rows(
      "select absolute_expires_at < now() + interval '13 hours' as still_capped from user_sessions where id='ses_a1'",
    );
    expect(check[0]).toEqual({ still_capped: true });
  });

  it('a customer CANNOT un-revoke a session by flipping status back to active', async () => {
    await rows("update user_sessions set status='revoked', revoked_reason='device_limit' where id='ses_a2'");
    const updated = await asTenant(A, () =>
      rows("update user_sessions set status='active', revoked_reason=null where id='ses_a2' returning id"),
    );
    expect(updated).toHaveLength(0);
    const check = await rows("select status from user_sessions where id='ses_a2'");
    expect(check[0]).toEqual({ status: 'revoked' });
  });

  it('a customer CANNOT delete a session row (no delete policy, even with the privilege granted)', async () => {
    const deleted = await asTenant(A, () =>
      rows("delete from user_sessions where id='ses_a1' returning id"),
    );
    expect(deleted).toHaveLength(0);
    expect(await rows("select count(*)::int as n from user_sessions where id='ses_a1'")).toEqual([
      { n: 1 },
    ]);
  });

  it('a customer CANNOT delete another user’s session', async () => {
    const deleted = await asTenant(B, () =>
      rows("delete from user_sessions where id='ses_a1' returning id"),
    );
    expect(deleted).toHaveLength(0);
  });
});

describe('user_sessions integrity + privileged revocation seam', () => {
  it('one token hash maps to exactly one session row (unique index holds)', async () => {
    await expect(
      rows(
        `insert into user_sessions(id,org_id,auth_user_id,session_token_hash,device_label_hash,absolute_expires_at,idle_expires_at)
         values('ses_dup','org_a','${A}','hash_a1','dev_x', now() + interval '1 hour', now() + interval '1 hour')`,
      ),
    ).rejects.toThrow();
  });

  it('the privileged seam CAN revoke all of a user’s sessions (password-reset path)', async () => {
    // Runs as the owner/base role — mirrors withPrivilegedDbAccess, which bypasses RLS.
    await rows(
      `update user_sessions set status='revoked', revoked_at=now(), revoked_reason='password_reset'
       where auth_user_id='${A}' and status='active'`,
    );
    expect(
      await rows(
        `select count(*)::int as n from user_sessions where auth_user_id='${A}' and status='active'`,
      ),
    ).toEqual([{ n: 0 }]);
    // Other users are untouched by one account's password reset.
    expect(
      await rows(
        `select count(*)::int as n from user_sessions where auth_user_id='${B}' and status='active'`,
      ),
    ).toEqual([{ n: 1 }]);
  });

  it('a revoked session is still readable by its owner (so the UI can explain the sign-out)', async () => {
    const r = await asTenant(A, () =>
      rows("select revoked_reason from user_sessions where id='ses_a1'"),
    );
    expect(r[0]).toEqual({ revoked_reason: 'password_reset' });
  });
});
