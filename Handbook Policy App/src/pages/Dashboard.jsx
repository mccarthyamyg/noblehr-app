import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { usePermissions } from '../components/hooks/usePermissions';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import PageHeader from '../components/shared/PageHeader';
import StatCard from '../components/shared/StatCard';
import StatusBadge from '../components/shared/StatusBadge';
import ReAckAnalyticsCard from '../components/shared/ReAckAnalyticsCard';
// Policy filtering now handled server-side via getPoliciesForEmployee backend function
import {
  FileText, Users, ShieldAlert, CheckCircle2, Clock, AlertTriangle,
  ArrowRight, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, isValid } from 'date-fns';

export default function Dashboard() {
  const { org, employee } = useOrg();
  const { isAdmin } = usePermissions();
  const [stats, setStats] = useState({
     policies: 0, activePolicies: 0, employees: 0,
     incidents: 0, pendingAcks: 0, pendingReAcks: 0, recentEvents: []
   });
  const [myPendingPolicies, setMyPendingPolicies] = useState([]);
  const [myOnboarding, setMyOnboarding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!org) return;
    loadDashboard();
  }, [org]);

  async function loadDashboard() {
    setLoadError(null);
    try {
      const [pRes, aRes, incRes, eventsRes, adminCtxRes, onboardingRes] = await Promise.all([
        api.invoke('getPoliciesForEmployee', { organization_id: org.id }),
        api.invoke('getMyAcknowledgments', { organization_id: org.id }),
        isAdmin ? api.invoke('getIncidentReports', { organization_id: org.id }) : Promise.resolve(null),
        isAdmin ? api.invoke('getActivityLog', { organization_id: org.id, limit: 10 }) : Promise.resolve(null),
        isAdmin ? api.invoke('getAdminContext', { organization_id: org.id }) : Promise.resolve(null),
        !isAdmin ? api.invoke('getMyOnboarding', { organization_id: org.id }) : Promise.resolve(null)
      ]);

      const policies = pRes.data?.policies || [];
      const acks = aRes.data?.acknowledgments || [];
      const pendingReAcksForMe = aRes.data?.pending_re_acknowledgments || [];
      const incidents = incRes?.data?.incidents || [];
      const events = eventsRes?.data?.events || [];
      const adminData = adminCtxRes?.data || {};
      const employees = adminData.employees || [];

      // Employee onboarding
      const onboarding = onboardingRes?.data?.onboarding || null;
      if (!isAdmin && onboarding) {
        setMyOnboarding(onboarding);
      }

      const activePolicies = policies.filter(p => p.status === 'active');

      // Policies needing acknowledgment: not yet acked + pending re-acks
      const ackedPolicyIds = new Set(acks.map(a => a.policy_id));
      const pendingReAckPolicyIds = new Set(pendingReAcksForMe.map(r => r.policy_id));

      const pending = isAdmin ? [] : activePolicies.filter(p => {
        if (!p.acknowledgment_required) return false;
        if (pendingReAckPolicyIds.has(p.id)) return true; // needs re-ack
        if (ackedPolicyIds.has(p.id)) return false;
        return true;
      });

      setMyPendingPolicies(pending);
      setStats({
        policies: policies.length,
        activePolicies: activePolicies.length,
        employees: employees.length,
        incidents: incidents.filter(i => i.status === 'submitted' || i.status === 'under_review').length,
        pendingAcks: pending.length,
        pendingReAcks: adminData.pendingReAckCount || 0,
        recentEvents: events
      });
    } catch (e) {
      console.error(e);
      setLoadError(e.data?.error || e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  // Policy filtering moved to server-side for security

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-slate-400 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Could not load dashboard</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
          <button
            type="button"
            onClick={() => loadDashboard()}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${employee?.first_name || employee?.full_name?.split(' ')[0] || 'there'}`}
        description={isAdmin ? `${org?.name} — Organization Overview` : `${org?.name} — Your Policies & Compliance`}
      />

      {/* Stats grid - admin - interactive navigation */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link to={createPageUrl('Policies?status=active')}>
            <StatCard label="Active Policies" value={stats.activePolicies} icon={FileText} color="blue" />
          </Link>
          <Link to={createPageUrl('Employees')}>
            <StatCard label="Employees" value={stats.employees} icon={Users} color="emerald" />
          </Link>
          <Link to={createPageUrl('Incidents?status=open')}>
            <StatCard label="Open Incidents" value={stats.incidents} icon={ShieldAlert} color="amber" />
          </Link>
          <Link to={createPageUrl('AcknowledgementTracking')}>
            <StatCard label="Pending Re-Acks" value={stats.pendingReAcks} icon={TrendingUp} color="orange" />
          </Link>
        </div>
      )}

      {/* Employee onboarding alert */}
      {myOnboarding && (
        <Card className="mb-6 border-appaccent/30 bg-appaccent-light/30">
          <CardContent className="py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-appaccent-light flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-appaccent-dark" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Complete Your Onboarding</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {(myOnboarding.completed_policy_ids?.length || 0)} of {myOnboarding.assigned_policy_ids.length} policies acknowledged
                </p>
              </div>
            </div>
            <Link to={createPageUrl('MyOnboarding')}>
              <button className="px-4 py-2 bg-noble hover:bg-noble-dark text-white rounded-lg text-sm font-medium transition-colors">
                Continue
              </button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Employee pending stat */}
      {!isAdmin && myPendingPolicies.length > 0 && (
        <Link to={createPageUrl('Policies?view=pending')} className="block mb-8">
          <StatCard label="Policies Requiring Your Action" value={myPendingPolicies.length} icon={Clock} color="amber" />
        </Link>
      )}

      {/* Employee pending policies */}
      {myPendingPolicies.length > 0 && (
        <Card className="mb-8 border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-amber-900">Policies Requiring Your Acknowledgment</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myPendingPolicies.map(p => (
                <Link
                  key={p.id}
                  to={createPageUrl(`PolicyView?id=${p.id}`)}
                  className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200/60 hover:shadow-sm transition-all group"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-noble transition-colors" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {myPendingPolicies.length === 0 && !isAdmin && (
        <Card className="mb-8 border-emerald-200 bg-emerald-50/30">
          <CardContent className="py-6 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm text-emerald-800 font-medium">You're all caught up! No pending policy acknowledgments.</p>
          </CardContent>
        </Card>
      )}

      {/* Re-ack analytics - admin */}
      {isAdmin && (
        <div className="mb-8">
          <ReAckAnalyticsCard organizationId={org.id} />
        </div>
      )}

      {/* Recent activity - admin */}
      {isAdmin && stats.recentEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentEvents.map(event => (
                <div key={event.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-appaccent mt-1.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-700">{event.summary}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {event.actor_name && `${event.actor_name} · `}
                      {(() => {
                        const raw = event.created_date ?? event.created_at;
                        const d = raw ? new Date(raw) : null;
                        return d && isValid(d) ? format(d, 'MMM d, h:mm a') : '—';
                      })()}
                    </p>
                  </div>
                  <StatusBadge status={event.event_type?.split('.')[1]} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
