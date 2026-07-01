import { z } from 'zod';
import { Money } from './primitives';

export const ServiceType = z.enum([
  'buy_for_me',
  'package_reception',
  'local_pickup',
  'business_delivery',
]);
export const Purpose = z.enum(['personal', 'gift', 'business', 'resale']);

export const OrderItemInput = z.object({
  description: z.string().trim().min(1).max(500),
  product_url: z.string().url().optional(),
  quantity: z.number().int().min(1),
  variant: z.string().max(120).optional(),
  unit_value: Money,
  category: z.string().max(120).optional(),
});

export const OrderCreate = z.object({
  service_type: ServiceType,
  items: z.array(OrderItemInput).optional(),
  purpose: Purpose.optional(),
  declared_value: Money.optional(),
  delivery_address_id: z.string().optional(),
  hub_address_id: z.string().optional(),
});

export const OrderDraftPatch = OrderCreate.partial();
export const OrderSubmit = z.object({ order_id: z.string().regex(/^ord_/) });
export const OrderListQuery = z.object({
  status: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type OrderCreate = z.infer<typeof OrderCreate>;
export type OrderItemInput = z.infer<typeof OrderItemInput>;
