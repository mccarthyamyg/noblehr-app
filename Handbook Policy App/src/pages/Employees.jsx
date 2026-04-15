import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { usePermissions } from '../components/hooks/usePermissions';
import { createPageUrl } from '../utils';
import { Link } from 'react-router-dom';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import { Users, Plus, Search, Mail, MapPin, Briefcase, Send, Copy, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function Employees() {
  const { org, employee: currentEmployee } = useOrg();
  const { isOrgAdmin } = usePermissions();
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [inviteStatus, setInviteStatus] = useState(null); // 'sent' | 'skipped' | 'failed'
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', first_name: '', last_name: '', role: '', location_id: '', department: '', permission_level: 'employee' });
  const [inviteLink, setInviteLink] = useState(null);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', user_email: '', role: '', department: '',
    location_id: '', permission_level: 'employee', hire_date: '', tags: [], capabilities: []
  });
  const [capabilitiesList, setCapabilitiesList] = useState([]);

  useEffect(() => {
    if (!org) return;
    loadData();
  }, [org]);

  async function loadData() {
    setLoadError(null);
    try {
      const result = await api.invoke('getAdminContext', { organization_id: org.id });
      setEmployees(result.data.employees || []);
      setLocations(result.data.locations || []);
    } catch (e) {
      setLoadError(e.data?.error || e.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  async function openEdit(emp) {
    setEditEmployee(emp);
    let caps = [];
    if (emp.capabilities) {
      try { caps = typeof emp.capabilities === 'string' ? JSON.parse(emp.capabilities) : emp.capabilities; } catch (_) {}
    }
    setForm({
      first_name: emp.first_name || (emp.full_name || '').split(' ')[0] || '', last_name: emp.last_name || (emp.full_name || '').split(' ').slice(1).join(' ') || '', user_email: emp.user_email || '', role: emp.role || '',
      department: emp.department || '', location_id: emp.location_id || '',
      permission_level: emp.permission_level || 'employee', hire_date: emp.hire_date || '',
      tags: emp.tags || [], capabilities: Array.isArray(caps) ? caps : []
    });
    if (capabilitiesList.length === 0) {
      try { const list = await api.getCapabilities(); setCapabilitiesList(list); } catch (_) {}
    }
    setShowAdd(true);
  }

  async function openNew() {
    setEditEmployee(null);
    setForm({
      first_name: '', last_name: '', user_email: '', role: '', department: '',
      location_id: '', permission_level: 'employee', hire_date: '', tags: [], capabilities: []
    });
    if (capabilitiesList.length === 0) {
      try { const list = await api.getCapabilities(); setCapabilitiesList(list); } catch (_) {}
    }
    setShowAdd(true);
  }

  async function saveEmployee() {
    setSaving(true);
    setInviteStatus(null);
    try {
      const data = { ...form, full_name: [form.first_name, form.last_name].filter(Boolean).join(' '), organization_id: org.id, status: 'active', capabilities: form.permission_level === 'manager' ? (form.capabilities || []) : [] };
      if (editEmployee) {
        await api.invoke('secureEmployeeWrite', {
          action: 'update',
          organization_id: org.id,
          employee_id: editEmployee.id,
          data
        });
      } else {
        await api.invoke('secureEmployeeWrite', {
          action: 'create',
          organization_id: org.id,
          data
        });
      }
      setShowAdd(false);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  const filtered = employees.filter(e => {
    const displayName = e.first_name ? `${e.first_name} ${e.last_name || ''}`.trim() : (e.full_name || '');
    if (search && !displayName.toLowerCase().includes(search.toLowerCase()) && !e.user_email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getLocationName = (id) => locations.find(l => l.id === id)?.name || '';

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading employees...</div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Could not load employees</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
          <Button type="button" variant="destructive" className="mt-3" onClick={() => loadData()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        description={`${employees.length} employees in ${org?.name}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowInvite(true); setInviteLink(null); setInviteForm({ email: '', first_name: '', last_name: '', role: '', location_id: '', department: '', permission_level: 'employee' }); }}>
              <Send className="w-4 h-4 mr-2" /> Invite by Email
            </Button>
            <Button className="bg-noble hover:bg-noble-dark" onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Add Employee
            </Button>
          </div>
        }
      />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..." className="pl-9 max-w-md" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No employees yet" description="Add your first employee to get started" action={<Button className="bg-noble hover:bg-noble-dark" onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Add Employee</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(emp => (
            <Link key={emp.id} to={createPageUrl(`EmployeeProfile?id=${emp.id}`)}>
              <Card className="p-5 hover:shadow-md transition-all border-slate-200/60 cursor-pointer group">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-indigo-700">
                    {(emp.first_name || emp.full_name)?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{emp.first_name ? `${emp.first_name} ${emp.last_name || ''}`.trim() : emp.full_name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <StatusBadge status={emp.permission_level} />
                    <StatusBadge status={emp.status} />
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    {emp.role && <div className="flex items-center gap-1.5"><Briefcase className="w-3 h-3" />{emp.role}</div>}
                    {emp.user_email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{emp.user_email}</div>}
                    {emp.location_id && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{getLocationName(emp.location_id)}</div>}
                  </div>
                </div>
              </div>
            </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.user_email} onChange={e => setForm({ ...form, user_email: e.target.value })} type="email" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {(org?.settings?.custom_roles || []).map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.department} onValueChange={v => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {(org?.settings?.departments || []).map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={form.location_id} onValueChange={v => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Permission Level</Label>
                <Select value={form.permission_level} onValueChange={v => setForm({ ...form, permission_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee (basic access)</SelectItem>
                    {isOrgAdmin && <SelectItem value="manager">Manager (grant capabilities below)</SelectItem>}
                    {isOrgAdmin && <SelectItem value="org_admin">Org Admin (full access)</SelectItem>}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">Org Admin has all access. Manager has only the capabilities you grant.</p>
              </div>
            </div>
            {form.permission_level === 'manager' && capabilitiesList.length > 0 && (
              <div className="space-y-2">
                <Label>Capabilities</Label>
                <p className="text-xs text-slate-500">Select what this manager can do.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {capabilitiesList.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(form.capabilities || []).includes(key)}
                        onChange={e => {
                          const prev = form.capabilities || [];
                          const next = e.target.checked ? [...prev, key] : prev.filter(c => c !== key);
                          setForm({ ...form, capabilities: next });
                        }}
                        className="rounded border-slate-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Hire Date</Label>
              <Input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-noble hover:bg-noble-dark" onClick={saveEmployee} disabled={saving || !form.first_name}>
              {saving ? 'Saving...' : editEmployee ? 'Update' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Employee by Email</DialogTitle>
          </DialogHeader>
          {!inviteLink ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Send an invite link. The employee will sign in with Google (matching email) or create a password.</p>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} type="email" placeholder="employee@company.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={inviteForm.first_name} onChange={e => setInviteForm({ ...inviteForm, first_name: e.target.value })} placeholder="Jane" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={inviteForm.last_name} onChange={e => setInviteForm({ ...inviteForm, last_name: e.target.value })} placeholder="Smith" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteForm.role} onValueChange={v => setInviteForm({ ...inviteForm, role: v })}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {(org?.settings?.custom_roles || []).map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={inviteForm.department} onValueChange={v => setInviteForm({ ...inviteForm, department: v })}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {(org?.settings?.departments || []).map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location *</Label>
                  <Select value={inviteForm.location_id} onValueChange={v => setInviteForm({ ...inviteForm, location_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                    <SelectContent>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Permission Level</Label>
                  <Select value={inviteForm.permission_level} onValueChange={v => setInviteForm({ ...inviteForm, permission_level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="org_admin">Org Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
                <Button className="bg-noble hover:bg-noble-dark" onClick={async () => {
                  setInviteSaving(true);
                  try {
                    const res = await api.invites.create({ ...inviteForm, full_name: [inviteForm.first_name, inviteForm.last_name].filter(Boolean).join(' '), organization_id: org.id });
                    setInviteLink(res.data?.invite_link || '');
                  } catch (e) {
                    alert(e.data?.error || e.message || 'Failed to create invite');
                  } finally {
                    setInviteSaving(false);
                  }
                }} disabled={inviteSaving || !inviteForm.email?.trim() || !inviteForm.first_name?.trim() || !inviteForm.last_name?.trim()}>
                  {inviteSaving ? 'Creating...' : 'Create Invite'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-green-600">Invite created! Share this link with the employee:</p>
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500">Link expires in 7 days. You can also send this via email manually.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setInviteLink(null); setInviteForm({ email: '', first_name: '', last_name: '', role: '', location_id: '', department: '', permission_level: 'employee' }); }}>Invite Another</Button>
                <Button className="bg-noble hover:bg-noble-dark" onClick={() => setShowInvite(false)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
