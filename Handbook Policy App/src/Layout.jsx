import React, { useState, Component } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { OrgProvider, useOrg } from './components/hooks/useOrganization';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, FileText, Users, ShieldAlert, FolderLock,
  Bell, Settings, ChevronLeft, ChevronRight, LogOut, Building2, Menu, X, BookOpen, Sparkles, User, ClipboardCheck, FileSearch
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { generateCoreCSS } from './components/designSystem';
import { generateThemeCSS } from './components/theme';
import LegalFooter from '@/components/legal/LegalFooter';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-50">
          <div className="text-center max-w-md p-8">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-xl">!</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-4">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Layout({ children, currentPageName }) {
  if (currentPageName === 'Setup') {
    return (
      <OrgProvider>
        {children}
      </OrgProvider>
    );
  }

  return (
    <ErrorBoundary>
      <OrgProvider>
        <LayoutShell currentPageName={currentPageName}>
          {children}
        </LayoutShell>
      </OrgProvider>
    </ErrorBoundary>
  );
}

function LayoutShell({ children, currentPageName }) {
  const { org, employee, loading, logout } = useOrg();
  const { superAdminImpersonating, exitImpersonation } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center animate-pulse">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!org || !employee) {
    if (typeof window !== 'undefined' && !window.location.href.includes('Login')) {
      window.location.href = createPageUrl('Login');
    }
    return null;
  }

  const isAdmin = employee?.permission_level === 'org_admin';
  const caps = Array.isArray(employee?.capabilities) ? employee.capabilities : [];
  const hasCap = (cap) => isAdmin || caps.includes(cap);

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard', show: true },
    { name: 'Handbook', icon: BookOpen, page: 'Handbook', show: true },
    { name: 'Policies', icon: FileText, page: 'Policies', show: true },
    { name: 'AI Easy Handbook Generator', icon: Sparkles, page: 'AIHandbookGenerator', show: hasCap('ai_policies') },
    { name: 'My Onboarding', icon: Users, page: 'MyOnboarding', show: !isAdmin && !hasCap('manage_onboarding') },
    { name: 'My HR Docs', icon: FolderLock, page: 'MyWriteUps', show: !isAdmin && !hasCap('view_hr_records') },
    { name: 'Onboarding', icon: Users, page: 'Onboarding', show: hasCap('manage_onboarding') },
    { name: 'Employees', icon: Users, page: 'Employees', show: hasCap('manage_employees') },
    { name: 'HR Records', icon: FolderLock, page: 'HRRecords', show: hasCap('view_hr_records') },
    { name: 'Acknowledgements', icon: FileText, page: 'AcknowledgementTracking', show: hasCap('view_acknowledgments') },
    { name: 'Incidents', icon: ShieldAlert, page: 'Incidents', show: true },
    { name: 'Activity Log', icon: Bell, page: 'ActivityLog', show: hasCap('view_activity_log') },
    { name: 'Compliance checklist', icon: ClipboardCheck, page: 'ComplianceChecklist', show: hasCap('compliance_checklist') },
    { name: 'Gap audit', icon: FileSearch, page: 'GapAudit', show: hasCap('gap_audit') },
    { name: 'Org Settings', icon: Settings, page: 'OrgSettings', show: hasCap('manage_org_settings') },
    { name: 'My Account', icon: User, page: 'Profile', show: true },
  ].filter(i => i.show);

  const mobileNavItems = navItems.filter(i => ['Dashboard', 'Handbook', 'Incidents', 'Policies', 'OrgSettings', 'Profile'].includes(i.page)).slice(0, 5);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{org?.name || 'Noble HR'}</p>
              <p className="text-xs text-slate-400 truncate">{employee?.role || 'Governance'}</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = currentPageName === item.page;
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              onClick={() => setMobileOpen(false)}
              title={`Go to ${item.name}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200/60">
        {!collapsed && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium text-slate-700 truncate">{employee?.full_name}</p>
            <p className="text-xs text-slate-400 truncate">{employee?.user_email}</p>
          </div>
        )}
        <button
          onClick={() => { logout(); navigate(createPageUrl('Login'), { replace: true }); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all w-full"
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {superAdminImpersonating && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm">
          <span>Viewing as <strong>{org?.name}</strong> (Super Admin)</span>
          <Button variant="ghost" size="sm" className="text-white hover:bg-amber-600" onClick={exitImpersonation}>
            Exit to Super Admin
          </Button>
        </div>
      )}
      <div className="flex min-h-screen bg-slate-50/50 supports-[height:100dvh]:min-h-dvh" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          ${generateCoreCSS()}
          ${generateThemeCSS()}
        }
        html {
          overscroll-behavior: none;
        }
        body {
          overscroll-behavior: none;
          user-select: none;
          -webkit-user-select: none;
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }

        [data-page-transition] {
          animation: pageIn 300ms ease-out;
        }
        @keyframes pageIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}} />
      
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm">{org?.name || 'Noble HR'}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <div className={`lg:hidden fixed top-14 left-0 bottom-0 z-30 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:flex flex-col relative bg-white border-r border-slate-200/60 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-7 -right-3 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 pt-14 lg:pt-0 overflow-y-auto">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto lg:min-h-screen pb-20 lg:pb-8" data-page-transition>
          {children}
          <LegalFooter className="mt-12 border-t border-slate-100 pt-6" />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-area-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center divide-x divide-slate-200">
          {mobileNavItems.map(item => {
            const active = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex-1 flex flex-col items-center justify-center py-3 text-xs font-medium transition-colors ${
                  active
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <item.icon className="w-5 h-5 mb-1" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </>
  );
}