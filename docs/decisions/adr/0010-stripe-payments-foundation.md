# ADR 0010 — Stripe Payments + Payment State Machine Foundation (dev-only)

- **Status:** Accepted (development-only; live gates block release) · **Date:** 2026-06-30 · **Phase:** 4
- **Numbering:** 0010 = Stripe payments foundation. Next ADR = 0011.

## Context
Phase 3 delivered Quotes + Finance Approval; an accepted quote moves its order to `awaiting_payment`. Phase 4 adds the payment layer that collects money for an accepted quote and advances the order to `paid` — **only** on trusted confirmation. This is built development-only, with no live Stripe/Supabase environment yet, so the live gates remain release blockers.

## Decisions

1. **Stripe as the provider; PaymentIntent (not Checkout Session).** PaymentIntent keeps the server in control of amount/metadata/idempotency and matches our server-action architecture. Checkout-session fields (`stripe_checkout_session_id`, success/cancel URLs) are reserved in schema/config for forward-compat but unused in Phase 4. No checkout UI is built.

2. **Server-only Stripe boundary.** The secret key and webhook secret are read from the environment at call time and never exposed to the client bundle. The client factory (`getStripeClient`) refuses to run in a browser and fails closed when secrets are missing (`loadStripeConfig`). The `@maralito/payments` package stays framework-agnostic (matching `@maralito/db`); server-only enforcement is the runtime `window` guard plus the fact that the only importers are a server action and the webhook route. Only safe client-facing fields are returned (`payment_id`, `status`, `amount_minor`, `currency`, `client_secret`).

3. **Single payment-mutation seam (`transitionPayment`).** Mirrors `transitionOrder`/`transitionQuote`. It asserts a legal transition (7-state machine), updates status, writes a `payment_events` row (which **doubles as status history** + provider-event ledger), audits, and emits a placeholder event. All payment writes run via `withPrivilegedDbAccess` (audited, RLS-bypassing base role) — there is **no tenant write path** for payments.

4. **Order `paid` cascade only via `transitionOrder`, only on `succeeded`.** The pure rule `orderPaidCascadeTarget(paymentTo, orderStatus)` returns `paid` **only** when a payment moves to `succeeded` while the order is `awaiting_payment`; the seam then calls `transitionOrderPrivileged(awaiting_payment → paid)`. Every other payment status returns `null` (no-op). This is the single, exhaustively-tested guarantee that **failure / canceled / requires_action never mark an order paid**, and that a re-delivered success on an already-paid order is an idempotent no-op.

5. **Webhook verification fails closed.** The route reads the raw body and verifies the Stripe signature with `STRIPE_WEBHOOK_SECRET`; any invalid/missing signature → `400`, no processing. Runs on the Node runtime (Stripe needs crypto).

6. **Webhook idempotency via a ledger.** `stripe_webhook_events` has a unique `stripe_event_id`; a re-delivered event whose row is already `completed`/`ignored`/`failed` returns `200` without reprocessing. Business-level idempotency is also enforced: an out-of-order/duplicate event whose transition is illegal is a safe no-op. Supported events: `payment_intent.{succeeded,payment_failed,processing,canceled,requires_action}`; everything else is recorded `ignored`.

7. **Idempotent initiation keyed by quote.** `payments.idempotency_key = pi_<quote_id>` (unique per provider); the PaymentIntent is created with the same Stripe `idempotencyKey`. Re-initiation reuses the existing payment + intent. The **accepted quote total is the source of truth** for the amount (integer minor units, single currency).

8. **No card data stored; references only.** We persist only Stripe references (`stripe_payment_intent_id`, `stripe_customer_id`) and a minimal non-sensitive `payload_summary`. Card numbers, CVCs, raw payment-method data, secrets, and raw webhook payloads are never stored or logged.

9. **RLS for payments.** Customers read only their own payments; staff/finance read org-scoped; `payment_events` is staff-only; `stripe_webhook_events` is privileged-only (no tenant role can read it); `refunds` (placeholder) follows the payment owner. No customer write policy exists → customers cannot mutate payments.

## Why payment failure never marks an order paid
Order `paid` is reachable exclusively through `orderPaidCascadeTarget`, which only returns `paid` for `succeeded` + `awaiting_payment`. There is no other code path to `paid`, the function is pure and unit-tested across all payment statuses, and `transitionOrder` independently asserts the order edge is legal. Three layers must all agree, so a failed/canceled/requires_action/processing event cannot mark paid.

## Why Phase 4 is development-only
No live Stripe account, no live Supabase, no CI run, no real `pnpm install`/lockfile commit, and no KMS decision have happened. All verification is local (pure logic, real-Postgres via PGlite, offline Stripe signature). Handling real money or PII requires the live gates below to pass first.

## Deferred to later phases
Hosted/Elements checkout UI and payment-confirmation UX, saved cards, subscriptions, **real refunds** (only a placeholder table exists) and disputes/chargebacks, notifications (receipts), AI finance automation, accounting/export, customs/tax remittance, inspection + delivery workflows, durable Inngest workflow wrapping the payment/order seams, and the real event bus + consumers.

## Refund / dispute placeholder decision
A `refunds` table is created (schema only, status `placeholder`) and `succeeded → refunded_placeholder` is a legal-but-unused transition, so future refund work extends cleanly without a migration reshuffle. No refund/dispute logic is implemented.

## Verified (real Postgres / pure / offline Stripe)
Payment state machine (legal/illegal, illegal throws) · cascade rule (only `succeeded`+`awaiting_payment` ⇒ paid; failure/canceled/requires_action ⇒ no-op) · initiation preconditions · webhook signature verify pass/forge/tamper (offline `generateTestHeaderString`) · webhook idempotency ledger (PGlite) · payment RLS isolation (PGlite, 13 assertions, incl. customer-can't-update + webhook-ledger-private). **Live Stripe + live Supabase gates NOT run — release blockers.**
