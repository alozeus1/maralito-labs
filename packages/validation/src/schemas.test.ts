import { describe, it, expect } from 'vitest';
import { ProfileCreate, RoleAssignment, PaginationParams } from './index';

describe('phase 1 schemas', () => {
  it('ProfileCreate defaults language to es; trims name', () => {
    const p = ProfileCreate.parse({ display_name: '  Maria  ' });
    expect(p.display_name).toBe('Maria');
    expect(p.language).toBe('es');
  });
  it('RoleAssignment validates uuid + org_ + role enum', () => {
    expect(() =>
      RoleAssignment.parse({ auth_user_id: 'not-uuid', org_id: 'org_1', role_key: 'customer' }),
    ).toThrow();
    const ok = RoleAssignment.parse({
      auth_user_id: '00000000-0000-4000-8000-000000000000',
      org_id: 'org_1',
      role_key: 'compliance_admin',
    });
    expect(ok.role_key).toBe('compliance_admin');
    expect(() =>
      RoleAssignment.parse({
        auth_user_id: '00000000-0000-4000-8000-000000000000',
        org_id: 'org_1',
        role_key: 'wizard',
      }),
    ).toThrow();
  });
  it('PaginationParams clamps + defaults', () => {
    expect(PaginationParams.parse({}).limit).toBe(20);
    expect(() => PaginationParams.parse({ limit: 500 })).toThrow();
  });
});
