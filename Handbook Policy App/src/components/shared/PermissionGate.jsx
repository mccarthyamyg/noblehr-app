import { useOrg } from '../hooks/useOrganization';

export default function PermissionGate({ allowed = [], children, fallback = null }) {
  const { employee } = useOrg();
  
  if (!employee) return fallback;
  if (allowed.length === 0) return children;
  if (allowed.includes(employee.permission_level)) return children;
  
  return fallback;
}