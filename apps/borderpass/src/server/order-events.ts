import 'server-only';
/**
 * Phase 2 PLACEHOLDER. Records the domain-event envelope shape; no external emission yet.
 * The durable event bus (Inngest/outbox per contracts/03) is wired in a later phase.
 */
export async function emitOrderEvent(type: string, data: Record<string, unknown>): Promise<void> {
  void { id: `evt_${Date.now()}`, type, version: 1, source: 'borderpass', data, occurred_at: new Date().toISOString() };
}
