# Phase 6 — Delivery Preparation

> ADR-0012 · development-only · domain sub-status record (NOT an order state). Address-ref only.

## Schema
`delivery_preparations` (`packages/db/src/schema/delivery-preparations.ts`): `id` (`dlp_`), org/customer/order
refs, `status`, **`delivery_address_ref`** (opaque reference only), `scheduled_window_start/end` (non-PII),
`staff_notes` (staff-only), `customer_summary` (neutral), timestamps. `delivery_prep_status_history`
(staff-only). **No street/recipient/phone/postal/address-body/RFC/KYC/document columns.**

## Sub-status machine
`pending → preparing → ready → scheduled → handed_off` (linear); `handed_off` terminal. Pure
(`src/domain/delivery/state-machine.ts`); changes only via the `transitionDeliveryPrep` seam. `ready` and
`scheduled` are record sub-statuses — **not** order states.

## Staff actions (`app/actions/admin-delivery.ts`)
`createDeliveryPrep` (gated by `canCreateDeliveryPrep` → order must be post-inspection: `inspection_passed`
… `arrived_juarez`), `markPreparing`, `markReady`, `scheduleDelivery` (non-PII window; `ready` only),
`markHandedOff`. All `requireAdminAccess` + `withTenant`. Read-only `getOrderDeliveryForStaff` for the panel.

## Customer-safe summary (`app/actions/delivery.ts`)
`getMyOrderDelivery(orderId)` returns `{order_id, delivery_prep_id, status, customer_summary,
scheduled_window_start, scheduled_window_end, updated_at}` only — **never** `staff_notes`,
`delivery_address_ref`, history, actor metadata, or any address/PII.

## Order handoff (existing edge only)
`transitionDeliveryPrep`, on `handed_off` and only when the order is at `arrived_juarez`, drives
`arrived_juarez → out_for_delivery` via `transitionOrderPrivileged` (idempotent, only-if-expected). The
order's `delivered`/`delivery_failed` edges remain the existing admin order action. **No new order states.**

## Scheduling placeholder
A non-PII time window only (`scheduled_window_start/end`). No courier, no maps, no route optimization, no
real address. Real address/PII is deferred until KMS is confirmed.

## RLS
Customer own-read; staff/ops org read + manage; no customer writes; history staff-only; cross-org isolated;
missing claims → none.
