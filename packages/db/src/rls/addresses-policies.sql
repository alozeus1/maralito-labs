-- Address RLS (ADR-0012 strict address policy). Applied AFTER policies.sql. PII lives in *_enc
-- columns (sealed). Only the OWNING customer may read/write; staff have NO policy here and therefore
-- cannot read address PII — fulfillment references the opaque address id on the order instead.
alter table addresses enable row level security;

create policy addresses_customer_select on addresses for select
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));
create policy addresses_customer_insert on addresses for insert
  with check (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));
create policy addresses_customer_update on addresses for update
  using (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()))
  with check (customer_id in (select id from customer_profiles where auth_user_id = auth.uid()));

grant select, insert, update on addresses to authenticated;
-- No staff select/insert grant policy: staff never see address PII (only the opaque order ref).
