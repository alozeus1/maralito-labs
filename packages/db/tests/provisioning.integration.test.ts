/**
 * New-user provisioning — exercises the REAL provisionUserCore against embedded Postgres (PGlite)
 * via the Drizzle pglite driver. Proves: identity + default customer role + baseline profile are
 * created, and repeats are idempotent (no duplicates). CI-runnable, no external DB.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as schema from '../src/schema/index';
import { provisionUserCore } from '../src/provisioning';
import type { Db } from '../src/client';

const USER = '00000000-0000-4000-8000-0000000000a1';
let pg: PGlite;
let db: Db;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create table organizations(id text primary key, name text, type text default 'internal', status text default 'active', created_at timestamptz default now());
    create table roles(key text primary key, name text, scope text default 'app');
    create table user_identities(id text primary key, auth_user_id uuid unique not null, org_id text not null references organizations(id), status text default 'active', created_at timestamptz default now());
    create table user_roles(id text primary key, auth_user_id uuid not null, org_id text not null references organizations(id), role_key text not null references roles(key), assigned_by uuid, assigned_at timestamptz default now(), unique(auth_user_id, org_id, role_key));
    create table customer_profiles(id text primary key, auth_user_id uuid unique not null, org_id text not null references organizations(id), display_name text not null, language text not null default 'es', notification_prefs jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
    insert into organizations(id,name) values('org_dev0000000bp','BorderPass Dev');
    insert into roles(key,name) values('customer','customer');
  `);
  db = drizzle(pg, { schema }) as unknown as Db;
});

describe('provisionUserCore (real PGlite)', () => {
  it('creates identity + customer role + profile for a new user', async () => {
    await provisionUserCore(db, { authUserId: USER, orgId: 'org_dev0000000bp', email: 'maria@example.com' });
    const id = await db.select().from(schema.userIdentities).where(eq(schema.userIdentities.authUserId, USER));
    const ur = await db.select().from(schema.userRoles).where(eq(schema.userRoles.authUserId, USER));
    const cp = await db.select().from(schema.customerProfiles).where(eq(schema.customerProfiles.authUserId, USER));
    expect(id).toHaveLength(1);
    expect(ur).toHaveLength(1);
    expect(ur[0]!.roleKey).toBe('customer');
    expect(cp).toHaveLength(1);
    expect(cp[0]!.displayName).toBe('maria'); // email local-part
  });

  it('is idempotent — repeat provisioning creates no duplicates', async () => {
    await provisionUserCore(db, { authUserId: USER, orgId: 'org_dev0000000bp', email: 'maria@example.com' });
    await provisionUserCore(db, { authUserId: USER, orgId: 'org_dev0000000bp' });
    const id = await db.select().from(schema.userIdentities).where(eq(schema.userIdentities.authUserId, USER));
    const ur = await db.select().from(schema.userRoles).where(eq(schema.userRoles.authUserId, USER));
    const cp = await db.select().from(schema.customerProfiles).where(eq(schema.customerProfiles.authUserId, USER));
    expect(id).toHaveLength(1);
    expect(ur).toHaveLength(1);
    expect(cp).toHaveLength(1);
  });

  it('getAppSession prerequisites exist (identity has org + customer role)', async () => {
    const id = await db.select().from(schema.userIdentities).where(eq(schema.userIdentities.authUserId, USER));
    expect(id[0]!.orgId).toBe('org_dev0000000bp'); // → getAppSession resolves orgId + 'customer' role → customer guard passes
  });
});
