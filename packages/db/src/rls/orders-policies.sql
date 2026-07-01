-- Phase 2: Orders domain RLS (ADR-0008). Applied AFTER the foundation policies.sql.
-- Reuses helpers: auth.uid(), app_current_org_id(), app_has_role(), app_is_staff().
alter table orders      enable row level security;
alter table order_items enable row level security;

-- Customer: only own orders (customer_id → a customer_profile owned by auth.uid()).
create policy orders_customer_select on orders for select
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));
create policy orders_customer_insert on orders for insert
  with check (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));
create policy orders_customer_update on orders for update
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()))
  with check (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));

-- Staff: read all org orders (per-surface role scoping refined in later phases).
create policy orders_staff_select on orders for select
  using (org_id = app_current_org_id() and app_is_staff());
-- Ops / super_admin: update (advance/hold) within org.
create policy orders_staff_update on orders for update
  using (org_id = app_current_org_id() and (app_has_role('operations_manager') or app_has_role('super_admin')))
  with check (org_id = app_current_org_id() and (app_has_role('operations_manager') or app_has_role('super_admin')));

-- order_items follow the parent order's visibility.
create policy order_items_customer_select on order_items for select
  using (order_id in (select id from orders where customer_id in (select id from customer_profiles where auth_user_id = auth.uid())));
create policy order_items_customer_write on order_items for insert
  with check (order_id in (select id from orders where customer_id in (select id from customer_profiles where auth_user_id = auth.uid())));
create policy order_items_staff_select on order_items for select
  using (order_id in (select id from orders where org_id = app_current_org_id() and app_is_staff()));

grant select, insert, update on orders to authenticated;
grant select, insert on order_items to authenticated;

-- Privileged writes (system transitions, seed) go via withPrivilegedDbAccess (RLS bypassed, audited).
