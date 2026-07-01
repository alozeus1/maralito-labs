import { z } from 'zod';

export const Money = z.object({
  amount_minor: z.number().int().nonnegative(),
  currency: z.enum(['USD', 'MXN']),
});
export type Money = z.infer<typeof Money>;

export const Locale = z.enum(['en', 'es']);
export const Phone = z.string().regex(/^\+[1-9]\d{6,14}$/, 'E.164 phone required');
export const Email = z.string().email();

export const prefixedId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_`), `expected ${prefix}_<id>`);
export const OrderId = prefixedId('ord');
export const QuoteId = prefixedId('qte');
