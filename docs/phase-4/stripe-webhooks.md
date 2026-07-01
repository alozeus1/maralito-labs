# Phase 4 — Stripe Webhooks

> `app/api/stripe/webhook/route.ts` · Node runtime · fail-closed verification · idempotent. ADR-0010.

## Request handling
1. **Config gate:** if Stripe isn't configured → `503` (no processing).
2. **Raw body + signature:** read `await req.text()` (raw) + `stripe-signature` header. Missing header → `400`.
3. **Verify (fail closed):** `verifyStripeWebhook` → `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`. Any invalid/tampered signature throws → `400`, audit `payment.webhook_failed` (`invalid_signature`). No further processing.
4. **Idempotency ledger:** look up `stripe_webhook_events` by `stripe_event_id`. Already `completed`/`ignored`/`failed` → `200 {idempotent:true}`. New → insert `received` (`onConflictDoNothing` on the unique `stripe_event_id`). Audit + emit `payment.webhook_received`.
5. **Route:** map event type → target payment status; unsupported → mark `ignored`, `200`.
6. **Transition:** find payment by `stripe_payment_intent_id`. If absent → mark `failed` (`no_matching_payment`), `200`. If the transition is legal → `transitionPayment(...)` (system actor) — `succeeded` cascades the order to `paid`. Illegal/out-of-order → idempotent no-op. Mark `completed`, `200`.
7. **Unexpected error:** mark `failed` (`processing_error`), `500` so Stripe retries.

## Supported events → payment status
| Stripe event | Payment status |
|--------------|----------------|
| `payment_intent.succeeded` | `succeeded` (→ order `paid`) |
| `payment_intent.payment_failed` | `failed` |
| `payment_intent.processing` | `processing` |
| `payment_intent.canceled` | `canceled` |
| `payment_intent.requires_action` | `requires_action` |
| *(anything else)* | recorded `ignored` |

## Idempotency (two layers)
- **Ledger:** unique `stripe_event_id` + `onConflictDoNothing`; re-delivered events return success without reprocessing.
- **Business:** an out-of-order/duplicate event whose state transition is illegal is a safe no-op (e.g. a second `succeeded` after already succeeded/paid).

## Status codes
`400` invalid/missing signature · `503` not configured · `200` handled / ignored / idempotent / unmatched · `500` unexpected internal error (Stripe retries).

## Security
Node runtime (crypto). Privileged DB access only (no tenant session). Never logs the raw payload, secret, signature, or card data — `payload_summary` stores only `{payment_intent_id, stripe_status}`. `stripe_webhook_events` is privileged-only (no tenant role can read it).

## Known edge (documented)
A narrow select-then-insert race on truly concurrent duplicate deliveries is mitigated by the unique constraint + `onConflictDoNothing` and by business-level legality gating. A row stuck at `received` (crash mid-process) is intentionally reprocessed on redelivery.
