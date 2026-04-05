import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '@/api/client';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Mail, Loader2 } from 'lucide-react';

export default function InviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState(null);
  const [requireVerification, setRequireVerification] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invite token provided');
      setLoading(false);
      return;
    }
    // Remove token from URL to avoid Referer/history leaks
    const params = new URLSearchParams(window.location.search);
    params.delete('token');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    api.invites
      .validate(token)
      .then((data) => {
        setInvite(data);
        setFullName(data.full_name || '');
      })
      .catch((err) => {
        setError(err.data?.error || err.message || 'Invalid or expired invite');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleGoogleSuccess = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const data = await api.invites.accept({ token, credential });
      if (data.requireVerification) {
        setRequireVerification(true);
      } else {
        navigate(createPageUrl('Dashboard'));
        window.location.reload();
      }
    } catch (err) {
      setAcceptError(err.data?.error || err.message || 'Accept failed');
    } finally {
      setAccepting(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setAcceptError('Password must be at least 8 characters');
      return;
    }
    setAccepting(true);
    setAcceptError(null);
    try {
      const data = await api.invites.accept({ token, password, full_name: fullName || invite?.email });
      if (data.requireVerification) {
        setRequireVerification(true);
      } else {
        navigate(createPageUrl('Dashboard'));
        window.location.reload();
      }
    } catch (err) {
      setAcceptError(err.data?.error || err.message || 'Accept failed');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-noble animate-spin" />
          <p className="text-slate-500">Validating invite...</p>
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-red-600" />
            </div>
            <CardTitle className="text-xl">Invalid Invite</CardTitle>
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

  if (requireVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-green-600" />
            </div>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <p className="text-slate-500 text-sm mt-1">Check your email to verify your account before logging in.</p>
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-noble to-noble-dark flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Join {invite.org_name}</CardTitle>
          <p className="text-slate-500 text-sm mt-1">You've been invited to join as an employee</p>
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-slate-600">
            <Mail className="w-4 h-4" />
            <span>{invite.email}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {acceptError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{acceptError}</p>
          )}

          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setAccepting(false)}
                  use_fedcm_for_prompt
                  theme="filled_black"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                  width="320"
                  disabled={accepting}
                />
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-500">Or create a password</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                disabled={accepting}
              />
            </div>
            <div className="space-y-2">
              <Label>Create Password (min 8 characters)</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                disabled={accepting}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-noble hover:bg-noble-dark"
              disabled={accepting || !password}
            >
              {accepting ? 'Joining...' : 'Join with Email'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

