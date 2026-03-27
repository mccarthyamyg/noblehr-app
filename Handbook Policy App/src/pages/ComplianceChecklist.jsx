import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ClipboardCheck, Loader2, RefreshCw, ExternalLink, Scale, RotateCcw, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const VERIFICATION_LABELS = { current: 'Current', needs_review: 'Needs review', changed: 'Changed', outdated: 'Outdated' };
const VERIFICATION_CLASS = { current: 'text-green-600', needs_review: 'text-amber-600', changed: 'text-orange-600', outdated: 'text-red-600' };

export default function ComplianceChecklist() {
  const { org, employee } = useOrg();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [viewOriginalItem, setViewOriginalItem] = useState(null);

  const isAdmin = employee?.permission_level === 'org_admin';

  useEffect(() => {
    if (!org || !isAdmin) return;
    load();
  }, [org, isAdmin]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.invoke('getComplianceChecklist', {});
      setItems(res.data?.items ?? []);
    } catch (e) {
      setError(e?.message || 'Failed to load checklist');
    } finally {
      setLoading(false);
    }
  }

  async function runVerify() {
    setVerifying(true);
    setError(null);
    try {
      const res = await api.invoke('verifyComplianceChecklist', {});
      setItems(res.data?.items ?? []);
    } catch (e) {
      setError(e?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  async function toggleConfirm(item, confirmed) {
    setSavingId(item.id);
    try {
      await api.invoke('confirmComplianceItem', {
        item_id: item.id,
        confirmed: !!confirmed,
        notes: item.notes,
      });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, confirmed: confirmed ? 1 : 0, confirmed_at: confirmed ? new Date().toISOString() : null, confirmed_by: confirmed ? employee?.user_email : null } : i));
    } catch (e) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSavingId(null);
    }
  }

  async function saveNotes(item, notes) {
    setSavingId(item.id);
    try {
      await api.invoke('confirmComplianceItem', {
        item_id: item.id,
        confirmed: !!item.confirmed,
        notes,
      });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, notes } : i));
    } catch (e) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSavingId(null);
    }
  }

  function isSourcedContentEdited(item) {
    const textDiff = (item.original_requirement_text ?? item.requirement_text) !== (item.requirement_text ?? '');
    const suggestedDiff = (item.original_suggested_answer ?? item.suggested_answer) !== (item.suggested_answer ?? '');
    return textDiff || suggestedDiff;
  }

  async function saveDisplayContent(item, field, value) {
    setSavingId(item.id);
    try {
      await api.invoke('updateComplianceItemContent', {
        item_id: item.id,
        requirement_text: field === 'requirement_text' ? value : item.requirement_text,
        suggested_answer: field === 'suggested_answer' ? value : item.suggested_answer,
      });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, [field]: value } : i));
    } catch (e) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSavingId(null);
    }
  }

  async function restoreOriginal(item) {
    setSavingId(item.id);
    try {
      const res = await api.invoke('restoreComplianceItemOriginal', { item_id: item.id });
      setItems(prev => prev.map(i => i.id === item.id ? res.data?.item ?? i : i));
      setViewOriginalItem(null);
    } catch (e) {
      setError(e?.message || 'Failed to restore');
    } finally {
      setSavingId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <p className="text-slate-500">Access restricted to admins.</p>
      </div>
    );
  }

  const stateLabel = org?.state || '—';

  return (
    <div>
      <PageHeader
        title="Compliance checklist"
        description={`State/industry/employees: ${stateLabel} / ${org?.industry || '—'} / ${org?.employee_count != null ? org.employee_count : '—'}. Confirm requirements and track verification.`}
      />
      <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        Policies are generated from current state and federal law with source citations. For questions about how a specific law applies to your unique business situation, consult a licensed attorney.
      </p>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {items.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runVerify} disabled={verifying || loading}>
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Re-verify sources
          </Button>
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>No checklist items yet. Set your organization state (and optional employee count) in Org Settings, then reload this page to generate state-specific requirements.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            const edited = isSourcedContentEdited(item);
            return (
              <Card key={item.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* Legal content — visually distinct */}
                      <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-amber-800 mb-2">
                          <Scale className="w-3.5 h-3.5" />
                          Legal requirement (sourced)
                        </div>
                        {edited && (
                          <p className="mb-2 text-xs text-amber-700 bg-amber-100/80 rounded px-2 py-1">
                            This is sourced legal content. Edits are tracked.
                          </p>
                        )}
                        <Label className="text-xs text-slate-500">Requirement</Label>
                        <Textarea
                          className="mt-0.5 bg-white border-amber-200/60"
                          rows={2}
                          defaultValue={item.requirement_text || ''}
                          placeholder="Requirement text"
                          onBlur={e => {
                            const v = e.target.value;
                            if (v !== (item.requirement_text || '')) saveDisplayContent(item, 'requirement_text', v);
                          }}
                          disabled={!!savingId}
                        />
                        <Label className="text-xs text-slate-500 mt-2 block">Suggested answer</Label>
                        <Textarea
                          className="mt-0.5 bg-white border-amber-200/60"
                          rows={2}
                          defaultValue={item.suggested_answer || ''}
                          placeholder="Suggested answer"
                          onBlur={e => {
                            const v = e.target.value;
                            if (v !== (item.suggested_answer || '')) saveDisplayContent(item, 'suggested_answer', v);
                          }}
                          disabled={!!savingId}
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setViewOriginalItem(item)}>
                            <FileText className="w-3 h-3 mr-1" /> View original
                          </Button>
                          {edited && (
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => restoreOriginal(item)} disabled={!!savingId}>
                              <RotateCcw className="w-3 h-3 mr-1" /> Restore original
                            </Button>
                          )}
                        </div>
                      </div>
                      {(item.source_citation || item.source_url) && (
                        <p className="mt-2 text-xs text-slate-500">
                          Source: {item.source_citation || '—'}
                          {item.source_url && (
                            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center text-blue-600 hover:underline">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0 text-xs text-slate-400">
                        {item.researched_at && <span>Researched: {format(new Date(item.researched_at), 'MMM d, yyyy')}</span>}
                        {item.verified_at && <span>Verified: {format(new Date(item.verified_at), 'MMM d, yyyy')}</span>}
                        {item.verification_status && (
                          <span className={VERIFICATION_CLASS[item.verification_status] || 'text-slate-500'}>
                            Status: {VERIFICATION_LABELS[item.verification_status] || item.verification_status}
                          </span>
                        )}
                      </div>
                      {item.confirmed_at && (
                        <p className="mt-1 text-xs text-slate-400">
                          Last confirmed: {format(new Date(item.confirmed_at), 'MMM d, yyyy')}
                          {item.confirmed_by && ` by ${item.confirmed_by}`}
                        </p>
                      )}
                      <div className="mt-2">
                        <Label className="text-xs text-slate-500">Notes (your notes)</Label>
                        <Textarea
                          className="mt-0.5"
                          rows={2}
                          defaultValue={item.notes || ''}
                          placeholder="Optional notes"
                          onBlur={e => {
                            const v = e.target.value.trim();
                            if (v !== (item.notes || '')) saveNotes(item, v);
                          }}
                          disabled={!!savingId}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {savingId === item.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                      <Label className="text-sm text-slate-600">Confirmed</Label>
                      <Switch
                        checked={!!item.confirmed}
                        onCheckedChange={v => toggleConfirm(item, v)}
                        disabled={!!savingId}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!viewOriginalItem} onOpenChange={open => !open && setViewOriginalItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Original sourced content</DialogTitle>
          </DialogHeader>
          {viewOriginalItem && (
            <div className="space-y-3 text-sm">
              <div>
                <Label className="text-xs text-slate-500">Requirement (original)</Label>
                <p className="mt-1 rounded bg-slate-100 p-2 whitespace-pre-wrap">{viewOriginalItem.original_requirement_text ?? viewOriginalItem.requirement_text ?? '—'}</p>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Suggested answer (original)</Label>
                <p className="mt-1 rounded bg-slate-100 p-2 whitespace-pre-wrap">{viewOriginalItem.original_suggested_answer ?? viewOriginalItem.suggested_answer ?? '—'}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => restoreOriginal(viewOriginalItem)} disabled={!!savingId}>
                <RotateCcw className="w-3 h-3 mr-1" /> Restore original
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
