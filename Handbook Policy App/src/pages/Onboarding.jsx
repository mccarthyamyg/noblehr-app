import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { usePermissions } from '../components/hooks/usePermissions';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Clock, AlertCircle, Plus, Send, User } from 'lucide-react';
import { format, addDays } from 'date-fns';

export default function OnboardingPage() {
  const { org } = useOrg();
  const { isAdmin } = usePermissions();
  const [onboardings, setOnboardings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [newOnboarding, setNewOnboarding] = useState({
    employee_id: '',
    assigned_policy_ids: [],
    due_date: format(addDays(new Date(), 7), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (org && isAdmin) loadData();
  }, [org, isAdmin]);

  async function loadData() {
    setLoadError(null);
    try {
      const [ctxResult, policyResult] = await Promise.all([
        api.invoke('getAdminContext', { organization_id: org.id, include: ['onboardings'] }),
        api.invoke('getPoliciesForEmployee', { organization_id: org.id })
      ]);
      setOnboardings(ctxResult.data.onboardings || []);
      setEmployees((ctxResult.data.employees || []).filter(e => e.status === 'active'));
      setPolicies(policyResult.data.policies || []);
    } catch (e) {
      setLoadError(e.data?.error || e.message || 'Failed to load onboarding');
    } finally {
      setLoading(false);
    }
  }

  async function createOnboarding() {
    const selectedEmployee = employees.find(e => e.id === newOnboarding.employee_id);
    if (!selectedEmployee) return;

    await api.invoke('secureEntityWrite', {
      action: 'create',
      entity_type: 'Onboarding',
      organization_id: org.id,
      data: {
        organization_id: org.id,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        employee_email: selectedEmployee.user_email,
        assigned_policy_ids: newOnboarding.assigned_policy_ids,
        completed_policy_ids: [],
        due_date: newOnboarding.due_date,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'not_started',
        reminder_sent_count: 0
      }
    });

    setCreateDialog(false);
    setNewOnboarding({
      employee_id: '',
      assigned_policy_ids: [],
      due_date: format(addDays(new Date(), 7), 'yyyy-MM-dd')
    });
    loadData();
  }

  async function sendReminder(onboarding) {
    await api.invoke('sendOnboardingReminder', {
      organization_id: org.id,
      onboarding_id: onboarding.id
    });
    loadData();
  }

  async function suggestPoliciesForEmployee(employeeId) {
    if (!employeeId) return [];
    try {
      const result = await api.invoke('getApplicablePolicies', {
        organization_id: org.id,
        employee_id: employeeId,
        acknowledgment_required_only: false
      });
      return (result.data?.policies || []).map(p => p.id);
    } catch {
      return [];
    }
  }

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading...</div>;

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Could not load onboarding</p>
          <p className="text-sm text-red-600 mt-1">{loadError}</p>
          <Button type="button" variant="destructive" className="mt-3" onClick={() => loadData()}>Retry</Button>
        </div>
      </div>
    );
  }

  const employeesWithoutOnboarding = employees.filter(e =>
    !onboardings.find(o => o.employee_id === e.id && o.status !== 'completed')
  );

  return (
    <div>
      <PageHeader
        title="Employee Onboarding"
        description="Manage new hire policy assignments and track completion"
        actions={
          <Button onClick={() => setCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Start Onboarding
          </Button>
        }
      />

      <div className="grid gap-4 mb-6 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {onboardings.filter(o => o.status === 'in_progress').length}
                </p>
                <p className="text-xs text-slate-500">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {onboardings.filter(o => o.status === 'completed').length}
                </p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {onboardings.filter(o =>
                    o.status !== 'completed' && new Date(o.due_date) < new Date()
                  ).length}
                </p>
                <p className="text-xs text-slate-500">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {onboardings.map(ob => {
          const progress = ob.assigned_policy_ids?.length
            ? ((ob.completed_policy_ids?.length || 0) / ob.assigned_policy_ids.length) * 100
            : 0;
          const isOverdue = new Date(ob.due_date) < new Date() && ob.status !== 'completed';

          return (
            <Card key={ob.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <User className="w-5 h-5 text-slate-400" />
                      <h3 className="font-semibold text-slate-900">{ob.employee_name}</h3>
                      <Badge variant={
                        ob.status === 'completed' ? 'default' :
                        ob.status === 'in_progress' ? 'outline' :
                        'secondary'
                      }>
                        {ob.status === 'completed' ? 'Completed' :
                         ob.status === 'in_progress' ? 'In Progress' :
                         'Not Started'}
                      </Badge>
                      {isOverdue && (
                        <Badge variant="destructive" className="text-xs">Overdue</Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>Due: {format(new Date(ob.due_date), 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span>{ob.completed_policy_ids?.length || 0} of {ob.assigned_policy_ids?.length || 0} policies acknowledged</span>
                      </div>

                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {ob.last_reminder_date && (
                        <p className="text-xs text-slate-500">
                          Last reminder sent: {format(new Date(ob.last_reminder_date), 'MMM d, yyyy')}
                          ({ob.reminder_sent_count || 0} total)
                        </p>
                      )}
                    </div>
                  </div>

                  {ob.status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendReminder(ob)}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Reminder
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Employee Onboarding</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Employee</Label>
              <Select
                value={newOnboarding.employee_id}
                onValueChange={async (value) => {
                  setNewOnboarding(prev => ({ ...prev, employee_id: value }));
                  if (value) {
                    const ids = await suggestPoliciesForEmployee(value);
                    setNewOnboarding(prev => ({ ...prev, employee_id: value, assigned_policy_ids: ids }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employeesWithoutOnboarding.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Policies that apply to this employee (by role, location, targeting) will be auto-selected. Adjust as needed.</p>
            </div>

            <div className="space-y-2">
              <Label>Assign Policies</Label>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                {policies.map(policy => (
                  <label key={policy.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newOnboarding.assigned_policy_ids.includes(policy.id)}
                      onChange={(e) => {
                        setNewOnboarding({
                          ...newOnboarding,
                          assigned_policy_ids: e.target.checked
                            ? [...newOnboarding.assigned_policy_ids, policy.id]
                            : newOnboarding.assigned_policy_ids.filter(id => id !== policy.id)
                        });
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{policy.title}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={newOnboarding.due_date}
                onChange={(e) => setNewOnboarding({ ...newOnboarding, due_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={createOnboarding}
              disabled={!newOnboarding.employee_id || newOnboarding.assigned_policy_ids.length === 0}
            >
              Start Onboarding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
