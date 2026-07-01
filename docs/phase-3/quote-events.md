# Phase 3 — Quote Event Placeholders

`emitQuoteEvent(type, {quote_id, order_id, …})` — **placeholder** (no Inngest/bus). Envelope:
`{ id: evt_…, type, version:1, source: 'borderpass', correlation_id: order_id, data, occurred_at }`.

| Event | Producer | Payload | Idempotency key | Future consumers | Audit |
|-------|----------|---------|-----------------|------------------|:----:|
| quote.created | BorderPass | {quote_id, order_id} | event.id | Analytics | yes |
| quote.updated | BorderPass | {quote_id, order_id} | event.id | Analytics | yes |
| quote.submitted_for_approval | BorderPass | {quote_id, order_id} | event.id | Finance queue | yes |
| quote.approved | BorderPass | {quote_id, order_id} | event.id | Notifications | yes |
| quote.rejected | BorderPass | {quote_id, order_id, decision} | event.id | Ops | yes |
| quote.sent | BorderPass | {quote_id, order_id} | event.id | Notifications | yes |
| quote.accepted | BorderPass | {quote_id, order_id} | quote_id | **Payments (Phase 4)**, Notifications | yes |
| quote.declined | BorderPass | {quote_id, order_id} | quote_id | Ops/Concierge | yes |
| quote.expired | BorderPass | {quote_id, order_id} | event.id | Notifications | yes |
| quote.cancelled | BorderPass | {quote_id, order_id} | event.id | Ops | yes |
| quote.superseded | BorderPass | {quote_id, order_id} | event.id | Analytics | yes |

No automation wiring yet; the durable bus + consumers arrive in later phases.
