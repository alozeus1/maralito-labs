-- Messaging RLS. Applied AFTER the foundation policies.sql. Reuses helpers: auth.uid(),
-- app_current_org_id(), app_is_staff().
alter table messages enable row level security;

-- Customer: sees only messages on threads they own (customer_id → a profile owned by auth.uid()).
create policy messages_customer_select on messages for select
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));
-- Customer may post ONLY as themselves and ONLY as sender_role = 'customer'.
create policy messages_customer_insert on messages for insert
  with check (
    sender_role = 'customer'
    and customer_id in (select id from customer_profiles where auth_user_id = auth.uid())
  );

-- Staff: read/reply within their org; staff messages must be sender_role = 'staff'.
create policy messages_staff_select on messages for select
  using (org_id = app_current_org_id() and app_is_staff());
create policy messages_staff_insert on messages for insert
  with check (org_id = app_current_org_id() and app_is_staff() and sender_role = 'staff');

grant select, insert on messages to authenticated;
-- Messages are append-only from the app; no update/delete grant (edits/redaction go via privileged access).
