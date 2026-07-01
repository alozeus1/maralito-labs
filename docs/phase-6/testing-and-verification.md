# Phase 6 — Testing & Verification

> ADR-0012 · development-only.

## Committed tests
- Pure domain: `src/domain/inspections/{state-machine,rules,copy}.test.ts`,
  `src/domain/delivery/{state-machine,rules,copy}.test.ts`.
- RLS isolation (PGlite, real policy files): `packages/db/tests/inspections-rls.isolation.test.ts`,
  `delivery-preparations-rls.isolation.test.ts`, `notification-outbox-lifecycle.test.ts`.

## Coverage
- **State machines:** legal/illegal transitions, terminal states (no out-edges), `assert` throws.
- **Rules:** `canStartInspection`, `inspectionOrderJoinTarget`, `shouldNotifyInspection`;
  `canCreateDeliveryPrep`, `canScheduleDeliveryPrep`, `deliveryOrderJoinTarget`, `shouldNotifyDelivery`.
- **Order joins:** verified the driven edges exist in the real order machine
  (`inspection_pending→inspection_passed/failed`, `arrived_juarez→out_for_delivery`) — **no new states**;
  joins are only-if-expected and go through `transitionOrderPrivileged`.
- **RLS:** inspection 9/9, delivery 9/9 — customer own-read, not-other, ops org read/manage, customer
  insert rejected + update 0-rows, history customer-blocked/staff-allowed, missing-claims, cross-customer.
- **Notification lifecycle:** idempotency (one row per record+status; duplicate no-op) + RLS (customer
  own-read, staff org, no customer write, missing-claims) — 7/7.
- **Guards/greps:** no `update(orders)` in inspection/delivery files; seams use `transitionOrderPrivileged`
  only; customer reads exclude `staff_notes`/`delivery_address_ref`/history/actor; no PII columns; no
  provider/courier/maps/network/send in 6.x server files. `check:db-imports` + `check:client-stripe` green;
  `packages/db` + `packages/validation` typechecks green.

## Sandbox limitation (restated)
**Vitest cannot launch in this sandbox** because the prebuilt `node_modules` has an arch-mismatched Rollup
native binding. Every committed `.test.ts` was verified by running its exact logic through equivalent
transpile/assert + PGlite harnesses. The **full Vitest suite and the full Next app build + app-server
typecheck must run in the real environment** (a Phase 7 gate).

## Deferred to real env
Seam-level DB execution of `transitionInspection`/`transitionDeliveryPrep` (and the emit/notify side effects)
end-to-end; full app build/typecheck; CI green.
