import React, { useState } from 'react';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function RequestApprovalAgain() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/request-approval-again`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Request Approval Again</CardTitle>
          <p className="text-slate-500 text-sm mt-1">
            {sent
              ? 'Your request has been sent. You will receive an email when approved.'
              : 'Your organization was rejected. Enter your admin email to request approval again. You can only request once per hour.'}
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <Button onClick={() => (window.location.href = createPageUrl('Login'))}>Go to Sign In</Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Your Admin Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">{loading ? 'Sending...' : 'Request Approval'}</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => (window.location.href = createPageUrl('Login'))}>
                Back to Sign In
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

