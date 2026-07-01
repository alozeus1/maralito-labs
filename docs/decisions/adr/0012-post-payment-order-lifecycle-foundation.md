# ADR 0012 — Post-Payment Order Lifecycle Foundation: Inspection + Delivery Preparation (dev-only)

- **Status:** Accepted (development-only; live gates block release) · **Date:** 2026-06-30 · **Phase:** 6
- **Numbering:** 0012 = Post-payment lifecycle (inspection + delivery prep). Next ADR = 0013.

## Context
Phases 2–5 built orders → quotes → payments → payment-confirmation UX. Phase 6 begins the **operational
foundation for what happens after an order is `paid`**: inspection and delivery preparation. No live
Supabase/Stripe environment exists, so the live gates remain release blockers.

## Decisions

1. **Inspection + delivery preparation are DOMAIN sub-status records, not order states.** Each is its own
   table with its own pure sub-status machine. **No new order states were added** — the canonical 25-state
   order machine already contains the full post-payment lifecycle.

2. **Order status changes only through the existing `transitionOrder` / `transitionOrderPrivileged` edges.**
   The domain seams drive the order at exactly two existing join points, idempotently and only-if-in-expected-state:
   - **Inspection join:** on a terminal inspection result, when the order is at `inspection_pending`:
     `inspection_pending → inspection_passed` (passed) or `inspection_pending → inspection_failed` (failed).
   - **Delivery handoff join:** on `handed_off`, when the order is at `arrived_juarez`:
     `arrived_juarez → out_for_delivery`.
   Both edges were verified to exist in `LEGAL_TRANSITIONS`. No file directly mutates the `orders` table.

3. **Readiness/scheduling are delivery-prep record sub-statuses, NOT order states.** `ready` and `scheduled`
   live on the `delivery_preparations` record (`pending → preparing → ready → scheduled → handed_off`). We did
   **not** introduce order states like `delivery_ready` or `delivery_scheduled`.

4. **Inspection sub-status machine:** `scheduled → in_progress → {passed | failed}`, with `in_progress ↔ on_hold`.
   Terminals `passed`/`failed`. Status changes only via `transitionInspection`.

5. **Address policy (strict).** Delivery prep stores **only an opaque `delivery_address_ref`** + **non-PII
   scheduling windows** (`scheduled_window_start/end`). It MUST NOT store street, recipient name, phone,
   postal code, address body, RFC/KYC, or document content. **Real address/PII storage is deferred until
   KMS/secret-management is confirmed** (a standing blocker).

6. **Notification/event placeholders.** `emitInspectionEvent` / `emitDeliveryEvent` are no-op envelope
   stubs (no bus, no send). On approved milestones — inspection `passed`/`failed`; delivery
   `ready`/`scheduled`/`handed_off` — a placeholder `notification_outbox` row is enqueued, idempotent
   (`inspection_update:<id>:<status>` / `delivery_update:<id>:<status>`), with **references + queue metadata
   only**: no provider, no send, no rendered message body, no PII. `notification_outbox` gained nullable
   `inspection_id` / `delivery_prep_id` and `payment_id` became nullable (clean additive change).

7. **RLS/security.** Customers read only their own inspection/delivery records (safe projections); staff/ops
   read + manage org-scoped; **no customer writes** (privileged/staff seam only); status history is staff-only;
   cross-org isolated. `staff_notes` and `delivery_address_ref` are never projected to customers.

## Why development-only
No live Supabase, no real `pnpm install`/CI, no KMS decision, no Stripe gate. All verification is local
(pure logic, real-Postgres via PGlite, guard greps). Handling real address PII requires KMS first.

## Release blockers that remain open
Live Supabase RLS gate (now incl. inspections + delivery-preparations policies); real `pnpm install` +
committed lockfile + full app build/app-server typecheck + CI green; live two-user RLS isolation; OTP live
smoke; KMS/secret-management decision; preview branching; Stripe test-mode smoke + live validation.

## Deferred (future phases)
Real address/PII (KMS-gated), real notification provider (Resend/Twilio/WhatsApp), delivery/courier provider
+ maps/route optimization, refund/dispute expansion, AI inspection/delivery automation, accounting/customs/tax.

## Verified (pure / real-Postgres via PGlite / guards)
Inspection + delivery state machines; precondition + order-join + milestone-gate rules; inspection RLS (9),
delivery RLS (9), notification lifecycle RLS + idempotency (7); no-direct-`update(orders)` + no-PII greps;
`check:db-imports` + `check:client-stripe`; packages/db + validation typechecks. **Live gates NOT run.**
