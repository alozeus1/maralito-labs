import 'server-only';
/**
 * Phase 6 PLACEHOLDER (ADR-0012). Records the inspection-event envelope shape; NO external emission
 * (no Inngest/bus), NO notifications, NO AI, NO provider. Payload carries references + status ONLY —
 * never staff_notes, address content, document content, or any PII. Future consumers attach in a later phase.
 */
export async function emitInspectionEvent(
  type: string,
  data: { inspection_id: string; order_id: string; status?: string; [k: string]: unknown },
): Promise<void> {
  void {
    id: `evt_${Date.now()}`, type, version: 1, source: 'borderpass',
    correlation_id: data.order_id, data, occurred_at: new Date().toISOString(),
  };
}
