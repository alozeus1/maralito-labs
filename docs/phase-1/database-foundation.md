# Phase 1 — Database Foundation

**ORM:** Drizzle (confirmed, ADR 0002). **DB:** Supabase Postgres. **Migrations:** Drizzle Kit, forward-only, RLS shipped alongside.

## Tables (Phase 1 subset — not the full 18-entity model)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `organizations` | tenant boundary | id (`org_…`), name, type, status |
| `user_identities` | maps Supabase `auth.users.id` → org + lifecycle | id (`uid_…`), auth_user_id (uuid, unique), org_id, status |
| `customer_profiles` | BorderPass-side customer profile (contracts B1) | id (`cust_…`), auth_user_id, org_id, display_name, language, notification_prefs |
| `staff_profiles` | staff profile (contracts B2) | id (`staff_…`), auth_user_id, org_id, display_name, role_keys, status |
| `roles` | 9 app roles | key (PK), name, scope |
| `permissions` | permission catalog | key (PK), description |
| `role_permissions` | role→permission map | (role_key, permission_key) |
| `user_roles` | user→role assignment in org | id (`ur_…`), auth_user_id, org_id, role_key, assigned_by |
| `audit_logs` | append-only audit baseline | id (`aud_…`), actor, action, entity, before/after, metadata, ip, ua |
| `platform_config` | config placeholder | key (PK), value |
| `feature_flags` | flag placeholder | key (PK), enabled, description |

## Conventions
- **IDs:** prefixed, time-sortable (`newId(prefix)`; swap for a real ULID lib later).
- **Money** (later tables): integer minor units + currency — never floats.
- **Timestamps:** `timestamptz default now()`.
- **Status/enums:** TS unions via `$type<>()`; canonical values per `contracts/04`.
- **Ownership:** platform-owned entities (User/Org/Role/Audit) are mirrored **locally** in Phase 1 (ADR-0005); they become SDK-backed later.

## Migration flow (real env)
1. `pnpm --filter @maralito/db db:generate` (TS schema → SQL).
2. Review SQL in `packages/db/migrations/`.
3. `db:migrate` to apply DDL.
4. Apply `src/rls/policies.sql` (RLS enable + policies) as the follow-on step.
5. `db:seed` (dev only) — org + 9 roles + sample permissions + optional super_admin.

## Deferred
Domain tables (orders, quotes, packages, inspections, …), RFC/KYC fields (await KMS), full role→permission matrix, status-history projection. Status mutated only via workflows from Phase 2+.
