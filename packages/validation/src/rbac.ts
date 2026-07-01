import { z } from 'zod';

export const ROLE_KEYS = [
  'customer', 'concierge', 'inspector', 'driver', 'operations_manager',
  'finance_admin', 'compliance_admin', 'support_agent', 'super_admin',
] as const;

export const RoleAssignment = z.object({
  auth_user_id: z.string().uuid(),
  org_id: z.string().regex(/^org_/, 'expected org_<id>'),
  role_key: z.enum(ROLE_KEYS),
});
export type RoleAssignment = z.infer<typeof RoleAssignment>;
