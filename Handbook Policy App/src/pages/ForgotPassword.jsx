import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.account.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.data?.error || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot Password</CardTitle>
          <p className="text-slate-500 text-sm mt-1">
            {sent ? 'If that email exists, you will receive a reset link shortly.' : 'Enter your email and we\'ll send you a reset link.'}
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <Button variant="outline" asChild>
              <Link to={createPageUrl('Login')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
              </Link>
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">{loading ? 'Sending...' : 'Send Reset Link'}</Button>
              <Button type="button" variant="ghost" className="w-full" asChild>
                <Link to={createPageUrl('Login')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
                </Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
