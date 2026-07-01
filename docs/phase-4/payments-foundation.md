# Phase 4 — Payments Foundation (development-only)

> Stripe PaymentIntent foundation for an **accepted** quote. No checkout UI, no live mode, no real money. ADR-0010.

## What this delivers
A customer can initiate a Stripe **PaymentIntent** for an accepted quote whose order is `awaiting_payment`; a verified Stripe webhook then advances the payment through a controlled state machine and, on success, moves the order to `paid` — strictly through the audited order seam.

## Data model (`packages/db/src/schema/payments.ts`)
- **`payments`** — internal payment record: `org/customer/order/quote` FKs, `provider` (stripe), `status`, `amount_minor` (integer = accepted quote total), `currency`, Stripe references (`stripe_payment_intent_id`, `stripe_customer_id`, `stripe_checkout_session_id` reserved), `idempotency_key`. Unique `(provider, idempotency_key)` and partial-unique `stripe_payment_intent_id`.
- **`payment_events`** — normalized event log that **doubles as status history**: `from_status`/`to_status`, `provider_event_id`, minimal non-sensitive `payload_summary`.
- **`stripe_webhook_events`** — idempotency ledger, unique `stripe_event_id`, `processing_status` (`received`/`completed`/`ignored`/`failed`).
- **`refunds`** — placeholder (schema only; `status` default `placeholder`).
- Money is integer minor units everywhere; **no card data columns**.

## Flow
1. **Initiate** (`app/actions/payments.ts` → `initiateQuotePayment`): `withTenant` read enforces ownership (RLS) + preconditions (`canInitiatePayment`: quote `accepted`, order `awaiting_payment`, positive total). Idempotently get-or-create the payment row (privileged) + PaymentIntent keyed by `pi_<quote_id>`. Return only `{ payment_id, status, amount_minor, currency, client_secret }`.
2. **Confirm** (client SDK, out of scope) → Stripe sends webhook events.
3. **Webhook** (`app/api/stripe/webhook/route.ts`): verify signature (fail closed) → idempotency ledger → normalize the 5 `payment_intent.*` events → `transitionPayment`.
4. **Cascade**: on `succeeded`, `transitionPayment` moves the order `awaiting_payment → paid` via `transitionOrderPrivileged` — only when the order is awaiting_payment.

## State machine (`src/domain/payments/state-machine.ts`)
`requires_payment → processing → {succeeded | failed | requires_action | canceled}`; `requires_action → {processing | failed}`; `failed → requires_payment`; `succeeded → refunded_placeholder` (reserved). Terminals: `canceled`, `refunded_placeholder`. Status changes only via `transitionPayment`.

## Invariants honored
All payment writes via the privileged seam; no raw DB client in `apps/**`; order status only via `transitionOrder`; payment `succeeded` is the only path to order `paid` (and only from `awaiting_payment`); failed/canceled/requires_action never mark paid; Stripe references only; no secrets/card data/PII logged; integer minor units; single currency per quote; **development-only**.

## Not built (deferred)
Checkout/Elements UI, saved cards, subscriptions, real refunds, disputes, notifications, AI finance automation, accounting/export, customs/tax, inspection/delivery, durable workflow, real event bus.
