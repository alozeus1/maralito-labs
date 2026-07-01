-- Phase 4: Payments domain RLS (ADR-0010). Applied AFTER policies.sql + orders-policies.sql + quotes-policies.sql.
-- Reuses helpers: auth.uid(), app_current_org_id(), app_is_staff().
--
-- Writes: ALL payment writes (create + transitions + webhook ledger) run via the privileged server-only
-- seam (withPrivilegedDbAccess), which uses the base connection role and bypasses RLS. Therefore the
-- authenticated (tenant) role gets SELECT policies only — there is intentionally NO customer insert/update,
-- so "customers cannot update payment records directly" is enforced by the ABSENCE of a write policy.
alter table payments              enable row level security;
alter table payment_events        enable row level security;
alter table stripe_webhook_events enable row level security;
alter table refunds               enable row level security;

-- Payments: customer reads OWN payments (via their customer_profile); staff read org-scoped.
create policy payments_customer_select on payments for select
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));
create policy payments_staff_select on payments for select
  using (org_id = app_current_org_id() and app_is_staff());

-- Payment events: STAFF read only (org-scoped). Customers never read the event ledger directly;
-- their UI uses the projected payment record. (Mirrors quote_status_history being staff-only.)
create policy payment_events_staff_select on payment_events for select
  using (org_id = app_current_org_id() and app_is_staff());

-- Stripe webhook ledger: NO tenant access at all (no org scoping; internal idempotency ledger).
-- RLS is enabled with NO policy → the authenticated role can never read it. Access is privileged-only.

-- Refunds (placeholder): customer reads refunds for OWN payments; staff read org-scoped.
create policy refunds_customer_select on refunds for select
  using (payment_id in (
    select id from payments where customer_id in
      (select id from customer_profiles where auth_user_id = auth.uid())));
create policy refunds_staff_select on refunds for select
  using (org_id = app_current_org_id() and app_is_staff());

grant select, update on payments to authenticated;
grant select on payment_events, refunds to authenticated;
