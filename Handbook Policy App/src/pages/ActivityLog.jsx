import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { usePermissions } from '../components/hooks/usePermissions';
import { createPageUrl } from '../utils';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import { Bell, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isValid } from 'date-fns';

const eventIcons = {
  'policy.published': '📋',
  'policy.updated': '✏️',
  'policy.acknowledged': '✅',
  'policy.archived': '📦',
  'incident.created': '🚨',
  'incident.status_changed': '🔄',
  'hr_record.created': '📁',
  'employee.added': '👤',
  'employee.terminated': '❌',
};

const PAGE_SIZE = 50;

export default function ActivityLog() {
  const { org } = useOrg();
  const { isAdmin } = usePermissions();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!org) return;
    if (!isAdmin) {
      window.location.href = createPageUrl('Dashboard');
      return;
    }
    setPage(0);
  }, [org, isAdmin, search, typeFilter]);

  useEffect(() => {
    if (!org || !isAdmin) return;
    loadEvents();
  }, [org, isAdmin, page, search, typeFilter]);

  async function loadEvents() {
    setLoading(true);
    setLoadError(null);
    try {
      const skip = page * PAGE_SIZE;
      const res = await api.invoke('getActivityLog', {
        organization_id: org.id,
        skip,
        limit: PAGE_SIZE,
        search,
        event_type_prefix: typeFilter === 'all' ? '' : typeFilter
      });
      setEvents(res.data?.events || []);
    } catch (e) {
      setLoadError(e.data?.error || e.message || 'Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }

  const filtered = events;

  const hasMore = events.length === PAGE_SIZE;

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading activity...</div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Could not load activity log</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
          <Button type="button" variant="destructive" className="mt-3" onClick={() => loadEvents()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Activity Log" description="Audit trail of all system events" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..." className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <Filter className="w-4 h-4 mr-2 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="policy">Policy Events</SelectItem>
            <SelectItem value="incident">Incident Events</SelectItem>
            <SelectItem value="hr_record">HR Record Events</SelectItem>
            <SelectItem value="employee">Employee Events</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Bell} title="No events yet" description="System events will appear here as activity occurs" />
      ) : (
        <>
          <Card className="divide-y divide-slate-100">
            {filtered.map(event => (
              <div key={event.id} className="flex items-start gap-4 p-5">
                <div className="text-xl flex-shrink-0 mt-0.5">
                  {eventIcons[event.event_type] || '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">{event.summary}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-slate-400">
                      {(() => {
                        const raw = event.created_date ?? event.created_at;
                        const d = raw ? new Date(raw) : null;
                        return d && isValid(d) ? format(d, 'MMM d, yyyy \'at\' h:mm a') : '—';
                      })()}
                    </span>
                    {event.actor_name && (
                      <span className="text-xs text-slate-400">by {event.actor_name}</span>
                    )}
                  </div>
                </div>
                <StatusBadge status={event.event_type?.split('.')[1]} />
              </div>
            ))}
          </Card>

          <div className="flex items-center justify-center gap-2 mt-6">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-slate-500">Page {page + 1}</span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!hasMore}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
