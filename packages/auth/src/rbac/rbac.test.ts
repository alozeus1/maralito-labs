import { describe, it, expect } from 'vitest';
import { buildSession } from '../session';
import { AuthError } from '../errors';
import {
  hasRole,
  hasPermission,
  isStaff,
  requireAuth,
  requireRole,
  requirePermission,
  requireAdminAccess,
  requireCustomerAccess,
} from './index';

const customer = buildSession({
  authUserId: 'u1',
  orgId: 'org_1',
  roles: ['customer'],
  permissions: ['profile.read'],
});
const compliance = buildSession({
  authUserId: 'u2',
  orgId: 'org_1',
  roles: ['compliance_admin'],
  permissions: ['order.approve'],
});
const superA = buildSession({
  authUserId: 'u3',
  orgId: 'org_1',
  roles: ['super_admin'],
  permissions: [],
});

describe('rbac helpers', () => {
  it('hasRole / isStaff', () => {
    expect(hasRole(customer, 'customer')).toBe(true);
    expect(isStaff(customer)).toBe(false);
    expect(isStaff(compliance)).toBe(true);
  });
  it('hasPermission + super_admin implicit-all', () => {
    expect(hasPermission(customer, 'profile.read')).toBe(true);
    expect(hasPermission(customer, 'order.approve')).toBe(false);
    expect(hasPermission(superA, 'anything.at.all')).toBe(true);
  });
  it('requireAuth throws on null', () => {
    expect(() => requireAuth(null)).toThrow(AuthError);
  });
  it('requireAdminAccess: customer blocked (not_found), staff allowed', () => {
    try {
      requireAdminAccess(customer);
      throw new Error('should throw');
    } catch (e) {
      expect((e as AuthError).code).toBe('not_found');
    }
    expect(requireAdminAccess(compliance).sub).toBe('u2');
  });
  it('requireCustomerAccess: customer ok, compliance forbidden, super_admin ok', () => {
    expect(requireCustomerAccess(customer).sub).toBe('u1');
    try {
      requireCustomerAccess(compliance);
      throw new Error('should throw');
    } catch (e) {
      expect((e as AuthError).code).toBe('forbidden');
    }
    expect(requireCustomerAccess(superA).sub).toBe('u3');
  });
  it('requireRole + requirePermission', () => {
    expect(requireRole(compliance, 'compliance_admin').sub).toBe('u2');
    expect(() => requireRole(customer, 'compliance_admin')).toThrow(AuthError);
    expect(requirePermission(compliance, 'order.approve').sub).toBe('u2');
    expect(() => requirePermission(customer, 'order.approve')).toThrow(AuthError);
  });
});
