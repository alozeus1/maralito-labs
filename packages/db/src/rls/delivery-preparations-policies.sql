-- Phase 6: Delivery-preparation domain RLS (ADR-0012). Applied AFTER policies.sql + orders/quotes/
-- payments/notifications/inspections policy files. Reuses helpers: auth.uid(), app_current_org_id(), app_is_staff().
--
-- Writes (create + status transitions + history) run via staff actions (withTenant staff) and/or the
-- privileged server-only seam. The authenticated (tenant) role gets customer SELECT only; staff get
-- org-scoped read + manage. There is intentionally NO customer insert/update policy.
alter table delivery_preparations          enable row level security;
alter table delivery_prep_status_history   enable row level security;

-- Delivery preparations: customer reads OWN records; staff read + manage org-scoped.
-- (staff_notes + delivery_address_ref are columns → hidden from customers by APP PROJECTION later.)
create policy delivery_prep_customer_select on delivery_preparations for select
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));
create policy delivery_prep_staff_select on delivery_preparations for select
  using (org_id = app_current_org_id() and app_is_staff());
create policy delivery_prep_staff_insert on delivery_preparations for insert
  with check (org_id = app_current_org_id() and app_is_staff());
create policy delivery_prep_staff_update on delivery_preparations for update
  using (org_id = app_current_org_id() and app_is_staff())
  with check (org_id = app_current_org_id() and app_is_staff());

-- Status history: STAFF read only (customers never read the history ledger directly).
create policy delivery_prep_history_staff_select on delivery_prep_status_history for select
  using (org_id = app_current_org_id() and app_is_staff());

grant select, insert, update on delivery_preparations to authenticated;
grant select on delivery_prep_status_history to authenticated;

-- History writes run via the privileged/staff seam (audited). No customer access to history.
