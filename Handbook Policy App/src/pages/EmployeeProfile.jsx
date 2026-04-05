import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { createPageUrl } from '../utils';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { ArrowLeft, Mail, MapPin, Briefcase, Calendar, AlertCircle, FileWarning, Download, FileUp, FileText, Trash2, UserMinus } from 'lucide-react';
import { usePermissions } from '../components/hooks/usePermissions';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import WriteUpDialog from '../components/hr/WriteUpDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DOC_CATEGORIES = [
  { value: 'identification', label: 'Identification' },
  { value: 'certification', label: 'Certification' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
];
const ALLOWED_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
const MAX_SIZE_MB = 10;

export default function EmployeeProfile() {
  const { org, employee: currentUser } = useOrg();
  const { isAdmin } = usePermissions();
  const caps = Array.isArray(currentUser?.capabilities) ? currentUser.capabilities : (typeof currentUser?.capabilities === 'string' ? (() => { try { const c = JSON.parse(currentUser.capabilities); return Array.isArray(c) ? c : []; } catch { return []; } })() : []);
  const canManageEmployees = isAdmin || caps.includes('manage_employees');
  const [employee, setEmployee] = useState(null);
  const [location, setLocation] = useState(null);
  const [writeUps, setWriteUps] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWriteUp, setShowWriteUp] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('other');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const fileInputRef = useRef(null);

  const params = new URLSearchParams(window.location.search);
  const employeeId = params.get('id');

  useEffect(() => {
    if (!org || !employeeId) return;
    loadData();
  }, [org, employeeId]);

  async function loadData() {
    const [profileResult, hrResult, docsResult] = await Promise.all([
      api.invoke('getEmployeeProfile', { organization_id: org.id, employee_id: employeeId }),
      api.invoke('getHRRecords', { organization_id: org?.id, employee_id: employeeId, record_type: 'write_up' }),
      api.employeeDocuments.list(employeeId).catch(() => [])
    ]);
    if (profileResult.data?.employee) {
      setEmployee(profileResult.data.employee);
      setLocation(profileResult.data.location || null);
    }
    const records = hrResult?.data?.records || [];
    setWriteUps(records.filter(r => r.record_type === 'write_up'));
    setDocuments(Array.isArray(docsResult) ? docsResult : (docsResult?.data ?? []));
    setLoading(false);
  }

  async function exportEmployeeFile() {
    try {
      const res = await api.invoke('exportEmployeeFile', { organization_id: org.id, employee_id: employeeId });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employee-file-${employeeId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(e?.data?.error || e?.message || 'Export failed');
    }
  }

  async function deactivateEmployee() {
    if (!confirm(`Are you sure you want to deactivate ${employee.full_name}? They will lose access to the platform immediately. Their file will be preserved for re-hire.`)) return;
    setDeactivating(true);
    try {
      await api.invoke('secureEmployeeWrite', {
        action: 'terminate',
        organization_id: org.id,
        employee_id: employeeId,
      });
      alert(`${employee.full_name} has been deactivated.`);
      loadData();
    } catch (e) {
      alert(e?.data?.error || e?.message || 'Deactivation failed');
    } finally {
      setDeactivating(false);
    }
  }

  function getFileExtension(name) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? '.' + name.slice(i + 1).toLowerCase() : '';
  }

  async function handleFileSelect(files) {
    if (!files?.length || !employeeId) return;
    setUploadError(null);
    const file = files[0];
    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXT.includes(ext)) {
      setUploadError(`Allowed types: PDF, PNG, JPG, JPEG, DOC, DOCX`);
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError(`File must be under ${MAX_SIZE_MB}MB`);
      return;
    }
    setUploading(true);
    try {
      await api.employeeDocuments.upload(employeeId, file, { category: uploadCategory, notes: uploadNotes });
      setUploadNotes('');
      loadData();
    } catch (e) {
      setUploadError(e?.data?.error || e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(doc) {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    try {
      await api.employeeDocuments.delete(doc.id);
      loadData();
    } catch (e) {
      alert(e?.data?.error || e?.message || 'Delete failed');
    }
  }

  const disciplineLevelLabels = {
    coaching_verbal: 'Coaching / Verbal',
    written_warning: 'Written Warning',
    final_warning: 'Final Warning',
    termination_review: 'Termination Review'
  };

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading...</div>;
  if (!employee) return <div className="text-center py-20 text-sm text-slate-400">Employee not found</div>;

  return (
    <div>
      <PageHeader
        title={employee.full_name}
        description={employee.role || 'Employee'}
        actions={
          <div className="flex gap-2">
            <Link to={createPageUrl('Employees')}>
              <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            </Link>
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={exportEmployeeFile}>
                  <Download className="w-4 h-4 mr-1" /> Export File
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowWriteUp(true)}>
                  <FileWarning className="w-4 h-4 mr-1" /> Create Write-Up
                </Button>
                {employee.status === 'active' && employee.permission_level !== 'org_admin' && (
                  <Button variant="destructive" size="sm" onClick={deactivateEmployee} disabled={deactivating}>
                    <UserMinus className="w-4 h-4 mr-1" /> {deactivating ? 'Deactivating...' : 'Deactivate'}
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="writeups">Write-Ups {writeUps.length > 0 && `(${writeUps.length})`}</TabsTrigger>
          <TabsTrigger value="documents">Documents {documents.length > 0 && `(${documents.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Employee Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Mail className="w-4 h-4" />
                    <span className="text-xs">Email</span>
                  </div>
                  <p className="text-slate-900">{employee.user_email || 'Not set'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Briefcase className="w-4 h-4" />
                    <span className="text-xs">Role</span>
                  </div>
                  <p className="text-slate-900">{employee.role || 'Not set'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs">Location</span>
                  </div>
                  <p className="text-slate-900">{location?.name || 'Not set'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs">Hire Date</span>
                  </div>
                  <p className="text-slate-900">{employee.hire_date ? format(new Date(employee.hire_date), 'MMMM d, yyyy') : 'Not set'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <span className="text-xs">Department</span>
                  </div>
                  <p className="text-slate-900">{employee.department || 'Not set'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <span className="text-xs">Permission Level</span>
                  </div>
                  <StatusBadge status={employee.permission_level} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Upload document</h3>
              <p className="text-xs text-slate-500 mb-3">PDF, PNG, JPG, JPEG, DOC, DOCX — max {MAX_SIZE_MB}MB</p>
              <div className="flex flex-wrap gap-3 items-end mb-3">
                <div className="w-40">
                  <Label className="text-xs">Category</Label>
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger className="h-9 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input
                    className="h-9 mt-1"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="e.g. I-9 copy"
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_EXT.join(',')}
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading || !canManageEmployees}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="w-4 h-4 mr-1" />
                  {uploading ? 'Uploading...' : 'Choose file'}
                </Button>
              </div>
              {canManageEmployees && (
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center text-sm transition-colors ${dragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200'}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer?.files); }}
                >
                  Drag and drop a file here, or use the button above.
                </div>
              )}
              {uploadError && <p className="text-sm text-red-600 mt-2">{uploadError}</p>}
            </CardContent>
          </Card>
          {documents.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">No documents uploaded yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <Card key={doc.id} className="border-slate-200/60">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.filename}</p>
                      <p className="text-xs text-slate-500">
                        {DOC_CATEGORIES.find(c => c.value === doc.category)?.label || doc.category} · {format(new Date(doc.created_at), 'MMM d, yyyy')}
                        {doc.uploaded_by_email && ` · Uploaded by ${doc.uploaded_by_email}`}
                      </p>
                      {doc.notes && <p className="text-xs text-slate-600 mt-1">{doc.notes}</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => api.employeeDocuments.download(doc.id, doc.filename)}>
                        <Download className="w-4 h-4 mr-1" /> Download
                      </Button>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteDocument(doc)}>
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="writeups" className="space-y-4">
          {writeUps.length === 0 ? (
            <Card className="p-12 text-center">
              <FileWarning className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-sm">No write-ups on record</p>
            </Card>
          ) : (
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
                          {record.signature_required && !record.employee_acknowledged_at && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">Pending Acknowledgment</span>
                          )}
                          {record.employee_acknowledged_at && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Acknowledged</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-3" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(record.description || '') }} />
                        <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                          <span>Recorded by {record.recorded_by_name} · {format(new Date(record.created_date), 'MMM d, yyyy h:mm a')}</span>
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
          )}
        </TabsContent>
      </Tabs>

      {showWriteUp && (
        <WriteUpDialog
          employee={employee}
          onClose={() => setShowWriteUp(false)}
          onSaved={() => {
            setShowWriteUp(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
