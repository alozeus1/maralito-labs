# Phase 6 — Post-Payment Order Lifecycle Foundation — Completion Report

> **Status:** ✅ COMPLETE (dev-only; code + pure/real-Postgres/guard checks) · **Live gates NOT run (release blockers)** · **Date:** 2026-06-30 · ADR-0012

## 1. Increments
| # | Increment | Status |
|---|-----------|--------|
| 6.1 | Inspection schema + RLS + sub-status machine | ✅ |
| 6.2 | Inspection actions + order join + customer summary | ✅ |
| 6.3 | Delivery-prep schema + RLS + machine + address policy | ✅ |
| 6.4 | Delivery-prep actions + delivery order edges + customer summary | ✅ |
| 6.5 | Admin ops surface + customer read-only visibility | ✅ |
| 6.6 | Events/audit placeholders + scoped notification enqueue | ✅ |
| 6.7 | Tests consolidation | ✅ |
| 6.8 | Docs + ADR-0012 + Phase 7 checklist | ✅ this report |

## 2. Implemented behavior
Staff create + drive an **inspection** (`scheduled → in_progress ↔ on_hold → passed/failed`) for a paid order;
on a terminal result the order advances `inspection_pending → inspection_passed/failed` via `transitionOrder`
(only-if-expected). Staff create + drive a **delivery preparation** (`pending → preparing → ready → scheduled →
handed_off`) for a post-inspection order; on `handed_off` the order advances `arrived_juarez → out_for_delivery`.
Readiness/scheduling are record sub-statuses, not order states. Customers see read-only own-order inspection +
delivery summaries (no internal/PII). Milestones emit placeholder events + enqueue idempotent placeholder
`notification_outbox` rows (no send). **No new order states; no real address PII; no provider sends.**

## 3. Files (high level)
Schema: `inspections.ts`, `delivery-preparations.ts`, `notifications.ts` (additive); RLS: `inspections-policies.sql`,
`delivery-preparations-policies.sql`. Domain: `inspections/{state-machine,rules,copy}.ts`,
`delivery/{state-machine,rules,copy}.ts`. Seams: `inspection-transitions.ts`, `delivery-transitions.ts`,
`inspection-events.ts`, `delivery-events.ts`, `notifications.ts`. Actions: `admin-inspections.ts`,
`inspections.ts`, `admin-delivery.ts`, `delivery.ts`. Validation: `inspections.ts`, `delivery.ts`. UI: admin
`InspectionPanel.tsx`/`DeliveryPanel.tsx` + admin/customer detail pages. Docs: `docs/phase-6/*` + ADR-0012.

## 4. Tests / checks (verified via sandbox-equivalent harnesses; Vitest runs in real env)
- **Pure domain:** inspection + delivery state machines (legal/illegal/terminal/assert); rules
  (`canStartInspection`, `inspectionOrderJoinTarget`, `shouldNotifyInspection`; `canCreateDeliveryPrep`,
  `canScheduleDeliveryPrep`, `deliveryOrderJoinTarget`, `shouldNotifyDelivery`); status labels — all pass.
- **Order joins:** the driven edges exist in the real order machine — no new states.
- **RLS (PGlite, real policy files):** inspection **9/9**, delivery **9/9**, notification lifecycle **7/7**.
- **Guards/greps:** no `update(orders)` in inspection/delivery files; seams use `transitionOrderPrivileged`
  only; customer reads exclude `staff_notes`/`delivery_address_ref`/history/actor; no PII columns; no
  provider/courier/maps/network/send. `check:db-imports` + `check:client-stripe` green; `packages/db` +
  `packages/validation` typechecks green.

## 5. Invariants honored
Order status only via `transitionOrder`; inspection only via `transitionInspection`; delivery-prep only via
`transitionDeliveryPrep`; payment only via `transitionPayment`; webhook is source of truth for `paid`;
post-payment lifecycle gated on `paid`+; customers read-only; staff/ops write only; no raw DB client in
`apps/**`; no card/secret/PII/address content logged or stored; **development-only**.

## 6. Known limitations / NOT done
- **Vitest can't launch in this sandbox** (arch-mismatched Rollup) — logic verified via equivalent harnesses;
  full Vitest + Next build + app-server typecheck run in the real env (a Phase 7 gate).
- Real address PII (KMS-gated), real notification provider/sends, delivery/courier provider + maps,
  refund/dispute, AI automation — all deferred.

## 7. Recommendation
Phase 6 is complete and proven locally. The next phase should be **Phase 7 — Live-Gate Hardening + Real
Environment Validation** (ADR-0013): run the live Supabase RLS gate (now across all domains), real
install/build/CI, Stripe test-mode smoke, OTP smoke, and make the KMS decision — before adding more product surface.

> Live deployment remains blocked. Dev foundation ready for post-completion verification + Phase 7 planning.
