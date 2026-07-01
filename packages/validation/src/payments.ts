import { z } from 'zod';

/** Phase 4 — payment initiation input (ADR-0010). Customer initiates payment for an accepted quote. */
export const InitiateQuotePayment = z.object({
  quote_id: z.string().regex(/^qte_/, 'expected qte_<id>'),
});
export type InitiateQuotePayment = z.infer<typeof InitiateQuotePayment>;
