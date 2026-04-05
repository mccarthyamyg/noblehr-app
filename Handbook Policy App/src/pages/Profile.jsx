import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '../utils';
import PageHeader from '../components/shared/PageHeader';
import { User, Lock, Mail, LogOut } from 'lucide-react';
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
      </div>
    </div>
  );
}

