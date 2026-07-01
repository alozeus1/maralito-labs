# Phase 1.6 — Privileged DB Access

`withServiceRole` was misleading — it never used the Supabase `service_role` API key; it ran on the privileged base DB connection.

## Now: `withPrivilegedDbAccess(reason, fn)`
- **Meaning:** run as the privileged base `DATABASE_URL` connection role → **RLS bypassed by design**. NOT the Supabase service_role key.
- **Requires** a `reason` (≥3 chars); **audited** where practical (callers pair a `writeAudit`).
- **Allowed only for:** seed/bootstrap, audit writes, role/admin maintenance, **new-user provisioning**, system ops that can't run as the tenant.
- **Never** for normal customer/admin tenant reads — those use `withTenant`.
- **Server-only** (`import 'server-only'` on the app modules that use it).
- `withServiceRole` kept as a thin **@deprecated alias** to avoid churn.

## Tenant vs privileged
| Helper | RLS | Use |
|--------|:---:|-----|
| `withTenant(ctx, fn)` | enforced | all tenant data |
| `withPrivilegedDbAccess(reason, fn)` | bypassed (audited) | the narrow privileged cases above |
| `createRawDbClient` | bypassed | internal only (migrations/seed/tests) |
