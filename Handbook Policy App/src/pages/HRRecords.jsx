import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { useOrg } from '../components/hooks/useOrganization';
import { usePermissions } from '../components/hooks/usePermissions';
import { createPageUrl } from '../utils';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import { FolderLock, Plus, Search, FileText, Eye, EyeOff } from 'lucide-react';
import HRRecordAmendmentLog from '../components/shared/HRRecordAmendmentLog';
import HRRecordEditField from '../components/shared/HRRecordEditField';
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

export default function HRRecords() {
  const { user } = useAuth();
  const { org, employee } = useOrg();
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [amendments, setAmendments] = useState([]);
  const [form, setForm] = useState({
    employee_id: '', record_type: 'write_up', title: '', description: '', severity: 'medium', discipline_level: '', attachments: [],
    visible_to_employee: true
  });

  const { isAdmin, isOrgAdmin } = usePermissions();

  function openNew() {
    setForm({ employee_id: '', record_type: 'write_up', title: '', description: '', severity: 'medium', attachments: [], visible_to_employee: true });
    setShowAdd(true);
  }

  useEffect(() => {
    if (!org) return;
    if (!isAdmin) {
      // Redirect non-admins
      window.location.href = createPageUrl('Dashboard');
      return;
    }
    loadData();
  }, [org, isAdmin]);

  async function loadData() {
    setLoadError(null);
    try {
      const [hrResult, ctxResult] = await Promise.all([
        api.invoke('getHRRecords', { organization_id: org.id }),
        api.invoke('getAdminContext', { organization_id: org.id, include: ['amendments_hr'] })
      ]);
      setRecords(hrResult.data.records || []);
      setEmployees(ctxResult.data.employees || []);
      setAmendments(ctxResult.data.amendments_hr || []);
    } catch (e) {
      setLoadError(e.data?.error || e.message || 'Failed to load HR records');
    } finally {
      setLoading(false);
    }
  }

  async function saveRecord() {
    setSaving(true);
    try {
      const emp = employees.find(e => e.id === form.employee_id);
      
      // HARDENED: Route through secureEntityWrite for validation
      const result = await api.invoke('secureEntityWrite', {
        action: 'create',
        entity_type: 'HRRecord',
        organization_id: org.id,
        data: {
          ...form,
          organization_id: org.id,
          employee_name: emp?.full_name || '',
          recorded_by_email: user?.email || employee?.user_email,
          recorded_by_name: user?.full_name || employee?.full_name,
          visible_to_employee: form.record_type === 'commendation' ? form.visible_to_employee !== false : undefined
        }
      });

      if (!result?.data?.success) {
        throw new Error(result?.data?.error || 'Validation failed');
      }

      setShowAdd(false);
      setForm({ employee_id: '', record_type: 'write_up', title: '', description: '', severity: 'medium', discipline_level: '', attachments: [], visible_to_employee: true });
      loadData();
    } catch (error) {
      console.error('Save failed:', error);
      alert(`Failed to create record: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(record, newStatus) {
    try {
      const result = await api.invoke('manageHRRecordLifecycle', {
        record_id: record.id,
        organization_id: org.id,
        new_status: newStatus,
        record_type: 'HRRecord'
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

  const filtered = records.filter(r => {
    if (search && !r.title?.toLowerCase().includes(search.toLowerCase()) && !r.employee_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all' && r.record_type !== typeFilter) return false;
    if (employeeFilter !== 'all' && r.employee_id !== employeeFilter) return false;
    return true;
  });

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading records...</div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Could not load HR records</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
          <Button type="button" variant="destructive" className="mt-3" onClick={() => loadData()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="HR Records"
        description="Confidential employee records and documentation"
        actions={
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Record
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="write_up">Write-Ups</SelectItem>
            <SelectItem value="incident_report">Incidents</SelectItem>
            <SelectItem value="hr_note">HR Notes</SelectItem>
            <SelectItem value="termination">Termination</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
          </SelectContent>
        </Select>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FolderLock} title="No records found" description="HR records will appear here" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>By</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(rec => (
                <TableRow key={rec.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-sm">{rec.title}</TableCell>
                  <TableCell className="text-sm text-slate-600">{rec.employee_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={rec.record_type} />
                      {rec.record_type === 'commendation' && (rec.visible_to_employee === 0 || rec.visible_to_employee === false) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="Hidden from employee">
                          <EyeOff className="w-3 h-3" /> Hidden from employee
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={rec.severity} /></TableCell>
                  <TableCell className="text-xs text-slate-500">{format(new Date(rec.created_date), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="text-xs text-slate-500">{rec.recorded_by_name}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setShowDetail(rec)}>
                      <Eye className="w-4 h-4 text-slate-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Record Dialog - Append Only */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>New HR Record</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Create a new HR record</p>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-6">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={form.employee_id} onValueChange={v => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Record Type</Label>
                <Select value={form.record_type} onValueChange={v => setForm({ ...form, record_type: v, visible_to_employee: v === 'commendation' ? (form.visible_to_employee !== false) : true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="write_up">Write-Up</SelectItem>
                    <SelectItem value="internal_note">Internal Note (not shown to employee)</SelectItem>
                    <SelectItem value="verbal_warning">Verbal Warning</SelectItem>
                    <SelectItem value="written_warning">Written Warning</SelectItem>
                    <SelectItem value="final_warning">Final Warning</SelectItem>
                    <SelectItem value="immediate_termination">Immediate Termination</SelectItem>
                    <SelectItem value="commendation">Commendation</SelectItem>
                    <SelectItem value="hr_note">HR Note (legacy)</SelectItem>
                    <SelectItem value="document">Document (legacy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discipline Level</Label>
                <Select value={form.discipline_level || ''} onValueChange={v => setForm({ ...form, discipline_level: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coaching">Coaching</SelectItem>
                    <SelectItem value="verbal_warning">Verbal Warning</SelectItem>
                    <SelectItem value="written_warning">Written Warning</SelectItem>
                    <SelectItem value="final_warning">Final Warning</SelectItem>
                    <SelectItem value="termination_review">Termination Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            {form.record_type === 'commendation' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="visible_to_employee"
                  checked={form.visible_to_employee !== false}
                  onChange={e => setForm({ ...form, visible_to_employee: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <Label htmlFor="visible_to_employee" className="font-normal cursor-pointer">Visible to employee</Label>
              </div>
            )}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Record title" />
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={5} placeholder="Detailed description..." />
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
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={saveRecord} disabled={saving || !form.employee_id || !form.title}>
              {saving ? 'Saving...' : 'Create Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog - View & Amend */}
      <Dialog open={!!showDetail} onOpenChange={() => { setShowDetail(null); setEditingField(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showDetail?.title}</DialogTitle>
          </DialogHeader>
          {showDetail && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={showDetail.record_type} />
                <StatusBadge status={showDetail.severity} />
                {showDetail.record_type === 'commendation' && (
                  (showDetail.visible_to_employee === 0 || showDetail.visible_to_employee === false) ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800">
                      <EyeOff className="w-3.5 h-3.5" /> Hidden from employee
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-amber-700 hover:text-amber-900"
                        onClick={async () => {
                          try {
                            await api.invoke('secureEntityWrite', {
                              action: 'amend',
                              entity_type: 'HRRecord',
                              entity_id: showDetail.id,
                              organization_id: org.id,
                              field_changed: 'visible_to_employee',
                              new_value: 1,
                              amendment_note: 'Visibility toggled — now visible to employee'
                            });
                            loadData();
                            setShowDetail({ ...showDetail, visible_to_employee: 1 });
                          } catch (e) {
                            alert(e?.data?.error || e?.message || 'Failed to update');
                          }
                        }}
                      >
                        Show to employee
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-slate-600"
                      onClick={async () => {
                        try {
                          await api.invoke('secureEntityWrite', {
                            action: 'amend',
                            entity_type: 'HRRecord',
                            entity_id: showDetail.id,
                            organization_id: org.id,
                            field_changed: 'visible_to_employee',
                            new_value: 0,
                            amendment_note: 'Visibility toggled — hidden from employee'
                          });
                          loadData();
                          setShowDetail({ ...showDetail, visible_to_employee: 0 });
                        } catch (e) {
                          alert(e?.data?.error || e?.message || 'Failed to update');
                        }
                      }}
                    >
                      <EyeOff className="w-3.5 h-3.5 mr-1" /> Hide from employee
                    </Button>
                  )
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm border-b pb-4">
                <div><span className="text-slate-500">Employee:</span> <span className="font-medium">{showDetail.employee_name}</span></div>
                <div><span className="text-slate-500">Created:</span> <span className="font-medium">{format(new Date(showDetail.created_date), 'MMM d, yyyy h:mm a')}</span></div>
                <div><span className="text-slate-500">Recorded By:</span> <span className="font-medium">{showDetail.recorded_by_name}</span></div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-slate-600">Details</Label>
                  <button onClick={() => setEditingField(editingField === 'description' ? null : 'description')} className="text-xs text-indigo-600 hover:text-indigo-700">
                    {editingField === 'description' ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                {editingField === 'description' ? (
                  <HRRecordEditField record={showDetail} field="description" org={org} onSave={() => { loadData(); setEditingField(null); }} />
                ) : (
                  <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap border">
                    {showDetail.description || 'No details provided.'}
                  </div>
                )}
              </div>

              {showDetail.follow_up_notes && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-600 font-medium">Follow-up Notes</p>
                  <div className="bg-amber-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap border border-amber-200">
                    {showDetail.follow_up_notes}
                  </div>
                </div>
              )}

              {showDetail.attachments?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-600 font-medium">Attachments ({showDetail.attachments.length})</p>
                  <div className="space-y-1">
                    {showDetail.attachments.map((att, idx) => (
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

              <HRRecordAmendmentLog recordId={showDetail.id} amendments={amendments.filter(a => a.record_id === showDetail.id)} />

              {!showDetail.is_locked && (
                <div className="flex gap-2 flex-wrap pt-2 border-t">
                  {showDetail.status !== 'under_review' && (
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange(showDetail, 'under_review')}>Mark Under Review</Button>
                  )}
                  {showDetail.status !== 'resolved' && (
                    <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200" onClick={() => handleStatusChange(showDetail, 'resolved')}>Resolve & Lock</Button>
                  )}
                  {showDetail.status !== 'dismissed' && (
                    <Button variant="outline" size="sm" className="text-slate-500" onClick={() => handleStatusChange(showDetail, 'dismissed')}>Dismiss & Lock</Button>
                  )}
                </div>
              )}

               <div className="space-y-2 pt-2">
                 <Label className="text-xs uppercase tracking-wide text-slate-600">Add More Attachments</Label>
                <AttachmentUpload
                  attachments={showDetail.attachments || []}
                  onAttachmentsChange={async (atts) => {
                    // HARDENED: Route through secureEntityWrite for validation
                    const result = await api.invoke('secureEntityWrite', {
                      action: 'update',
                      entity_type: 'HRRecord',
                      organization_id: org.id,
                      entity_id: showDetail.id,
                      data: { attachments: atts }
                    });
                    if (result?.data?.success) {
                      loadData();
                    } else {
                      alert(result?.data?.error || 'Failed to update attachments');
                    }
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}