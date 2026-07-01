# Phase 2 — Orders RLS

`packages/db/src/rls/orders-policies.sql`, applied after the foundation `policies.sql`. Reuses
`auth.uid()`, `app_current_org_id()`, `app_has_role()`, `app_is_staff()`.

- **orders:** customer select/insert/update where `customer_id ∈ (customer_profiles owned by auth.uid())`;
  staff select where `org_id = app_current_org_id() and app_is_staff()`; ops_manager/super_admin update in org.
- **order_items:** follow parent-order visibility (customer-owned or staff-in-org).
- Privileged writes (system transitions/seed) via `withPrivilegedDbAccess` (RLS bypass, audited).

## Verified (real PGlite, both policy files)
`packages/db/tests/orders-rls.isolation.test.ts` — 5 scenarios: customer sees only own order; cannot read
another's order/items; ops sees all org orders; missing-claims denied; cannot insert an order for another
customer (with-check). **This proves the policy files under Postgres — NOT the Supabase deployment (live gate PENDING).**
