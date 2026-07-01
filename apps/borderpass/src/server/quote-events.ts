import 'server-only';
/**
 * Phase 3 PLACEHOLDER. Records the quote-event envelope shape; no external emission (no Inngest/bus).
 * Idempotency key = event.id (accept keyed by quote_id). Future consumers: Payments/Notifications/Analytics.
 */
export async function emitQuoteEvent(
  type: string,
  data: { quote_id: string; order_id: string; [k: string]: unknown },
): Promise<void> {
  void {
    id: `evt_${Date.now()}`,
    type,
    version: 1,
    source: 'borderpass',
    correlation_id: data.order_id,
    data,
    occurred_at: new Date().toISOString(),
  };
}
