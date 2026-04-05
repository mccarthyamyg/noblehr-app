import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { createPageUrl } from '../utils';
import { Loader2 } from 'lucide-react';

/**
 * Launch page: accepts ?token=xxx from super admin launch link.
 * Stores token and redirects to Dashboard. The token has impersonateOrgId,
 * so /me will return that org's context.
 */
export default function Launch() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      window.location.href = createPageUrl('Login');
      return;
    }
    // Remove token from URL immediately to avoid Referer/history leaks
    window.history.replaceState(null, '', window.location.pathname);
    api.auth.setLaunchCookie(token).then(() => {
      window.location.replace(createPageUrl('Dashboard'));
    }).catch(() => {
      window.location.href = createPageUrl('Login');
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-noble animate-spin" />
        <p className="text-sm text-slate-500">Launching...</p>
      </div>
    </div>
  );
}

