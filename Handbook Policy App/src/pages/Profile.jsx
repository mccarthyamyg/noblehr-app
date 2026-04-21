import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '../utils';
import PageHeader from '../components/shared/PageHeader';
import { User, Lock, Mail, LogOut, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

export default function Profile() {
  const { user: authUser, org, employee, superAdmin, logout } = useAuth();
  const { refreshContext } = useOrg();
  const navigate = useNavigate();
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
  const [emailForm, setEmailForm] = useState({ new_email: '', password: '' });
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone_number: '',
    email_reminders: false,
    sms_reminders: false,
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [emailMsg, setEmailMsg] = useState(null);
  const [profileMsg, setProfileMsg] = useState(null);

  // Account deletion state
  const [deleteStep, setDeleteStep] = useState(0); // 0=hidden, 1=confirm, 2=password
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMsg, setDeleteMsg] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const user = authUser || { email: employee?.user_email, full_name: employee?.full_name };
  const canChangeEmail = !superAdmin && employee?.user_email;
  const canEditProfile = !superAdmin && employee;

  useEffect(() => {
    if (user || employee) {
      setProfileForm({
        full_name: user?.full_name || employee?.full_name || '',
        phone_number: employee?.phone_number || '',
        email_reminders: !!employee?.email_reminders,
        sms_reminders: !!employee?.sms_reminders,
      });
    }
  }, [user?.full_name, employee?.full_name, employee?.phone_number, employee?.email_reminders, employee?.sms_reminders]);

  async function changePassword(e) {
    e.preventDefault();
    if (pwForm.new !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await api.account.changePassword(pwForm.current, pwForm.new);
      setPwMsg({ type: 'success', text: 'Password updated' });
      setPwForm({ current: '', new: '', confirm: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.data?.error || err.message });
    } finally {
      setPwSaving(false);
    }
  }

  async function changeEmail(e) {
    e.preventDefault();
    setEmailSaving(true);
    setEmailMsg(null);
    try {
      await api.account.changeEmail(emailForm.new_email, emailForm.password);
      setEmailMsg({ type: 'success', text: 'Email updated' });
      setEmailForm({ new_email: '', password: '' });
      refreshContext?.();
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.data?.error || err.message });
    } finally {
      setEmailSaving(false);
    }
  }

  async function updateProfile(e) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await api.account.updateProfile({
        full_name: profileForm.full_name,
        phone_number: profileForm.phone_number,
        email_reminders: profileForm.email_reminders,
        sms_reminders: profileForm.sms_reminders,
      });
      setProfileMsg({ type: 'success', text: 'Profile updated' });
      refreshContext?.();
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.data?.error || err.message });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return;
    if (!deletePassword) {
      setDeleteMsg({ type: 'error', text: 'Please enter your password' });
      return;
    }
    setDeleting(true);
    setDeleteMsg(null);
    try {
      await api.account.deleteAccount(deletePassword);
      logout();
      navigate('/Login', { replace: true });
    } catch (err) {
      setDeleteMsg({ type: 'error', text: err.data?.error || err.message });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader title="My Account" description="Manage your profile, password, and preferences" />
      <div className="space-y-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Account Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600"><strong>Email:</strong> {user?.email}</p>
            {user?.full_name && <p className="text-sm text-slate-600 mt-1"><strong>Name:</strong> {user.full_name}</p>}
            {employee?.phone_number && <p className="text-sm text-slate-600 mt-1"><strong>Phone:</strong> {employee.phone_number}</p>}
          </CardContent>
        </Card>

        {(canEditProfile || superAdmin) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {superAdmin ? 'Display Name' : 'Profile'}
              </CardTitle>
              <p className="text-sm text-slate-500">
                {superAdmin ? 'Update your display name.' : 'Update your name, phone, and notification preferences.'}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={updateProfile} className="space-y-4">
                <div>
                  <Label>Display Name</Label>
                  <Input
                    value={profileForm.full_name}
                    onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="Your name"
                    maxLength={200}
                  />
                </div>
                {canEditProfile && (
                  <>
                    <div>
                      <Label>Phone Number</Label>
                      <Input
                        type="tel"
                        value={profileForm.phone_number}
                        onChange={e => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="font-medium">Email Reminders</Label>
                          <p className="text-xs text-slate-500">Get reminder emails for pending acknowledgments</p>
                        </div>
                        <Switch
                          checked={profileForm.email_reminders}
                          onCheckedChange={v => setProfileForm({ ...profileForm, email_reminders: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="font-medium">SMS Reminders</Label>
                          <p className="text-xs text-slate-500">Get text reminders (requires phone number)</p>
                        </div>
                        <Switch
                          checked={profileForm.sms_reminders}
                          onCheckedChange={v => setProfileForm({ ...profileForm, sms_reminders: v })}
                        />
                      </div>
                    </div>
                  </>
                )}
                {profileMsg && <p className={`text-sm ${profileMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{profileMsg.text}</p>}
                <Button type="submit" disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Update Profile'}</Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <Input type="password" value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} required />
              </div>
              <div>
                <Label>New Password</Label>
                <Input type="password" value={pwForm.new} onChange={e => setPwForm({ ...pwForm, new: e.target.value })} minLength={8} required />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} minLength={8} required />
              </div>
              {pwMsg && <p className={`text-sm ${pwMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{pwMsg.text}</p>}
              <Button type="submit" disabled={pwSaving}>{pwSaving ? 'Saving...' : 'Update Password'}</Button>
            </form>
          </CardContent>
        </Card>

        {canChangeEmail && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Change Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={changeEmail} className="space-y-4">
                <div>
                  <Label>New Email</Label>
                  <Input type="email" value={emailForm.new_email} onChange={e => setEmailForm({ ...emailForm, new_email: e.target.value })} required />
                </div>
                <div>
                  <Label>Current Password (to confirm)</Label>
                  <Input type="password" value={emailForm.password} onChange={e => setEmailForm({ ...emailForm, password: e.target.value })} required />
                </div>
                {emailMsg && <p className={`text-sm ${emailMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{emailMsg.text}</p>}
                <Button type="submit" disabled={emailSaving}>{emailSaving ? 'Saving...' : 'Update Email'}</Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <Button
              variant="outline"
              className="text-slate-600 hover:text-red-600 hover:bg-red-50"
              onClick={() => { logout(); navigate(createPageUrl('Login'), { replace: true }); }}
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone — Account Deletion (app store requirement) */}
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            {superAdmin ? (
              <p className="text-sm text-slate-500">
                Super admin accounts are managed via environment variables and cannot be deleted from the app.
              </p>
            ) : deleteStep === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Button
                  id="delete-account-start"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setDeleteStep(1)}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete My Account
                </Button>
              </div>
            ) : deleteStep === 1 ? (
              <div className="space-y-3">
                <div className="bg-red-100 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-red-800">⚠️ This will permanently:</p>
                  <ul className="text-sm text-red-700 mt-1 ml-4 list-disc space-y-0.5">
                    <li>Deactivate your employee profile</li>
                    <li>Remove your login credentials</li>
                    <li>Revoke all active sessions</li>
                  </ul>
                  <p className="text-sm text-red-700 mt-2">
                    Your acknowledgment and audit records will be preserved for compliance purposes.
                  </p>
                </div>
                <div>
                  <Label className="text-red-700">Type <strong>DELETE</strong> to confirm</Label>
                  <Input
                    id="delete-confirm-text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="border-red-300 focus:ring-red-500"
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    id="delete-account-next"
                    variant="destructive"
                    disabled={deleteConfirmText !== 'DELETE'}
                    onClick={() => setDeleteStep(2)}
                  >
                    Continue
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setDeleteStep(0); setDeleteConfirmText(''); setDeleteMsg(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-red-100 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-red-800">Final step: enter your password to confirm deletion.</p>
                </div>
                <div>
                  <Label className="text-red-700">Password</Label>
                  <Input
                    id="delete-account-password"
                    type="password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                    className="border-red-300 focus:ring-red-500"
                    autoComplete="current-password"
                  />
                </div>
                {deleteMsg && <p role="alert" className={`text-sm ${deleteMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{deleteMsg.text}</p>}
                <div className="flex gap-2">
                  <Button
                    id="delete-account-confirm"
                    variant="destructive"
                    disabled={deleting || !deletePassword}
                    onClick={handleDeleteAccount}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting ? 'Deleting...' : 'Permanently Delete Account'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setDeleteStep(0); setDeleteConfirmText(''); setDeletePassword(''); setDeleteMsg(null); }}
                  >
                    Cancel
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


