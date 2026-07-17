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
alter table refund_status_history enable row level security;  -- Phase 8D (ADR-0015)
alter table payment_disputes      enable row level security;  -- Phase 8D (ADR-0015)

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

-- Refunds (Phase 8D): customer reads refunds for OWN payments (direct customer_id, matching payments);
-- staff read org-scoped. NO tenant write policy → all refund writes go through the privileged transitionRefund seam.
create policy refunds_customer_select on refunds for select
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));
create policy refunds_staff_select on refunds for select
  using (org_id = app_current_org_id() and app_is_staff());

-- Refund status history (Phase 8D): STAFF read only (org-scoped), like payment_events / quote_status_history.
-- Customers never read the history ledger directly; their UI uses the projected refund record.
create policy refund_status_history_staff_select on refund_status_history for select
  using (org_id = app_current_org_id() and app_is_staff());

-- Payment disputes (Phase 8D): customer reads disputes on OWN payments; staff read org-scoped.
-- Record-only; no tenant write policy (all writes via the privileged webhook handler).
create policy payment_disputes_customer_select on payment_disputes for select
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));
create policy payment_disputes_staff_select on payment_disputes for select
  using (org_id = app_current_org_id() and app_is_staff());

grant select, update on payments to authenticated;
grant select on payment_events, refunds to authenticated;
grant select on refund_status_history, payment_disputes to authenticated;
