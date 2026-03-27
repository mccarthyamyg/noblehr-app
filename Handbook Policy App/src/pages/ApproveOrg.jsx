import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Check, X, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ApproveOrg() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('No approval token provided');
      setLoading(false);
      return;
    }
    // Remove token from URL to avoid Referer/history leaks
    const params = new URLSearchParams(window.location.search);
    params.delete('token');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    fetch(`${API_BASE}/auth/approve-org/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAction(action) {
    setActionLoading(action);
    try {
      const res = await fetch(`${API_BASE}/auth/approve-org`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setResult(d.status);
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error && !data?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <X className="w-7 h-7 text-red-600" />
            </div>
            <CardTitle>Invalid or Expired Link</CardTitle>
            <p className="text-slate-500 text-sm mt-1">{error}</p>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => (window.location.href = createPageUrl('Login'))}>
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${result === 'active' ? 'bg-green-100' : 'bg-red-100'}`}>
              {result === 'active' ? <Check className="w-7 h-7 text-green-600" /> : <X className="w-7 h-7 text-red-600" />}
            </div>
            <CardTitle>{result === 'active' ? 'Organization Approved' : 'Organization Rejected'}</CardTitle>
            <p className="text-slate-500 text-sm mt-1">
              {result === 'active' ? 'The organization can now sign in.' : 'The organization has been rejected. They can request approval again.'}
            </p>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => (window.location.href = createPageUrl('Login'))}>Go to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data?.status && data.status !== 'pending_approval') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{data.message || `Already ${data.status}`}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => (window.location.href = createPageUrl('Login'))}>Go to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <CardTitle>Approve Organization</CardTitle>
          <p className="text-slate-500 text-sm mt-1">Review and approve or deny this signup request</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-4 space-y-2">
            <p><strong>Organization:</strong> {data?.org_name}</p>
            <p><strong>Admin:</strong> {data?.admin_name || data?.admin_email} ({data?.admin_email})</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleAction('approve')}
              disabled={!!actionLoading}
            >
              {actionLoading === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Approve
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleAction('deny')}
              disabled={!!actionLoading}
            >
              {actionLoading === 'deny' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
              Deny
            </Button>
          </div>
          <p className="text-xs text-slate-500 text-center">
            This link expires in 7 days. If denied, they must request approval again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
