-- BorderPass RLS baseline (Phase 1). Default-deny; org_id is the tenant key.
-- Applied as a follow-on migration after Drizzle generates table DDL.
-- Tenant context: the caller's org is resolved from user_identities by auth.uid() (Supabase).

-- Helper: current caller's org_id (SECURITY DEFINER so it can read the mapping under RLS).
create or replace function app_current_org_id()
returns text language sql stable security definer set search_path = public as $$
  select org_id from user_identities where auth_user_id = auth.uid() limit 1
$$;

-- Helper: does the caller hold a role in their org?
create or replace function app_has_role(role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur
    where ur.auth_user_id = auth.uid() and ur.role_key = role
  )
$$;

-- Helper: is the caller staff (any non-customer role)?  (Phase 1.5 — restricts staff-profile reads)
create or replace function app_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur where ur.auth_user_id = auth.uid() and ur.role_key <> 'customer'
  )
$$;

-- Enable RLS (default-deny once enabled; explicit policies below).
alter table organizations      enable row level security;
alter table user_identities    enable row level security;
alter table customer_profiles  enable row level security;
alter table staff_profiles     enable row level security;
alter table roles              enable row level security;
alter table permissions        enable row level security;
alter table role_permissions   enable row level security;
alter table user_roles         enable row level security;
alter table audit_logs         enable row level security;
alter table platform_config    enable row level security;
alter table feature_flags      enable row level security;

-- Customers: own rows only (owner predicate + org).
create policy cust_self_select on customer_profiles for select
  using (auth_user_id = auth.uid());
create policy cust_self_update on customer_profiles for update
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Identity mapping: a user can read their own mapping; staff/admin read within org.
create policy uid_self on user_identities for select
  using (auth_user_id = auth.uid() or (org_id = app_current_org_id() and app_is_staff()));

-- Org rows: members read their org.
create policy org_member_read on organizations for select
  using (id = app_current_org_id());

-- Staff profiles: visible within org to staff; self-readable.
create policy staff_org_read on staff_profiles for select
  using (auth_user_id = auth.uid() or (org_id = app_current_org_id() and app_is_staff()));

-- user_roles: self-readable; super_admin manages (writes go through server/service role).
create policy user_roles_self_read on user_roles for select
  using (auth_user_id = auth.uid() or app_has_role('super_admin'));

-- Reference tables (roles/permissions/role_permissions): readable by authenticated users.
create policy roles_read       on roles            for select using (auth.role() = 'authenticated');
create policy perms_read       on permissions      for select using (auth.role() = 'authenticated');
create policy roleperms_read   on role_permissions for select using (auth.role() = 'authenticated');

-- audit_logs: compliance/super_admin read within org; writes are server/service-role only.
create policy audit_admin_read on audit_logs for select
  using (org_id = app_current_org_id() and (app_has_role('compliance_admin') or app_has_role('super_admin')));

-- config/flags: read by authenticated; writes server/service-role only.
create policy config_read on platform_config for select using (auth.role() = 'authenticated');
create policy flags_read  on feature_flags  for select using (auth.role() = 'authenticated');

-- NOTE: INSERT/UPDATE on identity/rbac/audit/config is performed server-side via the
-- service-role client (RLS-bypassing) with explicit audit — never from the browser.
-- Per-entity role-scoped policies for DOMAIN tables (orders, quotes, …) arrive with those tables.

-- Phase 1.5: write policies so the withTenant (RLS-exercised) path works for own-row writes.
create policy cust_self_insert on customer_profiles for insert
  with check (auth_user_id = auth.uid());
create policy staff_self_update on staff_profiles for update
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- SQL privileges are required before Postgres evaluates RLS policies. Keep these aligned with the
-- policy operations above; privileged writes continue to use the owner-capable server connection.
grant select on organizations, user_identities, roles, permissions, role_permissions, user_roles,
  audit_logs, platform_config, feature_flags to authenticated;
grant select, insert, update on customer_profiles to authenticated;
grant select, update on staff_profiles to authenticated;

-- Reminder: privileged writes (roles, audit, config, seed) run via withServiceRole (RLS bypassed,
-- audited). Domain-table (orders, …) policies are authored WITH those tables in Phase 2 (ADR-0007).
