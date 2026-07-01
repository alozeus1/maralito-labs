# Phase 3 — Order Integration

Quote↔order status changes go **only** through the existing `transitionOrder` seam (never direct writes):

- **Quote sent_to_customer** → if order is `under_review`, cascade order → `quote_ready`
  (`transitionOrderPrivileged`, actor=system, audited). In `sendQuote`.
- **Quote accepted** → if order is `quote_ready`, cascade order → `awaiting_payment`
  (`transitionOrderPrivileged`, actor=customer, audited). In `acceptQuote`.
- **Quote declined** → order stays `under_review` (no forced transition in Phase 3).

**Not done (Phase 4+):** no `paid`, no payment records, no Stripe, no durable workflow wrapping the cascade. Both cascade
targets are legal order transitions (tested). Money stays integer minor units; order status mutates only via the seam.
