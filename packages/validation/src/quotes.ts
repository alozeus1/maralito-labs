import { z } from 'zod';

export const Currency = z.enum(['USD', 'MXN']);
export const MoneyMinor = z.number().int();
export const QuoteLineKind = z.enum([
  'product_cost',
  'service_fee',
  'delivery_fee',
  'estimated_import_tax',
  'inspection_fee',
  'discount',
  'adjustment',
  'other',
]);

export const QuoteLineItemInput = z
  .object({
    kind: QuoteLineKind,
    description: z.string().trim().min(1).max(500),
    quantity: z.number().int().min(1).default(1),
    unit_amount_minor: MoneyMinor,
    total_amount_minor: MoneyMinor,
    currency: Currency,
    taxable: z.boolean().optional(),
    customer_visible: z.boolean().optional(),
    internal_only: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((l) => l.total_amount_minor >= 0 || l.kind === 'discount' || l.kind === 'adjustment', {
    message: 'negative amounts only allowed for discount/adjustment',
    path: ['total_amount_minor'],
  });

const QuoteId = z.string().regex(/^qte_/, 'expected qte_<id>');

export const CreateQuoteDraft = z.object({
  order_id: z.string().regex(/^ord_/),
  currency: Currency.default('USD'),
  customer_message: z.string().max(2000).optional(),
  internal_notes: z.string().max(4000).optional(),
  items: z.array(QuoteLineItemInput).optional(),
});
export const UpdateQuoteDraft = z.object({
  quote_id: QuoteId,
  customer_message: z.string().max(2000).optional(),
  internal_notes: z.string().max(4000).optional(),
  requires_approval: z.boolean().optional(),
});
export const SubmitForApproval = z.object({ quote_id: QuoteId });
export const ApproveQuote = z.object({
  quote_id: QuoteId,
  reason: z.string().max(1000).optional(),
});
export const RejectQuote = z.object({
  quote_id: QuoteId,
  decision: z.enum(['reject', 'request_changes']),
  reason: z.string().trim().min(1).max(1000), // reason REQUIRED on reject/request_changes
});
export const SendQuote = z.object({
  quote_id: QuoteId,
  expires_in_hours: z.number().int().min(1).max(720).optional(),
});
export const AcceptQuote = z.object({ quote_id: QuoteId });
export const DeclineQuote = z.object({ quote_id: QuoteId, reason: z.string().max(500).optional() });
export const QuoteListFilters = z.object({
  status: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const QuoteIdParam = z.object({ quote_id: QuoteId });
export type QuoteLineItemInput = z.infer<typeof QuoteLineItemInput>;
export type CreateQuoteDraft = z.infer<typeof CreateQuoteDraft>;
