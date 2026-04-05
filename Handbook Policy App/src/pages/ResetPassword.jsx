import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

const RESET_TOKEN_KEY = 'noblehr_reset_token';

export default function ResetPassword() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  const [token, setToken] = useState(() => tokenFromUrl || sessionStorage.getItem(RESET_TOKEN_KEY));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  // Store token and remove from URL to avoid Referer/history leaks
  React.useEffect(() => {
    if (tokenFromUrl) {
      sessionStorage.setItem(RESET_TOKEN_KEY, tokenFromUrl);
      setToken(tokenFromUrl);
      setSearchParams({}, { replace: true });
    }
  }, [tokenFromUrl, setSearchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.account.resetPassword(token, password);
      sessionStorage.removeItem(RESET_TOKEN_KEY);
      setDone(true);
    } catch (err) {
      setError(err.data?.error || err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Link</CardTitle>
            <p className="text-slate-500 text-sm">No reset token provided.</p>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={createPageUrl('Login')}>Go to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Password Reset</CardTitle>
            <p className="text-slate-500 text-sm">Your password has been updated. You can now sign in.</p>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={createPageUrl('Login')}>Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set New Password</CardTitle>
          <p className="text-slate-500 text-sm">Enter your new password (min 8 characters).</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>New Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={8} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">{loading ? 'Resetting...' : 'Reset Password'}</Button>
            <Button type="button" variant="ghost" className="w-full mt-2" asChild>
              <Link to={createPageUrl('Login')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
              </Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

