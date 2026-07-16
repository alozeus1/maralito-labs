-- Phase 8D: Resend delivery-webhook tables RLS. Applied AFTER the foundation policies.sql.
--
-- resend_webhook_events + email_suppressions are INTERNAL: written and read only through the
-- privileged server seam (the Resend webhook route + the send path's suppression check), which
-- bypasses RLS. The authenticated (tenant) role is granted NOTHING on these tables and gets no
-- policies, so customers and staff cannot read or write them. RLS is enabled as defense in depth.
alter table resend_webhook_events enable row level security;
alter table email_suppressions enable row level security;

-- Intentionally NO `grant ... to authenticated` and NO policies for either table.
