/** The 9 app-scoped roles. 'agent' is a principal TYPE, not a role. */
export const ROLES = [
  'customer', 'concierge', 'inspector', 'driver', 'operations_manager',
  'finance_admin', 'compliance_admin', 'support_agent', 'super_admin',
] as const;
export type Role = (typeof ROLES)[number];

/** Staff = everyone except customer (admin/ops app is role-gated per surface). */
export const STAFF_ROLES: readonly Role[] = ROLES.filter((r) => r !== 'customer');

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}
