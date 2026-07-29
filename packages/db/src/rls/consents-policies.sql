-- LEGAL REVIEW REQUIRED — consent evidence RLS. Applied AFTER policies.sql (needs auth.uid()).
--
-- consent_records is an APPEND-ONLY EVIDENCE LEDGER: it records that a user accepted a specific
-- version of the Terms / Privacy Notice, and their transactional vs marketing notification choices.
-- Because the rows are evidence, tenants may READ THEIR OWN and nothing else — no insert, no update,
-- no delete. Withdrawal is a NEW row (granted = false) written by the server seam, never a mutation.
--
-- Writes run ONLY via the privileged server-only seam (apps/borderpass/src/server/consent.ts →
-- withPrivilegedDbAccess), which bypasses RLS on the owner connection.
--
-- Staff deliberately get NO policy here (same stance as addresses-policies.sql): staff do not browse
-- other people's consent decisions from the app. Compliance/ARCO retrieval goes through the
-- privileged, audited server seam instead.
alter table consent_records enable row level security;

-- The subject of the record reads their OWN consent history (needed to answer "what did I agree to?"
-- and to support ARCO access requests without a staff round-trip).
drop policy if exists consent_records_self_select on consent_records;
create policy consent_records_self_select on consent_records for select
  using (auth_user_id = auth.uid());

-- Least-privilege SQL grants (required on real Supabase BEFORE Postgres evaluates policies).
-- SELECT only, and explicitly no write privileges for the tenant role.
grant select on consent_records to authenticated;
revoke insert, update, delete on consent_records from authenticated;

-- Hardening follow-up (documented, not yet applied): an immutability TRIGGER that rejects UPDATE and
-- DELETE for every role, including the owner connection. Not enabled here because it would also block
-- legitimate migration/backfill operations; decide with counsel + the operator before enabling.
