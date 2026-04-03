import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import { FileText, Plus, Search, Filter, CheckCircle2, Clock, Eye, Archive, Sparkles, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from 'date-fns';

export default function Policies() {
  const { org, employee } = useOrg();
  const navigate = useNavigate();
  const [policies, setPolicies] = useState([]);
  const [acks, setAcks] = useState([]);
  const [pendingReAcks, setPendingReAcks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generateStreaming, setGenerateStreaming] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [generateError, setGenerateError] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [suggestedTitles, setSuggestedTitles] = useState([]);
  const [scanError, setScanError] = useState(null);
  const [generatingTitle, setGeneratingTitle] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importExtracting, setImportExtracting] = useState(false);
  const [extractedPolicies, setExtractedPolicies] = useState([]);
  const [importCreating, setImportCreating] = useState(false);
  const [importError, setImportError] = useState(null);

  const isAdmin = employee?.permission_level === 'org_admin';

  async function openScanDialog() {
    setScanOpen(true);
    setScanError(null);
    setSuggestedTitles([]);
    setScanLoading(true);
    try {
      const titles = await api.scanHandbookMissing();
      setSuggestedTitles(titles);
    } catch (e) {
      setScanError(e?.message || 'Scan failed');
    } finally {
      setScanLoading(false);
    }
  }

  async function generateFromSuggestedTitle(title) {
    setGeneratingTitle(title);
    setGenerateError(null);
    setGeneratedContent('');
    setGenerateStreaming(true);
    try {
      let fullText = '';
      await api.streamGeneratePolicy(
        { prompt: `Generate a complete policy document for: ${title}`, orgName: org?.name, industry: org?.industry, state: org?.state },
        (chunk) => { fullText += chunk; setGeneratedContent(fullText); }
      );
      if (!fullText.trim()) {
        setGenerateError('No content generated.');
        setGenerateStreaming(false);
        setGeneratingTitle(null);
        return;
      }
      const policyTitle = fullText.split('\n')[0]?.replace(/^#+\s*/, '').trim().slice(0, 200) || title;
      const createRes = await api.invoke('secureEntityWrite', {
        action: 'create',
        entity_type: 'Policy',
        organization_id: org.id,
        data: {
          organization_id: org.id,
          title: policyTitle,
          description: '',
          draft_content: fullText,
          status: 'draft',
          current_version: 0,
          handbook_category: 'Other',
          acknowledgment_required: true,
          applies_to: { all_employees: true },
        },
      });
      const newId = createRes.data?.record?.id;
      setGenerateStreaming(false);
      setGeneratingTitle(null);
      setGeneratedContent('');
      if (newId) {
        setScanOpen(false);
        loadPolicies();
        navigate(createPageUrl(`PolicyEditor?id=${newId}`));
      }
    } catch (e) {
      setGenerateError(e?.data?.error || e?.message || 'Generation failed');
      setGenerateStreaming(false);
      setGeneratingTitle(null);
    }
  }

  async function handleExtractHandbook() {
    if (!importText.trim()) return;
    setImportError(null);
    setExtractedPolicies([]);
    setImportExtracting(true);
    try {
      const policies = await api.extractHandbook(importText.trim());
      setExtractedPolicies(policies);
    } catch (e) {
      setImportError(e?.message || 'Extraction failed');
    } finally {
      setImportExtracting(false);
    }
  }

  async function handleCreateExtractedDrafts() {
    if (extractedPolicies.length === 0) return;
    setImportCreating(true);
    setImportError(null);
    try {
      for (const p of extractedPolicies) {
        await api.invoke('secureEntityWrite', {
          action: 'create',
          entity_type: 'Policy',
          organization_id: org.id,
          data: {
            organization_id: org.id,
            title: p.title || 'Untitled',
            description: '',
            draft_content: p.content || '',
            status: 'draft',
            current_version: 0,
            handbook_category: 'Other',
            acknowledgment_required: true,
            applies_to: { all_employees: true },
          },
        });
      }
      setImportOpen(false);
      setImportText('');
      setExtractedPolicies([]);
      loadPolicies();
    } catch (e) {
      setImportError(e?.message || 'Create failed');
    } finally {
      setImportCreating(false);
    }
  }

  async function handleGeneratePolicy() {
    if (!generatePrompt.trim()) return;
    setGenerateError(null);
    setGeneratedContent('');
    setGenerateStreaming(true);
    try {
      let fullText = '';
      await api.streamGeneratePolicy(
        { prompt: generatePrompt.trim(), orgName: org?.name, industry: org?.industry, state: org?.state },
        (chunk) => {
          fullText += chunk;
          setGeneratedContent(fullText);
        }
      );
      if (!fullText.trim()) {
        setGenerateError('No content was generated. Try a more specific prompt or check that ANTHROPIC_API_KEY is set.');
        setGenerateStreaming(false);
        return;
      }
      const title = fullText.split('\n')[0]?.replace(/^#+\s*/, '').trim().slice(0, 200) || 'Generated Policy';
      const createRes = await api.invoke('secureEntityWrite', {
        action: 'create',
        entity_type: 'Policy',
        organization_id: org.id,
        data: {
          organization_id: org.id,
          title,
          description: '',
          draft_content: fullText,
          status: 'draft',
          current_version: 0,
          handbook_category: 'Other',
          acknowledgment_required: true,
          applies_to: { all_employees: true },
        },
      });
      const newId = createRes.data?.record?.id;
      setGenerateOpen(false);
      setGeneratePrompt('');
      setGeneratedContent('');
      setGenerateStreaming(false);
      if (newId) {
        loadPolicies();
        navigate(createPageUrl(`PolicyEditor?id=${newId}`));
      }
    } catch (e) {
      setGenerateError(e?.data?.error || e?.message || 'Generation failed');
      setGenerateStreaming(false);
    }
  }

  // Read URL params for filtering
  const params = new URLSearchParams(window.location.search);
  const urlStatus = params.get('status');
  const urlView = params.get('view');

  useEffect(() => {
    if (!org) return;
    // Apply URL filters on load
    if (urlStatus) setStatusFilter(urlStatus);
    loadPolicies();
  }, [org]);

  async function loadPolicies() {
    setLoadError(null);
    try {
      const [pRes, aRes] = await Promise.all([
        api.invoke('getPoliciesForEmployee', { organization_id: org.id }),
        api.invoke('getMyAcknowledgments', { organization_id: org.id })
      ]);
      setPolicies(pRes.data?.policies || []);
      setAcks(aRes.data?.acknowledgments || []);
      setPendingReAcks(aRes.data?.pending_re_acknowledgments || []);
    } catch (e) {
      console.error(e);
      setLoadError(e.data?.error || e.message || 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }

  async function handleArchivePolicy(policyId, policyTitle, currentVersion) {
    const policy = policies.find(p => p.id === policyId);
    if (policy?.status === 'archived') return;

    if (!confirm(`Archive "${policyTitle}"? The policy will be removed from the active handbook but all version history and acknowledgment records will be preserved.`)) return;

    try {
      const result = await api.invoke('managePolicyLifecycle', {
        policy_id: policyId,
        organization_id: org.id,
        new_status: 'archived'
      });

      if (!result?.data?.success) {
        throw new Error(result?.data?.error || 'Archive failed');
      }

      setPolicies(policies.map(p => p.id === policyId ? { ...p, status: 'archived' } : p));
    } catch (err) {
      alert('Failed to archive policy. Please try again.');
      console.error('Archive failed:', err);
    }
  }

  const ackedPolicyIds = new Set(acks.map(a => a.policy_id));
  const pendingReAckPolicyIds = new Set(pendingReAcks.map(r => r.policy_id));

  const filtered = policies.filter(p => {
    // Search filter
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    // Status filter (admin only)
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    // Pending view: only unacknowledged policies
    if (urlView === 'pending' && (ackedPolicyIds.has(p.id) || !p.acknowledgment_required)) return false;
    // Server already filtered for employee applicability - no client-side check needed
    return true;
  });

  // Policy filtering moved to server-side for security

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading policies...</div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Could not load policies</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => loadPolicies()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Policies"
        description={isAdmin ? "Manage and distribute company policies" : "View and acknowledge policies assigned to you"}
        actions={isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setGenerateOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" /> Generate with AI
            </Button>
            <Button variant="outline" onClick={openScanDialog}>
              <FileText className="w-4 h-4 mr-2" /> Scan for missing
            </Button>
            <Button variant="outline" onClick={() => { setImportOpen(true); setImportError(null); setExtractedPolicies([]); setImportText(''); }}>
              <FileText className="w-4 h-4 mr-2" /> Import from handbook
            </Button>
            <Link to={createPageUrl('PolicyEditor')}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" /> New Policy
              </Button>
            </Link>
          </div>
        )}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search policies..."
            className="pl-9"
          />
        </div>
        {isAdmin && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" /> Generate policy with AI
            </DialogTitle>
            <DialogDescription>
              Describe the policy you want. A draft will be created and opened in the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>What should this policy cover?</Label>
            <Textarea
              value={generatePrompt}
              onChange={e => setGeneratePrompt(e.target.value)}
              placeholder="e.g. Cell phone use during work hours for front-of-house staff"
              rows={4}
              disabled={generateStreaming}
            />
          </div>
          {generateStreaming && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 max-h-40 overflow-y-auto">
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Generating…
              </div>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{generatedContent || '…'}</pre>
            </div>
          )}
          {generateError && (
            <p className="text-sm text-red-600">{generateError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGenerateOpen(false); setGenerateError(null); }} disabled={generateStreaming}>Cancel</Button>
            <Button onClick={handleGeneratePolicy} disabled={generateStreaming || !generatePrompt.trim()}>
              {generateStreaming ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
              ) : (
                <>Generate draft</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan for missing policies</DialogTitle>
            <DialogDescription>
              Based on your current policies and org state/industry, these are often missing. Pick one to generate a draft.
            </DialogDescription>
          </DialogHeader>
          {scanLoading && (
            <div className="flex items-center gap-2 py-4 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Scanning…
            </div>
          )}
          {scanError && <p className="text-sm text-red-600">{scanError}</p>}
          {!scanLoading && suggestedTitles.length > 0 && (
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {suggestedTitles.map(t => (
                <li key={t} className="flex items-center justify-between gap-2 rounded border border-slate-200 p-2">
                  <span className="text-sm truncate">{t}</span>
                  <Button
                    size="sm"
                    disabled={!!generatingTitle}
                    onClick={() => generateFromSuggestedTitle(t)}
                  >
                    {generatingTitle === t ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {!scanLoading && !scanError && suggestedTitles.length === 0 && (
            <p className="text-sm text-slate-500">No suggestions. Add ANTHROPIC_API_KEY or try again later.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import from handbook</DialogTitle>
            <DialogDescription>
              Paste your handbook text below. We’ll extract policies and create drafts.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Paste full handbook text…"
            value={importText}
            onChange={e => setImportText(e.target.value)}
            rows={6}
            className="resize-none"
            disabled={importExtracting || importCreating}
          />
          {extractedPolicies.length === 0 ? (
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button onClick={handleExtractHandbook} disabled={importExtracting || !importText.trim()}>
                {importExtracting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Extract policies
              </Button>
            </DialogFooter>
          ) : (
            <>
              <p className="text-sm font-medium">Extracted ({extractedPolicies.length}) — create all as drafts?</p>
              <ul className="flex-1 overflow-y-auto border rounded-lg p-2 space-y-1 max-h-40">
                {extractedPolicies.map((p, i) => (
                  <li key={i} className="text-xs truncate text-slate-600">{p.title}</li>
                ))}
              </ul>
              {importError && <p className="text-sm text-red-600">{importError}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setExtractedPolicies([]); setImportText(''); }}>Back</Button>
                <Button onClick={handleCreateExtractedDrafts} disabled={importCreating}>
                  {importCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create all drafts
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No policies found"
          description={isAdmin ? "Create your first policy to get started" : "No policies are currently assigned to you"}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(policy => {
            const acked = ackedPolicyIds.has(policy.id);
            return (
              <Card key={policy.id} className="p-5 hover:shadow-md transition-all border-slate-200/60 group">
                <div className="flex items-start justify-between gap-4">
                  <Link 
                    to={createPageUrl(isAdmin ? `PolicyEditor?id=${policy.id}` : `PolicyView?id=${policy.id}`)}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                        {policy.title}
                      </h3>
                      <StatusBadge status={policy.status} />
                      {policy.acknowledgment_required && !isAdmin && (() => {
                        const needsReAck = pendingReAckPolicyIds.has(policy.id);
                        if (needsReAck) return (
                          <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-xs">
                            <Clock className="w-3 h-3 mr-1" /> Re-acknowledgment Required
                          </Badge>
                        );
                        if (acked) return (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Acknowledged
                          </Badge>
                        );
                        return (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">
                            <Clock className="w-3 h-3 mr-1" /> Pending
                          </Badge>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{policy.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>v{policy.current_version || 1}</span>
                      <span>·</span>
                      <span>{format(new Date(policy.created_date), 'MMM d, yyyy')}</span>
                      {policy.tags?.length > 0 && (
                        <>
                          <span>·</span>
                          <div className="flex gap-1">
                            {policy.tags.slice(0, 3).map(t => (
                              <span key={t} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{t}</span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Link to={createPageUrl(isAdmin ? `PolicyEditor?id=${policy.id}` : `PolicyView?id=${policy.id}`)}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                      </Button>
                    </Link>
                    {isAdmin && policy.status !== 'archived' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Archive Policy"
                        onClick={(e) => {
                          e.preventDefault();
                          handleArchivePolicy(policy.id, policy.title, policy.current_version || 0);
                        }}
                      >
                        <Archive className="w-4 h-4 text-slate-400 hover:text-amber-600" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}