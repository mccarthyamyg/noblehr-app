import React, { createContext, useState, useContext, useEffect } from 'react';
import { api } from '@/api/client';
import { createPageUrl } from '@/utils';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [superAdminImpersonating, setSuperAdminImpersonating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      // Web: cookie sent via credentials: 'include'; no token in localStorage
      const data = await api.me();
      if (data.superAdmin) {
        setUser(data.user);
        setOrg(null);
        setEmployee(null);
        setSuperAdmin(true);
      } else {
        setUser({ email: data.employee?.user_email, full_name: data.employee?.full_name });
        setOrg(data.org);
        setEmployee(data.employee);
        setSuperAdmin(false);
      }
      setIsAuthenticated(true);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        api.logout();
      }
      setUser(null);
      setOrg(null);
      setEmployee(null);
      setSuperAdmin(false);
      setSuperAdminImpersonating(false);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
    setAuthError(null);
    try {
      const data = await api.auth.login(email, password);
      setUser(data.user);
      setOrg(data.org);
      setEmployee(data.employee);
      setSuperAdmin(!!data.superAdmin);
      setIsAuthenticated(true);
      return data;
    } catch (err) {
      const msg = err.data?.error || err.message || 'Login failed';
      if (err.data?.code === 'email_not_verified') {
        setAuthError({ text: msg, code: 'email_not_verified' });
      } else if (err.data?.rejected) {
        setAuthError({ text: msg, link: 'RequestApprovalAgain' });
      } else {
        setAuthError(msg);
      }
      throw err;
    }
  };

  const loginWithGoogle = async (credential) => {
    setAuthError(null);
    try {
      const data = await api.auth.loginWithGoogle(credential);
      setUser(data.user);
      setOrg(data.org);
      setEmployee(data.employee);
      setIsAuthenticated(true);
      return data;
    } catch (err) {
      setAuthError(err.data?.error || err.message || 'Login failed');
      if (err.status === 404 && err.data?.needSignup) {
        throw Object.assign(new Error(err.data?.error), {
          needSignup: true,
          email: err.data.email,
          full_name: err.data.full_name,
        });
      }
      throw err;
    }
  };

  const registerWithGoogle = async (payload) => {
    setAuthError(null);
    try {
      const data = await api.auth.registerWithGoogle(payload);
      setUser(data.user);
      setOrg(data.org);
      setEmployee(data.employee);
      setIsAuthenticated(true);
      return data;
    } catch (err) {
      setAuthError(err.data?.error || err.message || 'Google Sign-Up failed');
      throw err;
    }
  };

  const register = async (payload) => {
    setAuthError(null);
    try {
      const data = await api.auth.register(payload);
      setUser(data.user);
      setOrg(data.org);
      setEmployee(data.employee);
      setIsAuthenticated(true);
      return data;
    } catch (err) {
      setAuthError(err.data?.error || err.message || 'Registration failed');
      throw err;
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setOrg(null);
    setEmployee(null);
    setSuperAdmin(false);
    setSuperAdminImpersonating(false);
    setIsAuthenticated(false);
  };

  const exitImpersonation = () => {
    api.logout();
    window.location.href = createPageUrl('Login');
  };

  const refreshContext = async () => {
    try {
      const data = await api.me();
      if (data.superAdminImpersonating) {
        setUser(data.user);
        setOrg(data.org);
        setEmployee(data.employee);
        setSuperAdmin(true);
        setSuperAdminImpersonating(true);
      } else if (data.superAdmin) {
        setUser(data.user);
        setOrg(null);
        setEmployee(null);
        setSuperAdmin(true);
        setSuperAdminImpersonating(false);
      } else {
        setUser({ email: data.employee?.user_email, full_name: data.employee?.full_name });
        setOrg(data.org);
        setEmployee(data.employee);
        setSuperAdmin(false);
        setSuperAdminImpersonating(false);
      }
      return data;
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      org,
      employee,
      superAdmin,
      superAdminImpersonating,
      exitImpersonation,
      isAuthenticated,
      isLoadingAuth,
      authError,
      login,
      loginWithGoogle,
      register,
      registerWithGoogle,
      logout,
      checkAuth,
      refreshContext,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
