# Phase 2 — Order State Machine

25 states (docs/product/09-order-state-machine.md / contracts/04), encoded in
`apps/borderpass/src/domain/orders/state-machine.ts` (pure, tested).

**States:** draft, submitted, missing_information, under_review, rejected, quote_ready, awaiting_payment,
paid, purchasing, purchased, awaiting_package, received_el_paso, inspection_pending, inspection_passed,
inspection_failed, border_documentation_ready, ready_for_crossing, border_crossing, customs_processing,
arrived_juarez, out_for_delivery, delivered, delivery_failed, cancelled, refunded.
**Terminal:** rejected, cancelled, refunded, delivered.

## Mutation discipline
`LEGAL_TRANSITIONS` table + `assertTransition(from,to)`. **`transitionOrder(tx, order, to, actor, meta)`
is the ONLY status-mutation seam** — it asserts legality, updates status, sets submitted_at/cancelled_reason,
audits `order.status_changed`, and emits an event placeholder. **A durable Inngest workflow wraps this seam
in a later phase**; until then it is the single sanctioned path (no ad-hoc status writes). Phase 2 exercises
draft→submitted (customer submit) and admin advance/hold; the full chain exists but later stages are gated by
quote/payment/inspection (not built).

## Tested
`state-machine.test.ts`: 25 states; legal/illegal transitions; terminal exits; submit-rule checks. Green.
