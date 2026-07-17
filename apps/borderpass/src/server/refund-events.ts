import 'server-only';

/**
 * Phase 8D — refund event placeholder seam (ADR-0015). Records the refund-event envelope shape only;
 * there is NO external emission (no Inngest/bus), NO notifications, NO accounting integration. Clean
 * seam for later consumers (notifications receipt, analytics, accounting export) to attach to.
 * Never logs card data, secrets, or raw Stripe payloads.
 */
export type RefundEventType =
  | 'refund.requested'
  | 'refund.processing'
  | 'refund.succeeded'
  | 'refund.failed'
  | 'refund.canceled'
  | 'refund.webhook_received'
  | 'refund.webhook_ignored'
  | 'refund.webhook_failed'
  | 'dispute.opened'
  | 'dispute.updated'
  | 'dispute.closed';

export interface RefundEventEnvelope {
  id: string;
  type: string;
  version: number;
  source: 'borderpass';
  correlation_id?: string; // order_id when known (ties refund events to the order lifecycle)
  data: Record<string, unknown>; // ids + minimal non-sensitive summary only
  occurred_at: string;
}

/**
 * Placeholder emitter. Builds the envelope and drops it (no transport). Callers pass ids + a minimal,
 * non-sensitive summary (never client_secret, card data, secrets, or raw payloads).
 */
export async function emitRefundEvent(
  type: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const envelope: RefundEventEnvelope = {
    id: `evt_${Date.now()}`,
    type,
    version: 1,
    source: 'borderpass',
    data,
    occurred_at: new Date().toISOString(),
    ...(typeof data.order_id === 'string' ? { correlation_id: data.order_id } : {}),
  };
  void envelope; // Phase 8D: intentionally not transported. Later increments wire the real bus/consumers.
}
