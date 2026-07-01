import { AuthError } from '../errors';
import type { AppSession } from '../session';
import { type Role, isStaffRole } from './roles';
import type { Permission } from './permissions';

export * from './roles';
export * from './permissions';

const isSuperAdmin = (s: AppSession) => s.roles.includes('super_admin');

export function hasRole(session: AppSession, role: Role): boolean {
  return session.roles.includes(role);
}
export function hasAnyRole(session: AppSession, roles: readonly Role[]): boolean {
  return roles.some((r) => session.roles.includes(r));
}
/** super_admin implicitly holds all permissions (separation-of-duties enforced at action sites). */
export function hasPermission(session: AppSession, permission: Permission): boolean {
  return isSuperAdmin(session) || session.permissions.includes(permission);
}
export function isStaff(session: AppSession): boolean {
  return session.roles.some(isStaffRole);
}

// ---- guards (throw AuthError; callers map to safe redirects / error responses) ----
export function requireAuth(session: AppSession | null | undefined): AppSession {
  if (!session) throw new AuthError('unauthenticated');
  return session;
}
export function requireRole(session: AppSession | null | undefined, role: Role): AppSession {
  const s = requireAuth(session);
  if (!hasRole(s, role) && !isSuperAdmin(s)) throw new AuthError('forbidden');
  return s;
}
export function requirePermission(
  session: AppSession | null | undefined,
  permission: Permission,
): AppSession {
  const s = requireAuth(session);
  if (!hasPermission(s, permission)) throw new AuthError('forbidden');
  return s;
}
export function requireAdminAccess(session: AppSession | null | undefined): AppSession {
  const s = requireAuth(session);
  if (!isStaff(s)) throw new AuthError('not_found'); // never reveal admin surface to customers
  return s;
}
export function requireCustomerAccess(session: AppSession | null | undefined): AppSession {
  const s = requireAuth(session);
  if (!hasRole(s, 'customer') && !isSuperAdmin(s)) throw new AuthError('forbidden');
  return s;
}
