import 'server-only';

/**
 * Phase 4 — payment event placeholder seam (ADR-0010). Records the payment-event envelope shape only;
 * there is NO external emission (no Inngest/bus), NO notifications, NO AI workflows, and NO accounting
 * integration. This is a clean seam for Phase 5+ consumers (Notifications receipt, Analytics, Accounting
 * export) to attach to. Idempotency key for future consumers = envelope.id. Never logs card data/secrets.
 */
export type PaymentEventType =
  | 'payment.intent_created'
  | 'payment.requires_payment'
  | 'payment.processing'
  | 'payment.requires_action'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.canceled'
  | 'payment.refunded_placeholder'
  | 'payment.webhook_received'
  | 'payment.webhook_ignored'
  | 'payment.webhook_failed';

export interface PaymentEventEnvelope {
  id: string;
  type: string;
  version: number;
  source: 'borderpass';
  correlation_id?: string; // order_id when known (ties payment events to the order lifecycle)
  data: Record<string, unknown>; // ids + minimal non-sensitive summary only
  occurred_at: string;
}

/**
 * Placeholder emitter. Builds the envelope and drops it (no transport). Callers pass ids + a minimal,
 * non-sensitive summary (never client_secret, card data, secrets, or raw payloads).
 */
export async function emitPaymentEvent(type: string, data: Record<string, unknown> = {}): Promise<void> {
  const envelope: PaymentEventEnvelope = {
    id: `evt_${Date.now()}`,
    type,
    version: 1,
    source: 'borderpass',
    data,
    occurred_at: new Date().toISOString(),
    // Only set correlation_id when an order_id is present (exactOptionalPropertyTypes-safe).
    ...(typeof data.order_id === 'string' ? { correlation_id: data.order_id } : {}),
  };
  void envelope; // Phase 4: intentionally not transported. Phase 5+ wires the real bus/consumers.
}
