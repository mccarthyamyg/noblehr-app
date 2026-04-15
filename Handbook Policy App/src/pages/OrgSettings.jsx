import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { createPageUrl } from '../utils';
import PageHeader from '../components/shared/PageHeader';
import { Plus, Trash2, MapPin, Save, LogOut } from 'lucide-react';
import { usePermissions } from '../components/hooks/usePermissions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function OrgSettings() {
  const { org, refreshOrg, employee } = useOrg();
  const { isAdmin } = usePermissions();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: '', industry: '', state: '', employee_count: '', default_ack_window_new_days: '', default_ack_window_update_days: '' });
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [tags, setTags] = useState([]);
  const [newRole, setNewRole] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newLocation, setNewLocation] = useState({ name: '', address: '' });
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function deleteAccount() {
    try {
      setDeletingAccount(true);
      if (employee?.id) {
        await api.invoke('secureEmployeeWrite', {
          action: 'delete',
          organization_id: org.id,
          entity_id: employee.id,
          data: {}
        });
      }
      api.auth.logout();
    } catch (err) {
      console.error('Error deleting account:', err);
      setDeletingAccount(false);
    }
  }

  useEffect(() => {
    if (!org) return;
    if (!isAdmin) {
      // Redirect non-admins
      window.location.href = createPageUrl('Dashboard');
      return;
    }
    setOrgForm({
      name: org.name,
      industry: org.industry || '',
      state: org.state || '',
      employee_count: org.employee_count != null ? String(org.employee_count) : '',
      default_ack_window_new_days: org.settings?.default_ack_window_new_days ?? '',
      default_ack_window_update_days: org.settings?.default_ack_window_update_days ?? ''
    });
    setRoles(org.settings?.custom_roles || []);
    setDepartments(org.settings?.departments || []);
    setTags(org.settings?.custom_tags || []);
    loadLocations();
  }, [org, isAdmin]);

  async function loadLocations() {
    setLoadError(null);
    try {
      const result = await api.invoke('getAdminContext', { organization_id: org.id });
      setLocations(result.data.locations || []);
    } catch (e) {
      setLoadError(e.data?.error || e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    await api.invoke('secureOrgWrite', {
      action: 'update',
      entity_type: 'Organization',
      organization_id: org.id,
      entity_id: org.id,
      data: {
        name: orgForm.name,
        industry: orgForm.industry,
        state: orgForm.state || null,
        employee_count: orgForm.employee_count ? parseInt(orgForm.employee_count, 10) : null,
        settings: {
          custom_roles: roles,
          departments,
          custom_tags: tags,
          default_ack_window_new_days: orgForm.default_ack_window_new_days ? Number(orgForm.default_ack_window_new_days) : undefined,
          default_ack_window_update_days: orgForm.default_ack_window_update_days ? Number(orgForm.default_ack_window_update_days) : undefined
        }
      }
    });
    await refreshOrg();
    setSaving(false);
  }

  async function addLocation() {
    if (!newLocation.name) return;
    await api.invoke('secureOrgWrite', {
      action: 'create',
      entity_type: 'Location',
      organization_id: org.id,
      data: { name: newLocation.name, address: newLocation.address }
    });
    setNewLocation({ name: '', address: '' });
    loadLocations();
  }

  async function deleteLocation(id) {
    await api.invoke('secureOrgWrite', {
      action: 'delete',
      entity_type: 'Location',
      organization_id: org.id,
      entity_id: id,
      data: {}
    });
    loadLocations();
  }

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading settings...</div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Could not load settings</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
          <Button type="button" variant="destructive" className="mt-3" onClick={() => loadLocations()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Organization Settings"
        description="Manage your organization's configuration"
        actions={
          <Button className="bg-noble hover:bg-noble-dark" onClick={saveSettings} disabled={saving}>
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        }
      />

      <Accordion type="single" collapsible defaultValue="general" className="space-y-3 pb-8">
        <AccordionItem value="general" className="border border-slate-200/60 rounded-lg px-4">
          <AccordionTrigger className="py-3 text-base font-semibold hover:no-underline">General Settings</AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={orgForm.industry} onChange={e => setOrgForm({ ...orgForm, industry: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>State (for compliance and policy generation)</Label>
              <Input value={orgForm.state} onChange={e => setOrgForm({ ...orgForm, state: e.target.value })} placeholder="e.g. MA, NY" />
            </div>
            <div className="space-y-2">
              <Label>Approximate number of employees (for compliance thresholds)</Label>
              <Input type="number" min={1} value={orgForm.employee_count} onChange={e => setOrgForm({ ...orgForm, employee_count: e.target.value })} placeholder="e.g. 25" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ack window — new employees (days)</Label>
                <Input type="number" min={1} max={90} value={orgForm.default_ack_window_new_days} onChange={e => setOrgForm({ ...orgForm, default_ack_window_new_days: e.target.value })} placeholder="14" />
              </div>
              <div className="space-y-2">
                <Label>Ack window — policy updates (days)</Label>
                <Input type="number" min={1} max={90} value={orgForm.default_ack_window_update_days} onChange={e => setOrgForm({ ...orgForm, default_ack_window_update_days: e.target.value })} placeholder="7" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="roles" className="border border-slate-200/60 rounded-lg px-4">
          <AccordionTrigger className="py-3 text-base font-semibold hover:no-underline">Roles & Departments</AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Roles</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {roles.map(r => (
                    <span key={r} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                      {r}
                      <button onClick={() => setRoles(roles.filter(x => x !== r))} className="hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="New role..." className="text-sm" />
                  <Button variant="outline" size="sm" onClick={() => { if (newRole.trim()) { setRoles([...roles, newRole.trim()]); setNewRole(''); } }}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Departments</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {departments.map(d => (
                    <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-full text-xs font-medium">
                      {d}
                      <button onClick={() => setDepartments(departments.filter(x => x !== d))} className="hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="New department..." className="text-sm" />
                  <Button variant="outline" size="sm" onClick={() => { if (newDept.trim()) { setDepartments([...departments, newDept.trim()]); setNewDept(''); } }}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="locations" className="border border-slate-200/60 rounded-lg px-4">
          <AccordionTrigger className="py-3 text-base font-semibold hover:no-underline">Locations</AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            {locations.map(loc => (
              <div key={loc.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200/60 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{loc.name}</p>
                    {loc.address && <p className="text-xs text-slate-500">{loc.address}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteLocation(loc.id)}>
                  <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                </Button>
              </div>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Input value={newLocation.name} onChange={e => setNewLocation({ ...newLocation, name: e.target.value })} placeholder="Location name" className="text-sm" />
              <Input value={newLocation.address} onChange={e => setNewLocation({ ...newLocation, address: e.target.value })} placeholder="Address" className="text-sm" />
              <Button variant="outline" onClick={addLocation} disabled={!newLocation.name}>
                <Plus className="w-4 h-4 mr-2" />Add Location
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tags" className="border border-slate-200/60 rounded-lg px-4">
          <AccordionTrigger className="py-3 text-base font-semibold hover:no-underline">Custom Tags</AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <p className="text-xs text-slate-500">Tags can be used for flexible policy targeting across roles, departments, and custom categories.</p>
            <div className="flex flex-wrap gap-2">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                  {t}
                  <button onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="New tag..." className="text-sm" />
              <Button variant="outline" size="sm" onClick={() => { if (newTag.trim()) { setTags([...tags, newTag.trim()]); setNewTag(''); } }}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="policy-overrides" className="border border-slate-200/60 rounded-lg px-4">
          <AccordionTrigger className="py-3 text-base font-semibold hover:no-underline">Policy Overrides</AccordionTrigger>
          <AccordionContent className="pb-4">
            <PolicyOverridesTab org={org} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="account" className="border border-red-200 bg-red-50/50 rounded-lg px-4">
          <AccordionTrigger className="py-3 text-base font-semibold text-red-900 hover:no-underline">Danger Zone</AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <p className="text-sm text-red-800">Deleting your account is permanent and cannot be undone. You will lose access to all your data.</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deletingAccount}>
                  <LogOut className="w-4 h-4 mr-2" />
                  {deletingAccount ? 'Deleting...' : 'Delete Account'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Your account and all associated data will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex gap-3">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAccount} className="bg-red-600 hover:bg-red-700">
                    Delete Permanently
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function PolicyOverridesTab({ org }) {
  const [policies, setPolicies] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTarget, setExpandedTarget] = useState(null);
  const [orgRoles, setOrgRoles] = useState([]);

  useEffect(() => {
    loadData();
  }, [org]);

  async function loadData() {
    const result = await api.invoke('getAdminContext', {
      organization_id: org.id,
      include: ['policies', 'overrides']
    });
    setPolicies(result.data.policies || []);
    setOverrides(result.data.overrides || []);
    setEmployees(result.data.employees || []);
    setLocations(result.data.locations || []);
    setOrgRoles(org?.settings?.custom_roles || []);
    setLoading(false);
  }

  async function togglePolicyForTarget(policyId, overrideType, targetId) {
    const existing = overrides.find(o =>
      o.policy_id === policyId &&
      o.override_type === overrideType &&
      (overrideType === 'role' ? o.role === targetId : overrideType === 'location' ? o.location_id === targetId : o.employee_id === targetId)
    );

    if (existing) {
      await api.invoke('secureOrgWrite', {
        action: 'delete',
        entity_type: 'PolicyTargetingOverride',
        organization_id: org.id,
        entity_id: existing.id,
        data: {}
      });
    } else {
      const data = {
        policy_id: policyId,
        override_type: overrideType,
        applies: false
      };
      if (overrideType === 'role') data.role = targetId;
      if (overrideType === 'location') data.location_id = targetId;
      if (overrideType === 'employee') data.employee_id = targetId;

      await api.invoke('secureOrgWrite', {
        action: 'create',
        entity_type: 'PolicyTargetingOverride',
        organization_id: org.id,
        data
      });
    }
    await loadData();
  }

  if (loading) return <div className="text-sm text-slate-400">Loading...</div>;

  if (policies.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-slate-500">
          No active policies. Create policies first before setting overrides.
        </CardContent>
      </Card>
    );
  }

  const renderTargetSection = (label, type, items, getKey, getLabel) => {
    if (items.length === 0) return null;

    const itemsForType = items.map(item => {
      const key = getKey(item);
      const targetOverrides = overrides.filter(o => o.override_type === type && (type === 'role' ? o.role === key : type === 'location' ? o.location_id === key : o.employee_id === key));
      const excludedPolicies = targetOverrides.map(o => o.policy_id);
      return { key, label: getLabel(item), excludedPolicies };
    });

    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{label}</p>
        <div className="space-y-2">
          {itemsForType.map(item => {
            const isExpanded = expandedTarget === `${type}-${item.key}`;
            return (
              <Card key={`${type}-${item.key}`} className="border-slate-200/60">
                <div className="p-4">
                  <button
                    onClick={() => setExpandedTarget(isExpanded ? null : `${type}-${item.key}`)}
                    className="w-full text-left flex items-center justify-between hover:text-noble transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.excludedPolicies.length} excluded</p>
                    </div>
                    <span className="text-lg">{isExpanded ? '−' : '+'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                      <p className="text-xs text-slate-600 mb-3">Click policies to exclude from {item.label}:</p>
                      <div className="flex flex-wrap gap-2">
                        {policies.map(policy => {
                          const isExcluded = item.excludedPolicies.includes(policy.id);
                          return (
                            <button
                              key={policy.id}
                              onClick={() => togglePolicyForTarget(policy.id, type, item.key)}
                              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                isExcluded
                                  ? 'bg-red-50 border-red-200 text-red-700'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-red-200'
                              }`}
                            >
                              {isExcluded ? <span>✕ {policy.title}</span> : policy.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">Override default handbook targeting. Click a role/location/employee to exclude specific policies.</p>

      {renderTargetSection('Roles', 'role', orgRoles, r => r, r => r)}
      {renderTargetSection('Locations', 'location', locations, l => l.id, l => l.name)}
      {renderTargetSection('Employees', 'employee', employees, e => e.id, e => e.first_name ? `${e.first_name} ${e.last_name || ''}`.trim() : e.full_name)}
    </div>
  );
}
