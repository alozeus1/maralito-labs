# Phase 5 — Customer Payment Confirmation UX

> ADR-0011 · development-only · the **webhook is the source of truth**; client confirm is advisory.

## Route
`app/(customer)/orders/[orderId]/pay/page.tsx` (server) + `PaymentConfirm.tsx` (client). Protected by
the `(customer)` layout guard (auth + customer access).

## Flow
1. **Server load:** `getMyOrderPaymentSummary(orderId)` (RLS-scoped, safe projection) → `display_state`.
2. **Gate:** only `ready_to_pay` / `requires_action` (`shouldShowPaymentForm`) render the form; the server
   then calls `initiateQuotePayment` (Phase 4 idempotent) to obtain a `client_secret`.
3. **Client confirm:** Stripe Elements `PaymentElement` + `stripe.confirmPayment({ redirect: 'if_required' })`.
   The result is **advisory** — on a clean confirm the UI moves to `processing`.
4. **Server-authoritative status:** the client **polls** `getMyOrderPaymentSummary` while `processing` and
   stops on a settled state. The **"Paid" view renders only when the server says `succeeded`** (`isPaidView`).

## States
`ready_to_pay`, `processing`, `requires_action`, `succeeded`, `failed`, `canceled`, `none`, payments-not-
configured fallback, and a Stripe error state. Copy never claims "paid" before the server confirms it
(`processing` says "this can take a moment").

## Retry + return
Retry (offered for `failed` / `ready_to_pay`) reuses the **same** PaymentIntent/`client_secret` — no
duplicate payment row, no duplicate intent. "Return to your order" links to the customer route
`/orders/{orderId}/quote`. Stripe `return_url` points back to the pay page so polling resumes after 3DS.

## Invariants
Client has no DB/privileged path → cannot mark payment succeeded or order paid. Payment status changes only
via `transitionPayment`; order status only via `transitionOrder`; webhook drives `succeeded`/`paid`. No card
data/secret logged; only the publishable key + server-issued `client_secret` reach the browser.
