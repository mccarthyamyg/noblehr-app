import React, { useState, useEffect } from 'react';
import { Bell, Shield, Info, Check, Loader2 } from 'lucide-react';
import { api } from '@/api/client';
import { useOrg } from '@/components/hooks/useOrganization';

const NOTIFICATION_TYPE_LABELS = {
  policy_published: { label: 'New Policy Published', description: 'Get notified when a new policy is published or an existing policy is updated' },
  acknowledgment_reminder: { label: 'Acknowledgment Reminder', description: 'Reminders to acknowledge policies that require your signature' },
  hr_record_created: { label: 'New HR Record', description: 'Get notified when an HR record (write-up, commendation, etc.) is created for you' },
  incident_update: { label: 'Incident Report Update', description: 'Updates on incident reports you\'re involved in or managing' },
  onboarding_assigned: { label: 'Onboarding Assignment', description: 'Notification when new onboarding tasks are assigned to you' },
};

const DELIVERY_OPTIONS = [
  { value: 'immediate', label: 'Immediate', icon: '⚡' },
  { value: 'daily_digest', label: 'Daily Digest', icon: '📋' },
  { value: 'off', label: 'Off', icon: '🔕' },
];

function DeliveryToggle({ value, onChange, saving }) {
  return (
    <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
      {DELIVERY_OPTIONS.map(opt => (
        <button
          key={opt.value}
          disabled={saving}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            value === opt.value
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className="text-xs">{opt.icon}</span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

function PreferenceRow({ type, delivery, isOverride, onUpdate, saving }) {
  const meta = NOTIFICATION_TYPE_LABELS[type] || { label: type, description: '' };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-slate-100 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">{meta.label}</h4>
          {isOverride && (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
              Custom
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
      </div>
      <div className="flex-shrink-0">
        <DeliveryToggle value={delivery} onChange={(val) => onUpdate(type, val)} saving={saving} />
      </div>
    </div>
  );
}

export default function NotificationSettings() {
  const { employee } = useOrg();
  const isAdmin = employee?.permission_level === 'org_admin';

  const [prefs, setPrefs] = useState([]);
  const [orgDefaults, setOrgDefaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('personal');

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    setLoading(true);
    setError(null);
    try {
      const [prefsRes, defaultsRes] = await Promise.all([
        api.notifications.getPreferences(),
        isAdmin ? api.notifications.getOrgDefaults() : Promise.resolve({ data: [] }),
      ]);
      setPrefs(prefsRes.data || []);
      setOrgDefaults(defaultsRes.data || []);
    } catch (e) {
      console.error('Failed to load notification preferences:', e);
      setError(e.message || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePref(type, delivery) {
    setSaving(type);
    setSaveSuccess(null);
    try {
      await api.notifications.updatePreference(type, delivery);
      setPrefs(prev => prev.map(p =>
        p.notification_type === type ? { ...p, delivery, is_override: true } : p
      ));
      setSaveSuccess(type);
      setTimeout(() => setSaveSuccess(null), 2000);
    } catch (e) {
      console.error('Failed to update preference:', e);
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(null);
    }
  }

  async function handleUpdateOrgDefault(type, delivery) {
    setSaving(`org_${type}`);
    setSaveSuccess(null);
    try {
      await api.notifications.updateOrgDefault(type, delivery);
      setOrgDefaults(prev => prev.map(d =>
        d.notification_type === type ? { ...d, delivery } : d
      ));
      setSaveSuccess(`org_${type}`);
      setTimeout(() => setSaveSuccess(null), 2000);
    } catch (e) {
      console.error('Failed to update org default:', e);
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notification Settings</h1>
          <p className="text-sm text-slate-500">Control how you receive email notifications</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700 font-medium">Dismiss</button>
        </div>
      )}

      {/* Tab switcher (admin only) */}
      {isAdmin && (
        <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setTab('personal')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'personal'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            My Notifications
          </button>
          <button
            onClick={() => setTab('org')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === 'org'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Org Defaults
            </div>
          </button>
        </div>
      )}

      {/* Personal Preferences */}
      {tab === 'personal' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Your Notification Preferences</h2>
            <p className="text-xs text-slate-500 mt-1">
              Choose how you'd like to be notified for each event type. These override your organization's defaults.
            </p>
          </div>
          <div className="px-5 py-2">
            {prefs.map(p => (
              <PreferenceRow
                key={p.notification_type}
                type={p.notification_type}
                delivery={p.delivery}
                isOverride={p.is_override}
                onUpdate={handleUpdatePref}
                saving={saving === p.notification_type}
              />
            ))}
          </div>
          <div className="px-5 py-3 bg-slate-50 rounded-b-xl border-t border-slate-100">
            <div className="flex items-start gap-2 text-xs text-slate-500">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Immediate</strong> sends an email right away. <strong>Daily Digest</strong> batches
                notifications into a daily summary. <strong>Off</strong> disables email for that type entirely.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Org Defaults (admin only) */}
      {tab === 'org' && isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-800">Organization Defaults</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Set default notification preferences for all employees. Individual employees can override these in their own settings.
            </p>
          </div>
          <div className="px-5 py-2">
            {orgDefaults.map(d => (
              <PreferenceRow
                key={d.notification_type}
                type={d.notification_type}
                delivery={d.delivery}
                isOverride={false}
                onUpdate={handleUpdateOrgDefault}
                saving={saving === `org_${d.notification_type}`}
              />
            ))}
          </div>
          <div className="px-5 py-3 bg-blue-50/50 rounded-b-xl border-t border-blue-100/50">
            <div className="flex items-start gap-2 text-xs text-blue-700">
              <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                These are the defaults for new employees who haven't customized their preferences.
                Existing employees who have set custom preferences will not be affected.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Save indicator */}
      {saveSuccess && (
        <div className="fixed bottom-24 lg:bottom-8 right-8 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-bottom-2 z-50">
          <Check className="w-4 h-4" />
          Preference saved
        </div>
      )}
    </div>
  );
}
