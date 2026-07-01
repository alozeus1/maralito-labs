-- Phase 5: Notification outbox RLS (ADR-0011). Applied AFTER policies.sql + orders/quotes/payments policies.
-- Reuses helpers: auth.uid(), app_current_org_id(), app_is_staff().
--
-- Writes run ONLY via the privileged server-only seam (queuePaymentReceipt → withPrivilegedDbAccess),
-- which bypasses RLS. The authenticated (tenant) role gets SELECT policies only — there is intentionally
-- NO customer insert/update, so customers cannot write notification rows.
alter table notification_outbox enable row level security;

-- Customer reads OWN queued notification METADATA only (references + status; no body/PII exists).
create policy notification_outbox_customer_select on notification_outbox for select
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));

-- Staff/admin/ops read org-scoped.
create policy notification_outbox_staff_select on notification_outbox for select
  using (org_id = app_current_org_id() and app_is_staff());

grant select on notification_outbox to authenticated;
