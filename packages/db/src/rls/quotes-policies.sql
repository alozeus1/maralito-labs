-- Phase 3: Quotes domain RLS (ADR-0009). Applied AFTER policies.sql + orders-policies.sql.
-- Reuses helpers: auth.uid(), app_current_org_id(), app_is_staff().
alter table quotes               enable row level security;
alter table quote_line_items     enable row level security;
alter table quote_status_history enable row level security;
alter table quote_approvals      enable row level security;

-- Quotes: customer reads quotes for OWN orders; staff read+write in org.
-- (Status transitions run via the audited privileged seam; draft edits via staff update.)
create policy quotes_customer_select on quotes for select
  using (order_id in (select id from orders where customer_id in (select id from customer_profiles where auth_user_id = auth.uid())));
create policy quotes_staff_select on quotes for select
  using (org_id = app_current_org_id() and app_is_staff());
create policy quotes_staff_insert on quotes for insert
  with check (org_id = app_current_org_id() and app_is_staff());
create policy quotes_staff_update on quotes for update
  using (org_id = app_current_org_id() and app_is_staff())
  with check (org_id = app_current_org_id() and app_is_staff());

-- Line items: customer sees ONLY customer_visible AND NOT internal_only for own quotes; staff see all.
create policy qli_customer_select on quote_line_items for select
  using (customer_visible = true and internal_only = false
    and quote_id in (select id from quotes where order_id in
      (select id from orders where customer_id in (select id from customer_profiles where auth_user_id = auth.uid()))));
create policy qli_staff_select on quote_line_items for select
  using (quote_id in (select id from quotes where org_id = app_current_org_id() and app_is_staff()));
create policy qli_staff_write on quote_line_items for insert
  with check (quote_id in (select id from quotes where org_id = app_current_org_id() and app_is_staff()));

-- Status history + approvals: STAFF read only (customers never see these). Writes via privileged seam.
create policy qsh_staff_select on quote_status_history for select
  using (quote_id in (select id from quotes where org_id = app_current_org_id() and app_is_staff()));
create policy qap_staff_select on quote_approvals for select
  using (quote_id in (select id from quotes where org_id = app_current_org_id() and app_is_staff()));

-- Quote/order status transitions + history/approval writes run via withPrivilegedDbAccess (audited).
-- internal_notes (a quotes column) is hidden from customers by APP PROJECTION (RLS is row-level).
