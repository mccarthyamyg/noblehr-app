import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LegalFooter from './LegalFooter';
import { useAuth } from '@/lib/AuthContext';

export default function LegalPageShell({ title, lastUpdated, children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const backHref = !isLoadingAuth && isAuthenticated ? '/' : '/Login';
  const backLabel = !isLoadingAuth && isAuthenticated ? 'Back to app' : 'Sign in';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            to={backHref}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {lastUpdated && (
          <p className="text-sm text-slate-500 mt-1 mb-8">Last updated: {lastUpdated}</p>
        )}
        <div className="prose-legal space-y-6 text-sm text-slate-700 leading-relaxed">
          {children}
        </div>
      </main>

      <LegalFooter className="border-t border-slate-200 bg-white mt-auto" />
    </div>
  );
}
