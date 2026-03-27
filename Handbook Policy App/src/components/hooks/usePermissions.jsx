import { useOrg } from './useOrganization';

/**
 * Single source of truth for permission checks.
 * Only org_admin has elevated access. Manager = same as employee (basic).
 * Admin can later grant granular permissions to managers per legal.
 */
export function usePermissions() {
  const { employee } = useOrg();

  return {
    isAdmin: employee?.permission_level === 'org_admin',
    isOrgAdmin: employee?.permission_level === 'org_admin',
    isManager: employee?.permission_level === 'manager',
    isEmployee: employee?.permission_level === 'employee' || employee?.permission_level === 'manager',
    permission_level: employee?.permission_level
  };
}