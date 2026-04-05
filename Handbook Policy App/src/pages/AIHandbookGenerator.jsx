import React, { useState, useEffect } from 'react';
import { useOrg } from '../components/hooks/useOrganization';
import { api } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from '../components/shared/PageHeader';
import { Sparkles, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import { createPageUrl } from '../utils';
import { useNavigate } from 'react-router-dom';

const INDUSTRY_OPTIONS = [
  { value: 'restaurant', label: 'Restaurant / Food Service' },
  { value: 'retail', label: 'Retail' },
  { value: 'salon', label: 'Salon / Spa' },
  { value: 'office', label: 'Office / Professional' },
  { value: 'other', label: 'Other' },
];

export default function AIHandbookGenerator() {
  const { org, employee } = useOrg();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = name/industry/state, 2 = pick policies, 3 = generating, 4 = done
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [state, setState] = useState('');
  const [recommendedTitles, setRecommendedTitles] = useState([]);
  const [selectedTitles, setSelectedTitles] = useState(new Set());
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  const isAdmin = employee?.permission_level === 'org_admin';

  useEffect(() => {
    if (org) {
      if (!name) setName(org.name || '');
      if (!industry) setIndustry(org.industry || '');
      if (!state) setState(org.state || '');
    }
  }, [org]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Access restricted to admins.</p>
      </div>
    );
  }

  const toggleTitle = (title) => {
    setSelectedTitles(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedTitles.size === recommendedTitles.length) setSelectedTitles(new Set());
    else setSelectedTitles(new Set(recommendedTitles));
  };

  async function fetchRecommendations() {
    if (!name.trim() || !industry || !state?.trim()) {
      setError('Business name, industry, and state are required.');
      return;
    }
    setError(null);
    setRecommendLoading(true);
    try {
      const titles = await api.handbookRecommend({ name: name.trim(), industry, state: state.trim() });
      setRecommendedTitles(titles);
      setSelectedTitles(new Set(titles));
      setStep(2);
    } catch (e) {
      setError(e?.message || 'Could not load recommendations. Check ANTHROPIC_API_KEY.');
    } finally {
      setRecommendLoading(false);
    }
  }

  async function generateSelected() {
    const list = Array.from(selectedTitles);
    if (list.length === 0) {
      setError('Select at least one policy.');
      return;
    }
    setError(null);
    setStep(3);
    try {
      const ids = await api.handbookGenerateSelected(list);
      setCreatedCount(ids.length);
      setStep(4);
    } catch (e) {
      setError(e?.message || 'Generation failed.');
      setStep(2);
    }
  }

  if (step === 3) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <Loader2 className="w-10 h-10 text-noble animate-spin" />
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800">Generating policies…</p>
          <p className="text-sm text-slate-500 mt-1">Creating draft policies. This may take a minute.</p>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <div>
          <p className="text-xl font-bold text-slate-800">Draft policies created</p>
          <p className="text-sm text-slate-500 mt-2">{createdCount} policy draft(s) were added. Review and publish from the Policies page.</p>
        </div>
        <Button className="mt-2" onClick={() => navigate(createPageUrl('Policies'))}>
          View Policies
        </Button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="pb-24">
        <PageHeader
          title="AI Easy Handbook Generator"
          description="Select which policies to generate as drafts."
        />
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-noble" />
              Recommended policies
            </CardTitle>
            <CardDescription>
              All drafts will be created in draft status. You can edit and publish each one from the Policies page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedTitles.size === recommendedTitles.length ? 'Deselect all' : 'Select all'}
              </Button>
              <span className="text-sm text-slate-500">{selectedTitles.size} of {recommendedTitles.length} selected</span>
            </div>
            <ul className="space-y-2 max-h-80 overflow-y-auto border rounded-lg p-3">
              {recommendedTitles.map(t => (
                <li key={t} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedTitles.has(t)}
                    onChange={() => toggleTitle(t)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm">{t}</span>
                </li>
              ))}
            </ul>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={generateSelected} disabled={selectedTitles.size === 0} className="bg-noble hover:bg-noble-dark">
                <Sparkles className="w-4 h-4 mr-2" /> Generate selected ({selectedTitles.size})
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader
        title="AI Easy Handbook Generator"
        description="Enter your business details and we'll recommend policies to generate as drafts."
      />
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-noble" />
            Step 1 — Tell us about your business
          </CardTitle>
          <CardDescription>
            We use name, industry, and state to recommend policy titles. State is required for compliance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>Business name <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g., Joe's Grill"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Industry <span className="text-red-500">*</span></Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>State <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. MA, NY, CA"
              value={state}
              onChange={e => setState(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
          )}
          <Button
            onClick={fetchRecommendations}
            disabled={recommendLoading || !name.trim() || !industry || !state?.trim()}
            className="w-full gap-2 bg-noble hover:bg-noble-dark"
          >
            {recommendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            Get recommended policies
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

