import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import EmptyState from '../components/shared/EmptyState';
import { FileSearch, Loader2, Plus, CheckCircle2 } from 'lucide-react';

export default function GapAudit() {
  const { org, employee } = useOrg();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = employee?.permission_level === 'org_admin';

  useEffect(() => {
    if (!org || !isAdmin) return;
    load();
  }, [org, isAdmin]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.invoke('getGapAudit', {});
      setAudit(res.data ?? { required: [], current: [], missing: [] });
    } catch (e) {
      setError(e?.message || 'Failed to run gap audit');
    } finally {
      setLoading(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <p className="text-slate-500">Access restricted to admins.</p>
      </div>
    );
  }

  const missing = audit?.missing ?? [];
  const requiredCount = audit?.required?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Gap audit"
        description={`Required policies for ${org?.state || 'your state'} vs your current handbook. Missing: ${missing.length} of ${requiredCount}.`}
      />
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Running audit…
        </div>
      ) : !org?.state ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <FileSearch className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>Set your organization state in Org Settings to run a gap audit.</p>
          </CardContent>
        </Card>
      ) : missing.length === 0 && requiredCount > 0 ? (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600" />
            <p className="font-medium text-slate-800">No missing required policies</p>
            <p className="text-sm text-slate-600 mt-1">Your handbook covers all {requiredCount} required policies for {org.state}.</p>
          </CardContent>
        </Card>
      ) : missing.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No required list for this state"
          description="Gap audit is available for MA, NY, and CA. Other states can be added in configuration."
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-slate-700 mb-3">Missing required policies — create a draft for each:</p>
              <ul className="space-y-2">
                {missing.map(title => (
                  <li key={title} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
                    <span className="text-sm text-slate-800">{title}</span>
                    <Link to={createPageUrl('PolicyEditor')}>
                      <Button size="sm" variant="outline">
                        <Plus className="w-3 h-3 mr-1" /> Create policy
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                Creating a policy opens the editor with an empty draft. Use “Generate with AI” on the Policies page to generate content for a missing policy title.
              </p>
            </CardContent>
          </Card>
          <Button variant="outline" className="mt-4" onClick={load}>
            Refresh audit
          </Button>
        </>
      )}
    </div>
  );
}

