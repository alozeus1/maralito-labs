/**
 * Messaging RLS isolation on real Postgres (PGlite), applying the REAL foundation policies.sql +
 * messages-policies.sql. Customers see only their own thread; staff see the whole org; sender_role
 * is enforced on insert. Proves the policy files, not the Supabase deployment (that is the live gate).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const OPS = '00000000-0000-4000-8000-0000000000d1';
let db: PGlite;

async function asTenant<T>(sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query('begin');
  try {
    if (sub)
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub, role: 'authenticated' }),
      ]);
    await db.query('set local role authenticated');
    return await fn();
  } finally {
    await db.query('commit').catch(() => {});
  }
}
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
    create table orders(id text primary key, order_ref text, customer_id text, org_id text, correlation_id text, created_at timestamptz default now());
    create table messages(id text primary key, org_id text not null, customer_id text not null, order_id text, sender_role text not null, body text not null, image_path text, created_at timestamptz default now());
    create role authenticated nologin;
    grant usage on schema public, auth to authenticated;
    grant select, insert, update on all tables in schema public to authenticated;
    grant execute on all functions in schema auth to authenticated;
  `);
  await db.exec(readFileSync(new URL('../src/rls/policies.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../src/rls/messages-policies.sql', import.meta.url), 'utf8'));
  await db.exec('grant execute on all functions in schema public to authenticated;');
  await db.exec(`
    insert into organizations(id,name) values('org_a','A');
    insert into user_identities(id,auth_user_id,org_id) values('uid_a','${A}','org_a'),('uid_b','${B}','org_a'),('uid_ops','${OPS}','org_a');
    insert into customer_profiles(id,auth_user_id,org_id,display_name) values('cust_a','${A}','org_a','A'),('cust_b','${B}','org_a','B');
    insert into staff_profiles(id,auth_user_id,org_id,display_name) values('staff_ops','${OPS}','org_a','Ops');
    insert into user_roles(id,auth_user_id,org_id,role_key) values('ur_a','${A}','org_a','customer'),('ur_b','${B}','org_a','customer'),('ur_ops','${OPS}','org_a','operations_manager');
    insert into messages(id,org_id,customer_id,sender_role,body) values('m_a','org_a','cust_a','customer','hi from A'),('m_b','org_a','cust_b','customer','hi from B');
  `);
});

describe('messages RLS isolation (real policies + messages-policies on PGlite)', () => {
  it('customer A sees only own messages', async () => {
    const r = await asTenant(A, () => rows('select id from messages order by id'));
    expect(r.map((x) => x.id)).toEqual(['m_a']);
  });

  it('customer A can post as themselves', async () => {
    await asTenant(A, () =>
      rows(
        "insert into messages(id,org_id,customer_id,sender_role,body) values('m_a2','org_a','cust_a','customer','follow up')",
      ),
    );
    const r = await asTenant(A, () => rows('select id from messages order by id'));
    expect(r.map((x) => x.id)).toEqual(['m_a', 'm_a2']);
  });

  it('customer A cannot post into customer B thread', async () => {
    await expect(
      asTenant(A, () =>
        rows(
          "insert into messages(id,org_id,customer_id,sender_role,body) values('m_x','org_a','cust_b','customer','spoof')",
        ),
      ),
    ).rejects.toThrow();
  });

  it('customer A cannot post as staff', async () => {
    await expect(
      asTenant(A, () =>
        rows(
          "insert into messages(id,org_id,customer_id,sender_role,body) values('m_y','org_a','cust_a','staff','impersonate')",
        ),
      ),
    ).rejects.toThrow();
  });

  it('ops staff sees all org messages', async () => {
    const r = await asTenant(OPS, () => rows('select id from messages'));
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r.map((x) => x.id)).toEqual(expect.arrayContaining(['m_a', 'm_b']));
  });

  it('staff can post a photo message into a customer thread, and that customer sees it', async () => {
    await asTenant(OPS, () =>
      rows(
        "insert into messages(id,org_id,customer_id,sender_role,body,image_path) values('m_photo','org_a','cust_a','staff','Here is your package','org_a/cust_a/pkg.jpg')",
      ),
    );
    const seen = await asTenant(A, () =>
      rows("select id, image_path from messages where id='m_photo'"),
    );
    expect(seen).toEqual([{ id: 'm_photo', image_path: 'org_a/cust_a/pkg.jpg' }]);
    // Customer B must NOT see another customer's photo message.
    const notSeen = await asTenant(B, () => rows("select id from messages where id='m_photo'"));
    expect(notSeen).toEqual([]);
  });
});
