import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { useOrg } from '../hooks/useOrganization';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sparkles, X } from 'lucide-react';

export default function WriteUpDialog({ employee, onClose, onSaved }) {
  const { user } = useAuth();
  const { org } = useOrg();
  const [mode, setMode] = useState('quick');
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    discipline_level: 'coaching_verbal',
    zero_tolerance_flag: false,
    signature_required: true,
    related_policy_ids: [],
    witnesses: '',
    follow_up_notes: ''
  });

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    const res = await api.invoke('getPoliciesForEmployee', { organization_id: org.id });
    const p = (res.data?.policies || []).filter(x => x.status === 'active');
    setPolicies(p);
  }

  async function getAISuggestions() {
    if (!form.title || !form.description) return;
    setLoadingAI(true);
    try {
      const result = await api.assistWriteUp({
        title: form.title,
        description: form.description,
        employee_role: employee.role || 'Not specified',
        policy_titles: policies.map((p) => p.title),
      });
      setAiSuggestions(result);
    } catch (e) {
      setAiSuggestions({ error: 'Failed to generate suggestions.' });
    } finally {
      setLoadingAI(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const result = await api.invoke('secureEntityWrite', {
      action: 'create',
      entity_type: 'HRRecord',
      organization_id: org.id,
      data: {
        organization_id: org.id,
        employee_id: employee.id,
        employee_name: employee.full_name,
        record_type: 'write_up',
        title: form.title,
        description: form.description,
        discipline_level: form.discipline_level,
        zero_tolerance_flag: form.zero_tolerance_flag,
        signature_required: form.signature_required,
        related_policy_ids: form.related_policy_ids,
        witnesses: form.witnesses,
        follow_up_notes: form.follow_up_notes,
        recorded_by_email: user.email,
        recorded_by_name: user.full_name
      }
    });

    if (!result?.data?.success) {
      alert(result?.data?.error || 'Failed to create write-up');
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  }

  const disciplineLevels = [
    { value: 'coaching_verbal', label: 'Coaching / Verbal' },
    { value: 'written_warning', label: 'Written Warning' },
    { value: 'final_warning', label: 'Final Warning' },
    { value: 'termination_review', label: 'Termination Review' }
  ];

  const togglePolicy = (policyId) => {
    if (form.related_policy_ids.includes(policyId)) {
      setForm({ ...form, related_policy_ids: form.related_policy_ids.filter(id => id !== policyId) });
    } else {
      setForm({ ...form, related_policy_ids: [...form.related_policy_ids, policyId] });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Write-Up — {employee.full_name}</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={setMode} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">Quick Entry</TabsTrigger>
            <TabsTrigger value="formal">Formal HR Documentation</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Late Arrival - Shift No-Show"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the issue..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Discipline Level</Label>
              <Select value={form.discipline_level} onValueChange={v => setForm({ ...form, discipline_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {disciplineLevels.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Signature Required</Label>
                <p className="text-xs text-slate-500">Employee must acknowledge receipt</p>
              </div>
              <Switch
                checked={form.signature_required}
                onCheckedChange={v => setForm({ ...form, signature_required: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Zero Tolerance Flag</Label>
                <p className="text-xs text-slate-500">Mark as zero tolerance incident</p>
              </div>
              <Switch
                checked={form.zero_tolerance_flag}
                onCheckedChange={v => setForm({ ...form, zero_tolerance_flag: v })}
              />
            </div>

            {policies.length > 0 && (
              <div className="space-y-2">
                <Label>Related Policy (Optional)</Label>
                <Select
                  value={form.related_policy_ids[0] || ''}
                  onValueChange={v => setForm({ ...form, related_policy_ids: v ? [v] : [] })}
                >
                  <SelectTrigger><SelectValue placeholder="Select a policy" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {policies.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          <TabsContent value="formal" className="space-y-4">
            <div className="space-y-2">
              <Label>Incident Summary</Label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Brief summary of the incident"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Detailed Description</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAIAssist(!showAIAssist);
                    if (!showAIAssist && !aiSuggestions) getAISuggestions();
                  }}
                  disabled={!form.title || !form.description}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Assist
                </Button>
              </div>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Provide a detailed account of what occurred..."
                rows={5}
              />
            </div>

            {showAIAssist && (
              <Card className="border-indigo-200 bg-indigo-50/30">
                <CardContent className="p-4">
                  {loadingAI ? (
                    <div className="flex items-center gap-2 text-sm text-indigo-700">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      Analyzing...
                    </div>
                  ) : aiSuggestions?.error ? (
                    <p className="text-sm text-red-600">{aiSuggestions.error}</p>
                  ) : aiSuggestions ? (
                    <div className="space-y-3">
                      <p className="text-xs text-indigo-700">{aiSuggestions.rationale}</p>
                      {aiSuggestions.wording_suggestion && (
                        <div>
                          <p className="text-xs text-indigo-600 mb-1">Suggested Wording:</p>
                          <p className="text-xs text-indigo-800 bg-white rounded p-2">{aiSuggestions.wording_suggestion}</p>
                        </div>
                      )}
                      {aiSuggestions.discipline_level_suggestion && (
                        <div>
                          <p className="text-xs text-indigo-600 mb-1">Suggested Level:</p>
                          <Badge variant="outline" className="text-xs">{aiSuggestions.discipline_level_suggestion.replace('_', ' ')}</Badge>
                        </div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>Witnesses (Optional)</Label>
              <Input
                value={form.witnesses}
                onChange={e => setForm({ ...form, witnesses: e.target.value })}
                placeholder="Names or descriptions of witnesses"
              />
            </div>

            <div className="space-y-2">
              <Label>Related Policies (Optional)</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.related_policy_ids.map(id => {
                  const policy = policies.find(p => p.id === id);
                  return policy ? (
                    <Badge key={id} variant="outline" className="gap-1 pr-1">
                      {policy.title}
                      <button onClick={() => togglePolicy(id)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
              <Select value="" onValueChange={togglePolicy}>
                <SelectTrigger><SelectValue placeholder="Add policy" /></SelectTrigger>
                <SelectContent>
                  {policies.filter(p => !form.related_policy_ids.includes(p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Discipline Level</Label>
              <Select value={form.discipline_level} onValueChange={v => setForm({ ...form, discipline_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {disciplineLevels.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Zero Tolerance Incident</Label>
                <p className="text-xs text-slate-500">Mark if applicable</p>
              </div>
              <Switch
                checked={form.zero_tolerance_flag}
                onCheckedChange={v => setForm({ ...form, zero_tolerance_flag: v })}
              />
            </div>

            <div className="space-y-2">
              <Label>Follow-Up Notes (Optional)</Label>
              <Textarea
                value={form.follow_up_notes}
                onChange={e => setForm({ ...form, follow_up_notes: e.target.value })}
                placeholder="Additional notes or planned follow-up actions..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Employee Acknowledgment Required</Label>
                <p className="text-xs text-slate-500">Employee will be notified</p>
              </div>
              <Switch
                checked={form.signature_required}
                onCheckedChange={v => setForm({ ...form, signature_required: v })}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={handleSave}
            disabled={saving || !form.title || !form.description}
          >
            {saving ? 'Creating...' : 'Create Write-Up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}