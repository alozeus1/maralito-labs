# Phase 5 — Receipt / Notification Foundation (placeholder)

> ADR-0011 · development-only · **no provider, no send, no PII**.

## What this is
A minimal `notification_outbox` queue ledger. When a payment reaches `succeeded` through the trusted
server/webhook path (`transitionPayment` → `queuePaymentReceipt`), exactly **one** placeholder receipt
row is enqueued (`status = queued`). That is the entire scope.

## What it stores (references + queue metadata only)
`org_id`, `customer_id`, `order_id`, `payment_id`, `channel` (`receipt_placeholder`), `template_key`
(`payment_receipt`), `status` (`queued`), `idempotency_key` (`receipt:<payment_id>`), timestamps.

## What it MUST NOT store / do (Phase 5)
- ❌ No message body, email address, phone number, postal address, card data, RFC/KYC/PII, or raw Stripe payload.
- ❌ No email/SMS/WhatsApp/in-app **send**. No provider integration. No template rendering.
- ❌ No customer-facing receipt UI, no admin notification UI (later).

## Guarantees
- **Webhook-driven only:** enqueued solely inside `transitionPayment`'s `succeeded` branch — never from the client, never from the advisory `stripe.confirmPayment` result.
- **Only succeeded:** `queuePaymentReceipt` re-reads the payment and enqueues only when `status === 'succeeded'`; failed/canceled/requires_action/processing never enqueue.
- **Idempotent:** unique `idempotency_key` (`receipt:<payment_id>`) + `onConflictDoNothing` → duplicate webhook delivery never creates a duplicate receipt.
- **RLS:** customers read only their own receipt metadata; staff/ops read org-scoped; customers cannot write (privileged seam only).

## Deferred (future phase)
Real provider adapters (Resend / Twilio / WhatsApp), template rendering, EN/ES copy, channel select +
fallback, quiet hours, send status (`sent`/`failed`), retries, customer/admin notification UI. See the
`@maralito/notifications` package TODO.
