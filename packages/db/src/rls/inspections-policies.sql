-- Phase 6: Inspection domain RLS (ADR-0012). Applied AFTER policies.sql + orders/quotes/payments/notifications.
-- Reuses helpers: auth.uid(), app_current_org_id(), app_is_staff().
--
-- Writes (create + status transitions + history) run via staff actions (withTenant staff update) and/or the
-- privileged server-only seam. The authenticated (tenant) role gets SELECT policies only for customers; staff
-- get org-scoped read + manage. There is intentionally NO customer insert/update policy.
alter table inspections             enable row level security;
alter table inspection_status_history enable row level security;

-- Inspections: customer reads OWN records (via their customer_profile); staff read + manage org-scoped.
-- (staff_notes is a column → hidden from customers by APP PROJECTION, since RLS is row-level.)
create policy inspections_customer_select on inspections for select
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));
create policy inspections_staff_select on inspections for select
  using (org_id = app_current_org_id() and app_is_staff());
create policy inspections_staff_insert on inspections for insert
  with check (org_id = app_current_org_id() and app_is_staff());
create policy inspections_staff_update on inspections for update
  using (org_id = app_current_org_id() and app_is_staff())
  with check (org_id = app_current_org_id() and app_is_staff());

-- Status history: STAFF read only (customers never read the history ledger directly).
create policy inspection_history_staff_select on inspection_status_history for select
  using (org_id = app_current_org_id() and app_is_staff());

grant select, insert, update on inspections to authenticated;
grant select on inspection_status_history to authenticated;

-- History writes run via the privileged/staff seam (audited). No customer access to history.
