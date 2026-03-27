import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { createPageUrl } from '../utils';
import { Building2, Plus, ArrowRight, Check, Trash2, Bell } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function Setup() {
  const location = useLocation();
  const { org, logout } = useOrg();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [googleCredential, setGoogleCredential] = useState(null);
  const [orgData, setOrgData] = useState({ name: '', industry: '', admin_email: '', admin_password: '', admin_name: '' });
  const [locations, setLocations] = useState([{ name: '', address: '' }]);
  const [roles, setRoles] = useState(['Manager', 'Supervisor', 'Team Lead']);
  const [departments, setDepartments] = useState(['Operations', 'Front of House', 'Back of House']);
  const [newRole, setNewRole] = useState('');
  const [newDept, setNewDept] = useState('');
  const [notifications, setNotifications] = useState({ email_reminders: false, sms_reminders: false, phone_number: '' });
  const [acceptTos, setAcceptTos] = useState(false);

  useEffect(() => {
    const state = location.state || {};
    if (state.googleEmail || state.googleName) {
      setOrgData(prev => ({ ...prev, admin_email: state.googleEmail || prev.admin_email, admin_name: state.googleName || prev.admin_name }));
    }
  }, [location.state]);

  useEffect(() => {
    if (org) {
      window.location.href = createPageUrl('Dashboard');
    }
  }, [org?.id]);

  const handleCreateOrg = async () => {
    setSaving(true);
    try {
      if (googleCredential) {
        const data = await api.auth.registerWithGoogle({
          credential: googleCredential,
          org_name: orgData.name,
          industry: orgData.industry,
          locations: locations.filter(l => l.name).map(l => ({ name: l.name, address: l.address })),
          roles,
          departments,
          accept_tos: true,
        });
        if (data.pendingApproval) {
          alert(data.message || 'Your organization is pending approval from the platform administrator.');
          return;
        }
      } else {
        const data = await api.auth.register({
          email: orgData.admin_email,
          password: orgData.admin_password,
          full_name: orgData.admin_name,
          org_name: orgData.name,
          industry: orgData.industry,
          locations: locations.filter(l => l.name).map(l => ({ name: l.name, address: l.address })),
          roles,
          departments,
          accept_tos: true,
        });
        if (data.pendingApproval) {
          alert(data.message || 'Your organization is pending approval from the platform administrator.');
          return;
        }
      }
      window.location.href = createPageUrl('Dashboard');
    } catch (e) {
      console.error(e);
      alert(e.data?.error || e.message || 'Setup failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-200">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">PolicyVault</h1>
          <p className="text-slate-500 mt-2 text-sm">Set up your organization to get started</p>
          <p className="mt-3 text-sm">
            <button type="button" onClick={() => { logout(); window.location.href = '/Login'; }} className="text-indigo-600 hover:underline">
              Using a different account? Sign out
            </button>
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-indigo-600' : s < step ? 'w-8 bg-indigo-300' : 'w-8 bg-slate-200'}`} />
          ))}
        </div>

        <Card className="border-slate-200/60 shadow-xl shadow-slate-200/30">
          <CardContent className="p-8">
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-slate-900">Organization & Admin Account</h2>
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input
                    value={orgData.name}
                    onChange={e => setOrgData({ ...orgData, name: e.target.value })}
                    placeholder="Acme Restaurant Group"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input
                    value={orgData.industry}
                    onChange={e => setOrgData({ ...orgData, industry: e.target.value })}
                    placeholder="Restaurant, Retail, Salon..."
                  />
                </div>

                {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                  <>
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white px-2 text-slate-500">Or use your Google account</span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <GoogleLogin
                        onSuccess={(credentialResponse) => {
                          if (credentialResponse?.credential) setGoogleCredential(credentialResponse.credential);
                        }}
                        onError={() => {}}
                        theme="filled_black"
                        size="large"
                        text="signup_with"
                        shape="rectangular"
                        width="320"
                      />
                    </div>
                    {googleCredential && (
                      <p className="text-center text-sm text-green-600">Google account linked. Enter organization details above and continue.</p>
                    )}
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-white px-2 text-slate-500">Or use email</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Your Name</Label>
                  <Input
                    value={orgData.admin_name}
                    onChange={e => setOrgData({ ...orgData, admin_name: e.target.value })}
                    placeholder="Jane Smith"
                    readOnly={!!googleCredential}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Your Email</Label>
                  <Input
                    type="email"
                    value={orgData.admin_email}
                    onChange={e => setOrgData({ ...orgData, admin_email: e.target.value })}
                    placeholder="you@company.com"
                    readOnly={!!googleCredential}
                  />
                </div>
                {!googleCredential && (
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={orgData.admin_password}
                      onChange={e => setOrgData({ ...orgData, admin_password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                )}
                <Button
                  onClick={() => setStep(2)}
                  disabled={!orgData.name || (!googleCredential && (!orgData.admin_email || !orgData.admin_password))}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-slate-900">Locations</h2>
                <p className="text-sm text-slate-500">Add your business locations (you can add more later)</p>
                {locations.map((loc, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={loc.name}
                      onChange={e => {
                        const updated = [...locations];
                        updated[i].name = e.target.value;
                        setLocations(updated);
                      }}
                      placeholder="Location name"
                    />
                    <Input
                      value={loc.address}
                      onChange={e => {
                        const updated = [...locations];
                        updated[i].address = e.target.value;
                        setLocations(updated);
                      }}
                      placeholder="Address"
                    />
                    {locations.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => setLocations(locations.filter((_, j) => j !== i))}>
                        <Trash2 className="w-4 h-4 text-slate-400" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setLocations([...locations, { name: '', address: '' }])}>
                  <Plus className="w-3 h-3 mr-2" /> Add Location
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                  <Button onClick={() => setStep(3)} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-lg font-semibold text-slate-900">Roles & Departments</h2>
                <p className="text-sm text-slate-500">Configure your team structure</p>
                
                <div className="space-y-3">
                  <Label>Roles</Label>
                  <div className="flex flex-wrap gap-2">
                    {roles.map(r => (
                      <span key={r} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                        {r}
                        <button onClick={() => setRoles(roles.filter(x => x !== r))} className="hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Add role..." className="text-sm" />
                    <Button variant="outline" size="sm" onClick={() => { if (newRole.trim()) { setRoles([...roles, newRole.trim()]); setNewRole(''); } }}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Departments</Label>
                  <div className="flex flex-wrap gap-2">
                    {departments.map(d => (
                      <span key={d} className="inline-flex items-center gap-1 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-xs font-medium">
                        {d}
                        <button onClick={() => setDepartments(departments.filter(x => x !== d))} className="hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="Add department..." className="text-sm" />
                    <Button variant="outline" size="sm" onClick={() => { if (newDept.trim()) { setDepartments([...departments, newDept.trim()]); setNewDept(''); } }}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                  <Button onClick={() => setStep(4)} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Reminder Preferences</h2>
                    <p className="text-sm text-slate-500">Get notified about pending policy acknowledgments</p>
                  </div>
                </div>
                
                <div className="space-y-4 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Email Reminders</Label>
                      <p className="text-xs text-slate-500 mt-1">Get reminder emails for pending acknowledgments</p>
                    </div>
                    <Switch
                      checked={notifications.email_reminders}
                      onCheckedChange={v => setNotifications({ ...notifications, email_reminders: v })}
                    />
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <Label className="font-medium">SMS Reminders</Label>
                        <p className="text-xs text-slate-500 mt-1">Get text message reminders</p>
                      </div>
                      <Switch
                        checked={notifications.sms_reminders}
                        onCheckedChange={v => setNotifications({ ...notifications, sms_reminders: v })}
                      />
                    </div>
                    {notifications.sms_reminders && (
                      <div className="space-y-2">
                        <Label className="text-xs">Phone Number</Label>
                        <Input
                          type="tel"
                          value={notifications.phone_number}
                          onChange={e => setNotifications({ ...notifications, phone_number: e.target.value })}
                          placeholder="(555) 123-4567"
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-600">
                    💡 You can change these preferences anytime in your profile settings.
                  </p>
                </div>

                <div className="flex items-start gap-3 border border-slate-200 rounded-lg p-4">
                  <input
                    type="checkbox"
                    id="accept_tos"
                    checked={acceptTos}
                    onChange={e => setAcceptTos(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <label htmlFor="accept_tos" className="text-sm text-slate-700">
                    I agree to the Terms of Service (data ownership, platform access for support only, data portability, and confidentiality).
                  </label>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
                  <Button onClick={handleCreateOrg} disabled={saving || !acceptTos || (notifications.sms_reminders && !notifications.phone_number)} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                    {saving ? 'Creating...' : 'Create Organization'}
                    <Check className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}