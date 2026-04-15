import React, { useState, Component } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { OrgProvider, useOrg } from './components/hooks/useOrganization';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, FileText, Users, ShieldAlert, FolderLock,
  Bell, Settings, ChevronLeft, ChevronRight, ChevronDown, LogOut, Menu, X, BookOpen, Sparkles, User, ClipboardCheck, FileSearch, Plane, FileSignature, FileCheck, Plug
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { generateCoreCSS } from './components/designSystem';
import { generateThemeCSS } from './components/theme';
import LegalFooter from '@/components/legal/LegalFooter';
import { NobleShieldLogo } from '@/components/NobleHRLogo';

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
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-noble text-white rounded-lg text-sm font-medium hover:bg-noble-dark">
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
  const [openCategories, setOpenCategories] = useState({
    'Handbook & Generators': true,
    'People & Onboarding': true,
    'HR Records & Tracking': true,
    'Audit & Compliance': false,
    'Settings': false
  });
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <NobleShieldLogo className="w-10 h-10 animate-pulse" />
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
    { name: 'DASHBOARD', icon: LayoutDashboard, page: 'Dashboard', category: 'Main', show: true },
    { name: 'Handbook', icon: BookOpen, page: 'Handbook', category: 'Handbook & Generators', show: true },
    { name: 'Policies', icon: FileSignature, page: 'Policies', category: 'Handbook & Generators', show: true },
    { name: 'AI Easy Handbook Generator', icon: Sparkles, page: 'AIHandbookGenerator', category: 'Handbook & Generators', show: hasCap('ai_policies') },
    { name: 'Employees', icon: Users, page: 'Employees', category: 'People & Onboarding', show: hasCap('manage_employees') },
    { name: 'Onboarding', icon: Plane, page: 'Onboarding', category: 'People & Onboarding', show: hasCap('manage_onboarding') },
    { name: 'My Onboarding', icon: Plane, page: 'MyOnboarding', category: 'People & Onboarding', show: !isAdmin && !hasCap('manage_onboarding') },
    { name: 'HR Records', icon: FolderLock, page: 'HRRecords', category: 'HR Records & Tracking', show: hasCap('view_hr_records') },
    { name: 'Acknowledgements', icon: FileCheck, page: 'AcknowledgementTracking', category: 'HR Records & Tracking', show: hasCap('view_acknowledgments') },
    { name: 'Incidents', icon: ShieldAlert, page: 'Incidents', category: 'HR Records & Tracking', show: true },
    { name: 'My HR Docs', icon: FolderLock, page: 'MyWriteUps', category: 'HR Records & Tracking', show: !isAdmin && !hasCap('view_hr_records') },
    { name: 'Compliance checklist', icon: ClipboardCheck, page: 'ComplianceChecklist', category: 'Audit & Compliance', show: hasCap('compliance_checklist') },
    { name: 'Gap audit', icon: FileSearch, page: 'GapAudit', category: 'Audit & Compliance', show: hasCap('gap_audit') },
    { name: 'Activity Log', icon: Bell, page: 'ActivityLog', category: 'Audit & Compliance', show: hasCap('view_activity_log') },
    { name: 'Org Settings', icon: Settings, page: 'OrgSettings', category: 'Settings', show: hasCap('manage_org_settings') },
    { name: 'Integrations', icon: Plug, page: 'IntegrationsSettings', category: 'Settings', show: false },
    { name: 'My Account', icon: User, page: 'Profile', category: 'Settings', show: true },
  ].filter(i => i.show);

  const mobileNavItems = navItems.filter(i => ['Dashboard', 'Handbook', 'Incidents', 'Policies', 'OrgSettings', 'Profile'].includes(i.page)).slice(0, 5);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-slate-200/60 pb-6 pt-6">
        <div className="flex items-center gap-3.5">
          <NobleShieldLogo className="w-10 h-10 flex-shrink-0 rounded-xl" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[17px] font-black tracking-tight text-slate-900 truncate">{org?.name || 'Noble HR'}</p>
              <p className="text-[10px] font-bold text-appaccent-dark uppercase tracking-widest truncate mt-0.5">{employee?.role || 'Governance'}</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {Object.entries(
          navItems.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
          }, {})
        ).map(([category, items]) => {
          const isCatOpen = collapsed || category === 'Main' || openCategories[category] !== false;

          return (
          <div key={category} className="space-y-0.5">
            {!collapsed && category !== 'Main' && (
              <button 
                onClick={() => setOpenCategories(prev => ({...prev, [category]: !prev[category]}))}
                className="w-full flex items-center justify-between px-3 py-1 mt-2 mb-0.5 bg-noble-light/5 hover:bg-noble-light/10 border border-noble/40 shadow-sm rounded-md group transition-colors"
              >
                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                  {category}
                </h3>
                {openCategories[category] !== false ? (
                   <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-700" />
                ) : (
                   <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                )}
              </button>
            )}
            
            <div className={`transition-all overflow-hidden ${!isCatOpen ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}`}>
              <div className="space-y-0.5 pb-2 px-1 -mx-1">
              {items.map(item => {
                const active = currentPageName === item.page;
                const isHandbook = item.name === 'Handbook';
                
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileOpen(false)}
                    title={`Go to ${item.name}`}
                    className={`flex items-center justify-between px-3 py-1 rounded-lg text-sm transition-all duration-150 relative
                      ${item.name === 'DASHBOARD'
                        ? `border-2 border-noble font-bold text-slate-900 shadow-sm ${active ? 'bg-noble-light/10 shadow-md shadow-noble/90 scale-[1.01] transform z-10' : 'hover:bg-slate-50'}`
                        : active
                          ? 'bg-noble-light/15 text-slate-900 font-bold border-l-4 border-noble shadow-md shadow-noble/80 ring-1 ring-slate-100 scale-[1.01] transform z-10 rounded-l-none'
                          : 'text-slate-700 font-medium hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <div className="flex items-center gap-3 pr-2 min-w-0">
                      <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-appaccent-dark' : 'text-slate-500'}`} />
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!collapsed && isHandbook && (
                        <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider bg-green-100/80 text-green-700 px-1.5 py-0.5 rounded shadow-sm border border-green-200/60">
                          Published
                        </span>
                      )}
                      {!collapsed && active && (
                        <ChevronRight className="w-4 h-4 text-slate-700 flex-shrink-0" />
                      )}
                    </div>
                  </Link>
                );
              })}
              </div>
            </div>
          </div>
        )})}
      </nav>

      <div className="p-3 border-t border-slate-200/60">
        {!collapsed && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium text-slate-700 truncate">{employee?.first_name ? `${employee.first_name} ${employee.last_name || ''}`.trim() : employee?.full_name}</p>
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
      {/* App accent stripe */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-appaccent-dark via-appaccent to-appaccent-light z-[60]" />
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
            <NobleShieldLogo className="w-9 h-9 rounded-lg" />
          <span className="text-base font-black text-slate-900 tracking-tight">{org?.name || 'Noble HR'}</span>
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
      <div className={`hidden lg:flex flex-col relative transition-all duration-300 z-30 ${collapsed ? 'w-0' : 'w-60 shrink-0'}`}>
        <div className={`absolute top-0 left-0 h-full bg-white border-r border-slate-200/60 overflow-hidden flex flex-col transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-60 opacity-100'}`}>
          <div className="w-60 h-full flex flex-col shrink-0">
             <SidebarContent />
          </div>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`absolute top-7 z-50 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-50 transition-all duration-300 ${collapsed ? 'scale-125 -right-8 shadow-md ring-1 ring-slate-900/5 cursor-pointer' : '-right-3 shadow-sm cursor-pointer'}`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3 h-3 text-slate-900" /> : <ChevronLeft className="w-3 h-3 text-slate-500" />}
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 pt-14 lg:pt-0 overflow-y-auto">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto lg:min-h-screen pb-36 lg:pb-8 scroll-pb-36 lg:scroll-pb-0" data-page-transition>
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
                    ? 'text-noble-dark bg-slate-50 border-t-2 border-appaccent'
                    : 'text-slate-600 hover:text-slate-900 border-t-2 border-transparent'
                }`}
              >
                <item.icon className={`w-5 h-5 mb-1 ${active ? 'text-noble' : ''}`} />
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