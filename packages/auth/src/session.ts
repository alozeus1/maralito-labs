import type { Role } from './rbac/roles';

/** The app's normalized session. orgId/roles/permissions resolved from BorderPass DB. */
export interface AppSession {
  sub: string; // Supabase auth.users.id
  orgId: string;
  roles: Role[];
  permissions: string[];
}

/** Pure builder — composed by the app from (Supabase user) + (DB identity/roles). */
export function buildSession(input: {
  authUserId: string;
  orgId: string;
  roles: Role[];
  permissions: string[];
}): AppSession {
  return {
    sub: input.authUserId,
    orgId: input.orgId,
    roles: input.roles,
    permissions: input.permissions,
  };
}
