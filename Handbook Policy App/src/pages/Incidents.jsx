import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { usePermissions } from '../components/hooks/usePermissions';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import { ShieldAlert, Plus, Search, Eye, FileText } from 'lucide-react';
import AttachmentUpload from '../components/shared/AttachmentUpload';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';

export default function Incidents() {
  const { org, employee } = useOrg();
  const { isAdmin } = usePermissions();
  const [incidents, setIncidents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [amendments, setAmendments] = useState([]);
  const [form, setForm] = useState({
    incident_type: 'workplace_complaint', title: '', description: '',
    incident_date: '', incident_time: '', location_id: '', witnesses: '', severity: 'medium', attachments: []
  });

  // Read URL params for filtering
  const params = new URLSearchParams(window.location.search);
  const urlStatus = params.get('status');

  useEffect(() => {
    if (!org) return;
    // Apply URL filter: "open" means submitted or under_review
    if (urlStatus === 'open') setStatusFilter('submitted');
    loadData();
  }, [org]);

  async function loadData() {
    setLoadError(null);
    try {
      const [incResult, locResult] = await Promise.all([
        api.invoke('getIncidentReports', { organization_id: org.id }),
        api.invoke('getLocations', { organization_id: org.id })
      ]);
      setIncidents(incResult.data.reports || incResult.data.incidents || []);
      setLocations(locResult.data || []);
      setAmendments(incResult.data.amendments_incident || []);
    } catch (e) {
      setLoadError(e.data?.error || e.message || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }

  async function submitIncident() {
    setSaving(true);
    const loc = locations.find(l => l.id === form.location_id);
    await api.invoke('secureIncidentWrite', {
      action: 'create',
      organization_id: org.id,
      form,
      location_name: loc?.name || ''
    });
    setShowAdd(false);
    setSaving(false);
    setForm({ incident_type: 'workplace_complaint', title: '', description: '', incident_date: '', incident_time: '', location_id: '', witnesses: '', severity: 'medium', attachments: [] });
    loadData();
  }

  async function updateStatus(incident, newStatus) {
    try {
      const result = await api.invoke('manageHRRecordLifecycle', {
        record_id: incident.id,
        organization_id: org.id,
        new_status: newStatus,
        record_type: 'IncidentReport'
      });

      if (!result?.data?.success) {
        throw new Error(result?.data?.error || 'Status change failed');
      }

      loadData();
      setShowDetail(null);
    } catch (error) {
      console.error('Status change failed:', error);
      alert(`Failed to update status: ${error.message}`);
    }
  }

  async function saveAdminNotes(incident, notes) {
    await api.invoke('secureIncidentWrite', {
      action: 'update_notes',
      organization_id: org.id,
      incident_id: incident.id,
      field: 'admin_notes',
      old_value: incident.admin_notes || '',
      new_value: notes
    });
    loadData();
  }

  const filtered = incidents.filter(i => {
    if (search && !i.title?.toLowerCase().includes(search.toLowerCase())) return false;
    // Open status = submitted OR under_review
    if (statusFilter === 'submitted' && i.status !== 'submitted' && i.status !== 'under_review') return false;
    else if (statusFilter !== 'all' && statusFilter !== 'submitted' && i.status !== statusFilter) return false;
    return true;
  });

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading incidents...</div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Could not load incidents</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
          <Button type="button" variant="destructive" className="mt-3" onClick={() => loadData()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Incident Reports"
        description={isAdmin ? "Review and manage all incident reports" : "Submit and track your incident reports"}
        actions={
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-2" /> Report Incident
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search incidents..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No incidents reported" description="Incident reports will appear here" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {isAdmin && <TableHead>Submitted By</TableHead>}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inc => (
                <TableRow key={inc.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setShowDetail(inc)}>
                  <TableCell className="font-medium text-sm">{inc.title}</TableCell>
                  <TableCell><StatusBadge status={inc.incident_type} /></TableCell>
                  <TableCell><StatusBadge status={inc.severity} /></TableCell>
                  <TableCell><StatusBadge status={inc.status} /></TableCell>
                  <TableCell className="text-xs text-slate-500">{inc.incident_date ? format(new Date(inc.incident_date), 'MMM d, yyyy') : format(new Date(inc.created_date), 'MMM d, yyyy')}</TableCell>
                  {isAdmin && <TableCell className="text-xs text-slate-600">{inc.submitted_by_name}</TableCell>}
                  <TableCell><Eye className="w-4 h-4 text-slate-400" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Submit Incident Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Report an Incident</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">File a new incident report</p>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Incident Type</Label>
                <Select value={form.incident_type} onValueChange={v => setForm({ ...form, incident_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workplace_complaint">Workplace Complaint</SelectItem>
                    <SelectItem value="altercation">Altercation</SelectItem>
                    <SelectItem value="safety_incident">Safety Incident</SelectItem>
                    <SelectItem value="guest_injury">Guest Injury</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Brief incident title" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Incident Date</Label>
                <Input type="date" value={form.incident_date} onChange={e => setForm({ ...form, incident_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={form.location_id} onValueChange={v => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={5} placeholder="Detailed description of what happened..." />
            </div>
            <div className="space-y-2">
              <Label>Witnesses (optional)</Label>
              <Input value={form.witnesses} onChange={e => setForm({ ...form, witnesses: e.target.value })} placeholder="Names of witnesses" />
            </div>
            <div className="space-y-2">
              <Label>Attachments</Label>
              <AttachmentUpload
                attachments={form.attachments}
                onAttachmentsChange={atts => setForm({ ...form, attachments: atts })}
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={submitIncident} disabled={saving || !form.title || !form.description}>
              {saving ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <IncidentDetailDialog incident={showDetail} isAdmin={isAdmin} org={org} amendments={amendments} onClose={() => { setShowDetail(null); setEditingField(null); }} onStatusChange={updateStatus} onSaveNotes={saveAdminNotes} onReload={loadData} editingField={editingField} setEditingField={setEditingField} />
    </div>
  );
}

function IncidentDetailDialog({ incident, isAdmin, org, amendments, onClose, onStatusChange, onSaveNotes, onReload, editingField, setEditingField }) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (incident) setNotes(incident.admin_notes || '');
  }, [incident]);

  if (!incident) return null;

  return (
    <Dialog open={!!incident} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{incident.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={incident.incident_type} />
            <StatusBadge status={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-blue-900">Original Submission</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-blue-600">Submitted By:</span> <span className="font-medium text-blue-900">{incident.submitted_by_name}</span></div>
              <div><span className="text-blue-600">Date:</span> <span className="font-medium text-blue-900">{incident.incident_date || 'N/A'}</span></div>
              <div><span className="text-blue-600">Location:</span> <span className="font-medium text-blue-900">{incident.location_name || 'N/A'}</span></div>
              {incident.witnesses && <div><span className="text-blue-600">Witnesses:</span> <span className="font-medium text-blue-900">{incident.witnesses}</span></div>}
            </div>
            <div className="mt-3 bg-white rounded p-3 text-xs text-slate-700 whitespace-pre-wrap">
              {incident.description}
            </div>
          </div>

          {incident.attachments?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-600 font-medium">Attachments ({incident.attachments.length})</p>
              <div className="space-y-1">
                {incident.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 transition"
                  >
                    <FileText className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                    <span className="text-xs text-slate-700 truncate">{att.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <>
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-slate-600 font-medium">Admin Follow-Up Notes</Label>
                  <button onClick={() => setEditingField(editingField === 'admin_notes' ? null : 'admin_notes')} className="text-xs text-indigo-600 hover:text-indigo-700">
                    {editingField === 'admin_notes' ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                {editingField === 'admin_notes' ? (
                  <IncidentEditField incident={incident} field="admin_notes" org={org} onSave={() => { onReload(); setEditingField(null); }} />
                ) : (
                  <>
                    {notes ? (
                      <div className="bg-amber-50 rounded-lg p-3 text-xs text-slate-700 whitespace-pre-wrap border border-amber-200">
                        {notes}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No follow-up notes yet</p>
                    )}
                  </>
                )}
              </div>

              <IncidentAmendmentLog incidentId={incident.id} amendments={amendments.filter(a => a.record_id === incident.id)} />

              <div className="flex gap-2 flex-wrap pt-2">
                {incident.status !== 'under_review' && (
                  <Button variant="outline" size="sm" onClick={() => onStatusChange(incident, 'under_review')}>Mark Under Review</Button>
                )}
                {incident.status !== 'resolved' && (
                  <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200" onClick={() => onStatusChange(incident, 'resolved')}>Resolve</Button>
                )}
                {incident.status !== 'dismissed' && (
                  <Button variant="outline" size="sm" className="text-slate-500" onClick={() => onStatusChange(incident, 'dismissed')}>Dismiss</Button>
                )}
              </div>

              <div className="border-t pt-4 space-y-2">
                <Label className="text-xs uppercase tracking-wide text-slate-600">Add More Attachments</Label>
                <AttachmentUpload
                  attachments={incident.attachments || []}
                  onAttachmentsChange={async (atts) => {
                    await api.invoke('secureIncidentWrite', {
                      action: 'update_attachments',
                      organization_id: org.id,
                      incident_id: incident.id,
                      attachments: atts
                    });
                    onReload();
                  }}
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IncidentEditField({ incident, field, org, onSave }) {
  const [value, setValue] = React.useState(incident[field] || '');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    await api.invoke('secureIncidentWrite', {
      action: 'update_notes',
      organization_id: org.id,
      incident_id: incident.id,
      field,
      old_value: incident[field] || '',
      new_value: value,
      amendment_note: note
    });
    setSaving(false);
    onSave();
  }

  return (
    <div className="space-y-3">
      <Textarea value={value} onChange={e => setValue(e.target.value)} rows={4} />
      <div>
        <label className="text-xs text-slate-600 mb-1 block">Reason for amendment (optional)</label>
        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Why was this changed?" className="text-xs" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setValue(incident[field] || '')}>Reset</Button>
        <Button className="bg-indigo-600 hover:bg-indigo-700" size="sm" onClick={handleSave} disabled={saving || value === incident[field]}>
          {saving ? 'Saving...' : 'Save Amendment'}
        </Button>
      </div>
    </div>
  );
}

function IncidentAmendmentLog({ incidentId, amendments }) {
  const incidentAmendments = amendments.filter(a => a.record_id === incidentId);

  if (incidentAmendments.length === 0) return null;

  return (
    <div className="border-t pt-4 space-y-3">
      <p className="text-xs uppercase tracking-wide text-slate-600 font-medium">Amendment Log</p>
      <div className="space-y-2">
        {incidentAmendments.map(amend => (
          <div key={amend.id} className="border border-slate-200 rounded-lg p-3 text-xs space-y-2 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">{amend.field_changed}</span>
              <span className="text-slate-500">{format(new Date(amend.created_date), 'MMM d, h:mm a')}</span>
            </div>
            <div className="text-slate-600">By: {amend.amended_by_name}</div>
            {amend.old_value && (
              <div className="bg-red-50 border border-red-100 p-2 rounded text-red-700">
                <span className="font-medium">Was:</span> {amend.old_value}
              </div>
            )}
            <div className="bg-green-50 border border-green-100 p-2 rounded text-green-700">
              <span className="font-medium">Now:</span> {amend.new_value}
            </div>
            {amend.amendment_note && (
              <div className="text-slate-700 italic">"{amend.amendment_note}"</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}