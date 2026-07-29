/**
 * Phase 8C.2 — pure decision logic for the notification delivery-status callback.
 *
 * An automation caller (n8n, or a provider webhook relayed through it) reports a delivery outcome for
 * a single `notification_outbox` row. This module decides — with NO I/O — whether that report should
 * be applied, ignored as a duplicate, or rejected as a conflicting regression. Keeping it pure makes
 * the idempotency + non-regression guarantees unit-testable without a database.
 *
 * Non-regression: once a row reaches a TERMINAL delivery state (`delivered`, `bounced`, `complained`,
 * `failed`) it must not change to a different state. `delivery_delayed` is transient and may still
 * advance. Re-applying the same status is an idempotent no-op.
 */
export const CALLBACK_STATUSES = [
  'delivered',
  'delivery_delayed',
  'bounced',
  'complained',
  'failed',
] as const;
export type CallbackStatus = (typeof CALLBACK_STATUSES)[number];

const TERMINAL = new Set<string>(['delivered', 'bounced', 'complained', 'failed']);

export type StatusDecision =
  | { kind: 'apply'; status: CallbackStatus } // legal advance → write it
  | { kind: 'noop' } // already at the requested status → idempotent no-op
  | { kind: 'conflict'; from: string }; // terminal → different state → reject, do not regress

/** Decide how to reconcile a reported delivery status against the row's current status. Pure. */
export function decideOutboxStatus(current: string, requested: CallbackStatus): StatusDecision {
  if (current === requested) return { kind: 'noop' };
  if (TERMINAL.has(current)) return { kind: 'conflict', from: current };
  return { kind: 'apply', status: requested };
}

/** Runtime guard for the `status` field of an untrusted callback body. */
export function isCallbackStatus(value: unknown): value is CallbackStatus {
  return typeof value === 'string' && (CALLBACK_STATUSES as readonly string[]).includes(value);
}
