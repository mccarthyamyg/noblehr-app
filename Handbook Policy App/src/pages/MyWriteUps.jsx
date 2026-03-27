import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import PageHeader from '../components/shared/PageHeader';
import EmptyState from '../components/shared/EmptyState';
import { FileWarning, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';

export default function MyWriteUps() {
  const { org, employee } = useOrg();
  const [writeUps, setWriteUps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org || !employee) return;
    loadData();
  }, [org, employee]);

  async function loadData() {
    const result = await api.invoke('getHRRecords', {
      organization_id: org.id,
      record_type: 'write_up'
    });
    setWriteUps(result.data.records || []);
    setLoading(false);
  }

  async function acknowledgeWriteUp(record) {
    await api.invoke('acknowledgeHRRecord', {
      record_id: record.id,
      organization_id: org.id
    });
    loadData();
  }

  const disciplineLevelLabels = {
    coaching_verbal: 'Coaching / Verbal',
    written_warning: 'Written Warning',
    final_warning: 'Final Warning',
    termination_review: 'Termination Review'
  };

  const pendingAcknowledgment = writeUps.filter(w => w.signature_required && !w.employee_acknowledged_at);

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading...</div>;

  return (
    <div>
      <PageHeader
        title="My HR Documents"
        description="Review documentation and acknowledgments"
      />

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">HR Documentation</p>
            <p className="text-xs text-blue-700 mt-1">
              These are official HR records for your review. You may acknowledge receipt but cannot edit or remove these documents.
            </p>
          </div>
        </div>
      </div>

      {writeUps.length === 0 ? (
        <EmptyState
          icon={FileWarning}
          title="No HR documents"
          description="You have no HR documentation on file"
        />
      ) : (
        <div className="space-y-4">
          {pendingAcknowledgment.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Pending Acknowledgment ({pendingAcknowledgment.length})</h2>
              <div className="space-y-3">
                {pendingAcknowledgment.map(record => (
                  <Card key={record.id} className="border-amber-200 bg-amber-50/30">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-5 h-5 text-amber-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900 mb-2">{record.title}</h3>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              record.discipline_level === 'termination_review' ? 'bg-red-100 text-red-700' :
                              record.discipline_level === 'final_warning' ? 'bg-orange-100 text-orange-700' :
                              record.discipline_level === 'written_warning' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {disciplineLevelLabels[record.discipline_level] || record.discipline_level}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-4" dangerouslySetInnerHTML={{ __html: record.description }} />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                              Created: {format(new Date(record.created_date), 'MMMM d, yyyy')}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeWriteUp(record)}
                              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Acknowledge Receipt
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">All Documents ({writeUps.length})</h2>
            <div className="space-y-3">
              {writeUps.map(record => (
                <Card key={record.id} className="border-slate-200/60">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        record.discipline_level === 'termination_review' ? 'bg-red-100' :
                        record.discipline_level === 'final_warning' ? 'bg-orange-100' :
                        record.discipline_level === 'written_warning' ? 'bg-amber-100' :
                        'bg-blue-100'
                      }`}>
                        <AlertCircle className={`w-5 h-5 ${
                          record.discipline_level === 'termination_review' ? 'text-red-700' :
                          record.discipline_level === 'final_warning' ? 'text-orange-700' :
                          record.discipline_level === 'written_warning' ? 'text-amber-700' :
                          'text-blue-700'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-semibold text-slate-900">{record.title}</h3>
                          {record.is_locked && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">Locked</span>
                          )}
                          {record.zero_tolerance_flag && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">Zero Tolerance</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            record.discipline_level === 'termination_review' ? 'bg-red-100 text-red-700' :
                            record.discipline_level === 'final_warning' ? 'bg-orange-100 text-orange-700' :
                            record.discipline_level === 'written_warning' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {disciplineLevelLabels[record.discipline_level] || record.discipline_level}
                          </span>
                          {record.employee_acknowledged_at ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Acknowledged
                            </span>
                          ) : record.signature_required ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Pending</span>
                          ) : null}
                        </div>
                        <p className="text-sm text-slate-600 mb-3" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(record.description || '') }} />
                        <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                          <span>Created: {format(new Date(record.created_date), 'MMM d, yyyy')}</span>
                          {record.employee_acknowledged_at && (
                            <span>Acknowledged: {format(new Date(record.employee_acknowledged_at), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}