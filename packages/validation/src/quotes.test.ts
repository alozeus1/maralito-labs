import { describe, it, expect } from 'vitest';
import { QuoteLineItemInput, CreateQuoteDraft, RejectQuote, DeclineQuote, AcceptQuote } from './index';
describe('quote schemas', () => {
  it('line item negative restricted to discount/adjustment', () => {
    expect(() => QuoteLineItemInput.parse({ kind: 'product_cost', description: 'x', quantity: 1, unit_amount_minor: -1, total_amount_minor: -1, currency: 'USD' })).toThrow();
    expect(QuoteLineItemInput.parse({ kind: 'discount', description: 'd', quantity: 1, unit_amount_minor: -1, total_amount_minor: -100, currency: 'USD' }).kind).toBe('discount');
  });
  it('reject requires reason', () => {
    expect(() => RejectQuote.parse({ quote_id: 'qte_1', decision: 'reject' })).toThrow();
    expect(RejectQuote.parse({ quote_id: 'qte_1', decision: 'reject', reason: 'too high' }).reason).toBe('too high');
  });
  it('CreateQuoteDraft needs ord_ id; DeclineQuote reason length-limited; AcceptQuote needs qte_', () => {
    expect(() => CreateQuoteDraft.parse({ order_id: 'x' })).toThrow();
    expect(() => DeclineQuote.parse({ quote_id: 'qte_1', reason: 'x'.repeat(501) })).toThrow();
    expect(() => AcceptQuote.parse({ quote_id: 'x' })).toThrow();
  });
});
