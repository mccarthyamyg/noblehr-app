import { useContext } from 'react';
import { AuthContext } from '@/lib/AuthContext';

export function OrgProvider({ children }) {
  return children;
}

export function useOrg() {
  const { org, employee, isLoadingAuth, refreshContext, logout } = useContext(AuthContext);
  return {
    org,
    employee,
    loading: isLoadingAuth,
    setOrg: () => {},
    setEmployee: () => {},
    refreshOrg: refreshContext,
    refreshEmployee: refreshContext,
    logout,
  };
}
