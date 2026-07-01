# ADR 0011 — Customer Payment Confirmation UX + Notifications Foundation (dev-only)

- **Status:** Accepted (development-only; live gates block release) · **Date:** 2026-06-30 · **Phase:** 5
- **Numbering:** 0011 = Payment confirmation UX + receipt foundation. Next ADR = 0012.

## Context
Phase 4 delivered the backend payment foundation (PaymentIntent, webhook, payment state machine, RLS).
Phase 5 completes the **customer-facing** payment loop: a customer confirms an accepted quote with Stripe
Elements and sees clear status feedback, plus a placeholder receipt foundation. No live Stripe/Supabase
environment exists, so the live gates remain release blockers.

## Decisions

1. **Stripe Elements client confirmation.** The customer pays via `@stripe/react-stripe-js` `PaymentElement`
   using the server-issued PaymentIntent `client_secret`. We use `stripe.confirmPayment({ redirect: 'if_required' })`.

2. **Publishable-key client boundary.** Only `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public, `pk_test_…` in
   dev) reaches the browser, loaded by a memoized client-only loader (`src/client/stripe.ts`). The secret
   key + webhook secret stay server-only. A CI guard (`scripts/check-client-stripe-boundary.mjs`) fails the
   build if any client module references the server Stripe surface.

3. **The webhook remains the source of truth.** The immediate `confirmPayment` result is **advisory only**.
   After a clean confirm the UI moves to `processing` and **polls the server summary**; the success ("Paid")
   view renders **only** when the server's display state is `succeeded` (i.e. payment `succeeded` / order
   `paid`, which only the webhook can produce). There is **no optimistic paid state**, and the client can
   never mark a payment succeeded or an order paid (it has no DB/privileged path).

4. **Server-authoritative status + retry-safe.** Display state derives from the persisted, webhook-driven
   payment + order status (`toPaymentDisplayState`, pure + exhaustively tested). Retry reuses the Phase 4
   idempotent PaymentIntent (same `client_secret`) — no duplicate payment row, no duplicate intent.

5. **Notification outbox placeholder.** A `notification_outbox` table queues exactly one placeholder receipt
   per webhook-driven `payment.succeeded` (idempotent `receipt:<payment_id>`). It stores **references + queue
   metadata only** — no message body, email, phone, address, card data, RFC/KYC/PII, or raw payload. There is
   **no provider, no send, no rendering**. RLS: customers read their own metadata, staff org-scoped, no customer
   writes (privileged seam only).

6. **Read-only visibility.** Customers see their own payment status; staff/ops/finance see an org-scoped,
   read-only summary on the admin order/quote detail. **No** admin payment operations, mark-as-paid, resend,
   or refund/dispute UI.

## Explicitly NOT in Phase 5
Live Stripe production mode; saved cards; subscriptions; full refunds; disputes/chargebacks UI; real
email/SMS/WhatsApp sends or provider integration; accounting export; customs/tax; inspection/delivery
workflows; AI finance automation; real PII/RFC/KYC collection; admin payment operations.

## Why development-only
No live Stripe account, no live Supabase, no real `pnpm install`/CI run, no KMS decision. All verification is
local (pure logic, real-Postgres via PGlite, offline Stripe signature, CI boundary guards). Handling real
money or PII requires the live gates below to pass first.

## Consequences
New client deps (`@stripe/stripe-js`, `@stripe/react-stripe-js`), a public env var, a CI boundary guard, one
placeholder table (`notification_outbox`), and read-only UI. The `transitionPayment` seam gained a single
succeeded-only side effect (enqueue receipt). No payment/order state-change semantics changed.

## Verified (pure / real-Postgres / offline / CI guards)
Display-state mapper + flow helpers (poll/retry/settled/paid-view) · payment copy + status label (only
`succeeded` claims paid) · client Stripe boundary guard (incl. negative test) · `notification_outbox` RLS +
idempotency (PGlite) · read-only staff/customer summary type-safety + no-mutation grep. **Live Stripe + live
Supabase gates NOT run — release blockers.**
