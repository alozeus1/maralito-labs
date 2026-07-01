import 'server-only';
/**
 * Phase 6 PLACEHOLDER (ADR-0012). Records the delivery-event envelope shape; NO external emission, NO
 * notifications, NO provider/courier/maps, NO AI. Payload carries references + status ONLY — never
 * staff_notes, street/recipient/phone/postal/address content, document content, or any PII.
 */
export async function emitDeliveryEvent(
  type: string,
  data: { delivery_prep_id: string; order_id: string; status?: string; [k: string]: unknown },
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
