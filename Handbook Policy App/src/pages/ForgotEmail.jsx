import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function ForgotEmail() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-slate-600" />
          </div>
          <CardTitle>Forgot Email?</CardTitle>
          <p className="text-slate-500 text-sm mt-1">
            Contact your organization administrator to recover your account email. If you signed up and your organization was rejected, you can <Link to={createPageUrl('RequestApprovalAgain')} className="text-indigo-600 hover:underline">request approval again</Link>.
          </p>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
            <Link to={createPageUrl('Login')}>Back to Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
