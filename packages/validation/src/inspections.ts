import { z } from 'zod';

/** Phase 6 — inspection action inputs (ADR-0012). No PII/document content. */
const InspectionId = z.string().regex(/^insp_/, 'expected insp_<id>');

export const CreateInspection = z.object({
  order_id: z.string().regex(/^ord_/, 'expected ord_<id>'),
});
export const InspectionIdParam = z.object({ inspection_id: InspectionId });
export const PassInspection = z.object({
  inspection_id: InspectionId,
  customer_summary: z.string().max(500).optional(),
});
export const FailInspection = z.object({
  inspection_id: InspectionId,
  reason: z.string().max(1000).optional(),
  customer_summary: z.string().max(500).optional(),
});
export type CreateInspection = z.infer<typeof CreateInspection>;
