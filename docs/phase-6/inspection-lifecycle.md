# Phase 6 — Inspection Lifecycle

> ADR-0012 · development-only · domain sub-status record (NOT an order state).

## Schema
`inspections` (`packages/db/src/schema/inspections.ts`): `id` (`insp_`), org/customer/order refs, `status`,
nullable `result`, `staff_notes` (staff-only), `customer_summary` (neutral), `scheduled_for`, `completed_at`,
timestamps. `inspection_status_history` (staff-only). **No PII/address/document columns.**

## Sub-status machine
`scheduled → in_progress → {passed | failed}`; `in_progress ↔ on_hold`. Terminals `passed`/`failed`. Pure
(`src/domain/inspections/state-machine.ts`); changes only via the `transitionInspection` seam.

## Staff actions (`app/actions/admin-inspections.ts`)
`createInspection` (gated by `canStartInspection` → order must be `paid`+), `startInspection`, `holdInspection`,
`resumeInspection`, `passInspection`, `failInspection`. All `requireAdminAccess` + `withTenant`; illegal
transitions → `conflict_state`. Read-only `getOrderInspectionForStaff` for the admin panel.

## Customer-safe summary (`app/actions/inspections.ts`)
`getMyOrderInspection(orderId)` returns `{order_id, inspection_id, status, result, customer_summary,
scheduled_for, completed_at}` only — **never** `staff_notes`, history, actor metadata, or PII.

## Order join (existing edges only)
`transitionInspection`, on a terminal result and only when the order is at `inspection_pending`, drives
`inspection_pending → inspection_passed | inspection_failed` via `transitionOrderPrivileged` (idempotent,
only-if-expected). It never updates `orders` directly and never forces an illegal transition. **No new order states.**

## Audit / events
Audit: `inspection.created/started/held/resumed/passed/failed` (status only — no `staff_notes`/PII).
Event placeholder `emitInspectionEvent` (no-op). Milestone notification placeholder on `passed`/`failed`.

## RLS
Customer own-read; staff/ops org read + manage; no customer writes; history staff-only; cross-org isolated;
missing claims → none.
