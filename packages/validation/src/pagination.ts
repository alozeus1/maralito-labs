import { z } from 'zod';
/** Cursor pagination (contracts/02): ?cursor=&limit= (max 100). */
export const PaginationParams = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationParams = z.infer<typeof PaginationParams>;
