import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { usePermissions } from '../components/hooks/usePermissions';
import PageHeader from '../components/shared/PageHeader';
import { Users, CheckCircle2, Download, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';

export default function AcknowledgementTracking() {
  const { org } = useOrg();
  const { isAdmin } = usePermissions();
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  useEffect(() => {
    if (!org || !isAdmin) return;
    loadData();
  }, [org, isAdmin]);

  async function loadData() {
    setLoadError(null);
    try {
      const result = await api.invoke('getAcknowledgementMatrix', {
        organization_id: org.id
      });
      setMatrix(result.data.matrix);
    } catch (e) {
      setLoadError(e.data?.error || e.message || 'Failed to load acknowledgements');
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const headers = ['Employee', 'Email', 'Acknowledged', 'Pending', 'Progress'];
    const rows = filtered.map(row => [
      row.employee_name,
      row.employee_email,
      row.progress.acked,
      row.progress.total - row.progress.acked,
      `${row.progress.percent}%`
    ]);

    const csv = [headers, ...rows].map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acknowledgements_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  const filtered = matrix.filter(row => {
    if (search && !row.employee_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!isAdmin) return <div className="text-center py-20 text-sm text-slate-500">Access denied.</div>;
  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading...</div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Could not load acknowledgements</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
          <Button type="button" variant="destructive" className="mt-3" onClick={() => loadData()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Acknowledgement Tracking"
        description="Monitor policy acknowledgements across your organization"
        actions={
          <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search employees..."
          className="flex-1"
        />
      </div>

      {matrix.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No employees found.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => {
            const isExpanded = expandedEmployee === row.employee_id;

            return (
              <Card key={row.employee_id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedEmployee(isExpanded ? null : row.employee_id)}
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-slate-900">{row.employee_name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{row.employee_email}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-2 w-24">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            row.progress.percent === 100 ? 'bg-emerald-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${row.progress.percent}%` }}
                        />
                      </div>
                      <Badge variant={row.progress.percent === 100 ? 'default' : 'outline'} className="whitespace-nowrap">
                        {row.progress.acked}/{row.progress.total}
                      </Badge>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {isExpanded && row.applicable_policies.length > 0 && (
                  <div className="border-t border-slate-200 bg-slate-50/50 p-4">
                    <div className="space-y-2">
                      {row.applicable_policies.map(policy => (
                        <div key={policy.policy_id} className={`flex items-center justify-between p-3 bg-white rounded-lg border ${policy.needs_re_ack ? 'border-orange-200/60 bg-orange-50/20' : 'border-slate-200/60'}`}>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{policy.policy_title}</p>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            {policy.needs_re_ack ? (
                              <Badge className="bg-orange-100 text-orange-800 border border-orange-200">
                                Re-acknowledgment Required
                              </Badge>
                            ) : policy.acknowledged ? (
                              <div className="flex items-center gap-2 text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-xs font-medium">
                                  {format(new Date(policy.acknowledged_at), 'MMM d, yyyy')}
                                </span>
                              </div>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                Pending
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
