import { z } from 'zod';
export const StaffProfileCreate = z.object({
  display_name: z.string().trim().min(1).max(120),
  status: z.enum(['active', 'inactive', 'on_leave']).default('active'),
});
export const StaffProfileUpdate = StaffProfileCreate.partial();
export type StaffProfileCreate = z.infer<typeof StaffProfileCreate>;
