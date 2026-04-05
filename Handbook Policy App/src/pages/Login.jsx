import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { NobleHRWordmark } from '@/components/NobleHRLogo';
import LegalFooter from '@/components/legal/LegalFooter';

export default function Login() {
  const { login, loginWithGoogle, authError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) return;
    setGoogleLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate(createPageUrl('Dashboard'));
    } catch (err) {
      if (err?.needSignup) {
        navigate(createPageUrl('Setup'), { state: { googleEmail: err.email, googleName: err.full_name } });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      navigate(data?.superAdmin ? createPageUrl('SuperAdmin') : createPageUrl('Dashboard'));
    } catch {
      // authError set in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/60 via-white to-slate-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl shadow-blue-900/5 border-slate-200/80">
        <CardHeader className="text-center pb-2">
          <div className="mb-2">
            <NobleHRWordmark iconSize="w-20 h-20" textSize="text-3xl" />
          </div>
          <p className="text-slate-500 text-sm mt-2">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <Link to={createPageUrl('ForgotPassword')} className="text-xs text-blue-700 hover:underline">Forgot password?</Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-1"
              />
            </div>
            {authError && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <p>{typeof authError === 'object' ? authError.text : authError}</p>
                {typeof authError === 'object' && authError.link && (
                  <Link to={createPageUrl(authError.link)} className="block mt-2 text-blue-700 hover:underline">Request approval again →</Link>
                )}
                {typeof authError === 'object' && authError.code === 'email_not_verified' && (
                  <div className="mt-2">
                    {resendSent ? (
                      <p className="text-green-600">Verification email sent. Check your inbox.</p>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={resendLoading || !email}
                        onClick={async () => {
                          setResendLoading(true);
                          try {
                            await api.auth.resendVerification(email);
                            setResendSent(true);
                          } catch (_) {}
                          setResendLoading(false);
                        }}
                      >
                        {resendLoading ? 'Sending...' : 'Resend verification email'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            <Button type="submit" className="w-full bg-[#1d4ed8] hover:bg-[#1e3a8a] text-white shadow-lg shadow-blue-700/20" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-slate-500">Or continue with</span>
                  </div>
                </div>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setGoogleLoading(false)}
                    use_fedcm_for_prompt
                    theme="filled_black"
                    size="large"
                    text="signin_with"
                    shape="rectangular"
                    width="320"
                  />
                </div>
                {googleLoading && (
                  <p className="text-center text-sm text-slate-500">Signing in with Google...</p>
                )}
              </>
            )}
          </form>
          <p className="text-center text-sm text-slate-500 mt-4 space-y-1">
            <span className="block">New? <Link to={createPageUrl('Setup')} className="text-blue-700 hover:underline font-medium">Set up your organization</Link></span>
            <span className="block"><Link to={createPageUrl('ForgotEmail')} className="text-blue-700 hover:underline">Forgot email?</Link></span>
          </p>
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <a
              href="/demo.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-blue-600 transition-colors group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">🎬</span>
              <span>View Platform Demo</span>
              <svg className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
        </CardContent>
      </Card>
      </div>
      <LegalFooter className="bg-white/60 border-t border-slate-200/80 backdrop-blur-sm" />
    </div>
  );
}

