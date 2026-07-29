-- Production-readiness: user_sessions RLS (Auth/Session hardening).
-- Applied AFTER policies.sql (it reuses the auth.uid() helper installed/assumed there).
--
-- Threat model for this table: a `user_sessions` row is a security control record. Reading someone
-- else's rows leaks their device/activity pattern; WRITING one is a session-forgery or
-- revocation-evasion primitive. So:
--
--   * SELECT  -> OWN rows only, keyed on auth.uid(). There is deliberately NO staff/admin select
--                policy: staff have no operational need to browse other people's live sessions, and
--                security review of session activity is served by audit_logs (already restricted to
--                compliance_admin / super_admin in policies.sql) plus the privileged server seam.
--   * INSERT/UPDATE/DELETE -> NO policy at all. Session creation, idle-window sliding, expiry marking
--                and revocation run exclusively through the privileged server-only seam
--                (session-registry.ts -> withPrivilegedDbAccess), which uses the owner-capable base
--                connection and bypasses RLS. "A client cannot forge, extend, or un-revoke a session"
--                is therefore enforced by the ABSENCE of any tenant write policy, and belt-and-braces
--                by withholding the insert/update/delete grants below.
--
-- anon: gets no grant and no policy -> denied outright.
alter table user_sessions enable row level security;

-- Own sessions only. Note this is intentionally NOT org-scoped-and-staff-readable like the domain
-- tables; the owner predicate is the whole policy.
drop policy if exists user_sessions_self_select on user_sessions;
create policy user_sessions_self_select on user_sessions for select
  using (auth_user_id = auth.uid());

-- SQL privileges are evaluated BEFORE RLS policies, so this grant is required on real Supabase for the
-- self-select policy to be reachable. Only `select` is granted: no insert/update/delete for tenants.
grant select on user_sessions to authenticated;
