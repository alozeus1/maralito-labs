export const QUOTE_LINE_KINDS = [
  'product_cost',
  'service_fee',
  'delivery_fee',
  'estimated_import_tax',
  'inspection_fee',
  'discount',
  'adjustment',
  'other',
] as const;
export type QuoteLineKind = (typeof QUOTE_LINE_KINDS)[number];
const NEGATIVE_OK: readonly QuoteLineKind[] = ['discount', 'adjustment'];

export interface QuoteLine {
  kind: QuoteLineKind;
  total_amount_minor: number;
  currency: 'USD' | 'MXN';
  customer_visible: boolean;
  internal_only: boolean;
}
export interface QuoteTotals {
  currency: 'USD' | 'MXN';
  subtotal_minor: number;
  service_fee_minor: number;
  delivery_fee_minor: number;
  estimated_tax_minor: number;
  inspection_fee_minor: number;
  discount_minor: number;
  total_minor: number;
}

/** Deterministic, integer-minor-unit totals. Single currency. total = Σ customer-visible chargeable lines. */
export function calculateQuoteTotals(lines: QuoteLine[]): QuoteTotals {
  const zero: QuoteTotals = {
    currency: 'USD',
    subtotal_minor: 0,
    service_fee_minor: 0,
    delivery_fee_minor: 0,
    estimated_tax_minor: 0,
    inspection_fee_minor: 0,
    discount_minor: 0,
    total_minor: 0,
  };
  if (lines.length === 0) return zero;
  const currency = lines[0]!.currency;
  if (lines.some((l) => l.currency !== currency))
    throw new Error('quote currency must be consistent across line items');
  for (const l of lines) {
    if (!Number.isInteger(l.total_amount_minor))
      throw new Error('money must be integer minor units');
    if (l.total_amount_minor < 0 && !NEGATIVE_OK.includes(l.kind))
      throw new Error(`negative amount not allowed for line kind ${l.kind}`);
  }
  const sum = (k: QuoteLineKind) =>
    lines.filter((l) => l.kind === k).reduce((s, l) => s + l.total_amount_minor, 0);
  return {
    currency,
    subtotal_minor: sum('product_cost'),
    service_fee_minor: sum('service_fee'),
    delivery_fee_minor: sum('delivery_fee'),
    estimated_tax_minor: sum('estimated_import_tax'),
    inspection_fee_minor: sum('inspection_fee'),
    discount_minor: sum('discount'),
    total_minor: lines
      .filter((l) => l.customer_visible && !l.internal_only)
      .reduce((s, l) => s + l.total_amount_minor, 0),
  };
}
