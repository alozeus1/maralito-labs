# Phase 6 — Events & Notifications (placeholders)

> ADR-0012 · development-only · **no provider, no send, no message body, no PII.**

## Event placeholders
`emitInspectionEvent` (`src/server/inspection-events.ts`) and `emitDeliveryEvent`
(`src/server/delivery-events.ts`) are no-op envelope stubs (mirroring `payment-events`/`quote-events`). They
carry **references + status only** (`inspection_id`/`delivery_prep_id`, `order_id`, `status`) — never
`staff_notes`, address content, document content, or any PII. Emitted **only after a successful** transition
(the seam asserts legality first); creation events come from the create actions.

## Milestone notification placeholders
`queueInspectionUpdateNotification` / `queueDeliveryUpdateNotification` (`src/server/notifications.ts`) write a
placeholder `notification_outbox` row on approved milestones — inspection `passed`/`failed`; delivery
`ready`/`scheduled`/`handed_off` (gated by pure `shouldNotifyInspection`/`shouldNotifyDelivery`). They are
**privileged, self-contained, and idempotent**, and store only safe references + queue metadata.

### Row shape (references + queue metadata only)
`org_id`, `customer_id`, `order_id`, one of `inspection_id`/`delivery_prep_id`, `channel:
lifecycle_placeholder`, `template_key: inspection_update | delivery_update`, `status: queued`,
`idempotency_key`. **No message body, email, phone, address, card data, staff notes, or PII.**

### Idempotency
`idempotency_key = inspection_update:<inspection_id>:<status>` / `delivery_update:<delivery_prep_id>:<status>`
+ `onConflictDoNothing` → exactly one row per (record, status); duplicate transitions never duplicate rows.

## Schema note
`notification_outbox` gained nullable `inspection_id` / `delivery_prep_id`; `payment_id` is now nullable
(clean additive change). Existing payment-receipt enqueue (Phase 5) is unaffected. RLS unchanged (scoped by
`customer_id`/org; staff org-read; no customer writes).

## NOT done
No email/SMS/WhatsApp/in-app send, no provider adapters, no template rendering, no AI automation — all deferred.
