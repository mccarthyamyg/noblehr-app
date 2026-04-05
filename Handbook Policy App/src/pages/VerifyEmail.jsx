import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No verification token provided.');
      return;
    }
    api.auth
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setError(err.data?.error || err.message || 'Verification failed.');
      });
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-noble animate-spin" />
            <p className="text-slate-500">Verifying your email...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <CardTitle className="text-xl">Email verified</CardTitle>
            <p className="text-slate-500 text-sm mt-1">Your account is active. You can now sign in.</p>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <Link to={createPageUrl('Login')}>Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-7 h-7 text-red-600" />
          </div>
          <CardTitle className="text-xl">Verification failed</CardTitle>
          <p className="text-slate-500 text-sm mt-1">{error}</p>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild variant="outline" className="w-full">
            <Link to={createPageUrl('Login')}>
              <Mail className="w-4 h-4 mr-2" />
              Back to sign in (you can resend the link there)
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

