import { z } from 'zod';

/**
 * Phase 6 — delivery-prep action inputs (ADR-0012). Address policy: ONLY an opaque
 * `delivery_address_ref` + non-PII scheduling windows. NO street/name/phone/postal/address-body fields.
 */
const DeliveryPrepId = z.string().regex(/^dlp_/, 'expected dlp_<id>');
const AddressRef = z.string().max(200); // opaque reference only — not address content

export const CreateDeliveryPrep = z.object({
  order_id: z.string().regex(/^ord_/, 'expected ord_<id>'),
  delivery_address_ref: AddressRef.optional(),
});
export const DeliveryPrepIdParam = z.object({ delivery_prep_id: DeliveryPrepId });
export const MarkDeliveryPrep = z.object({
  delivery_prep_id: DeliveryPrepId,
  customer_summary: z.string().max(500).optional(),
});
export const ScheduleDelivery = z.object({
  delivery_prep_id: DeliveryPrepId,
  scheduled_window_start: z.string().datetime(),
  scheduled_window_end: z.string().datetime(),
  customer_summary: z.string().max(500).optional(),
}).refine((v) => new Date(v.scheduled_window_end) > new Date(v.scheduled_window_start), {
  message: 'scheduled_window_end must be after scheduled_window_start', path: ['scheduled_window_end'],
});
export const HandOffDelivery = z.object({
  delivery_prep_id: DeliveryPrepId,
  reason: z.string().max(1000).optional(),
  customer_summary: z.string().max(500).optional(),
});
export type CreateDeliveryPrep = z.infer<typeof CreateDeliveryPrep>;
