import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import { createPageUrl } from '../utils';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { ArrowLeft, CheckCircle2, Shield } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function PolicyView() {
  const { org, employee } = useOrg();
  const [policy, setPolicy] = useState(null);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [ack, setAck] = useState(null);
  const [pendingReAck, setPendingReAck] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const policyId = params.get('id');

  useEffect(() => {
    if (!org || !policyId) return;
    loadPolicy();
  }, [org, policyId]);

  async function loadPolicy() {
    const result = await api.invoke('getPolicyForEmployee', {
      organization_id: org.id,
      policy_id: policyId
    });

    if (!result.data || result.data.error) {
      window.location.href = createPageUrl('Policies');
      return;
    }

    const { policy: loadedPolicy, currentVersion: cv, acknowledgment, pending_re_acknowledgment, location: loc } = result.data;

    setPolicy(loadedPolicy);
    setCurrentVersion(cv || null);
    setLocation(loc || null);
    setPendingReAck(pending_re_acknowledgment || null);

    if (acknowledgment && cv && acknowledgment.policy_version_id === cv.id) {
      setAck(acknowledgment);
    }

    setLoading(false);
  }

  // Now using shared policyTargeting utility

  async function handleAcknowledge() {
    setAcknowledging(true);

    // HARDENED: Use new createSecureAcknowledgment function
    // Validates policy applies to employee + is published server-side
    const result = await api.invoke('createSecureAcknowledgment', {
      organization_id: org.id,
      policy_id: policy.id,
      employee_id: employee.id
    });

    if (!result.data?.success) {
      alert(result.data?.error || 'Failed to record acknowledgment. Please try again.');
      setAcknowledging(false);
      return;
    }

    setConfirmDialog(false);
    setAcknowledging(false);
    await loadPolicy();
  }

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading policy...</div>;
  if (!policy) return <div className="text-center py-20 text-sm text-slate-500">Policy not found</div>;

  return (
    <div>
      <PageHeader
        title={policy.title}
        description={`Version ${currentVersion?.version_number || 1} · ${format(new Date(policy.created_date), 'MMMM d, yyyy')}`}
        actions={
          <Link to={createPageUrl('Policies')}>
            <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          </Link>
        }
      />

      <div className="flex items-center gap-2 mb-6">
        <StatusBadge status={policy.status} />
        {policy.tags?.map(t => (
          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
        ))}
      </div>

      <Card className="mb-6">
        <CardContent className="p-6 lg:p-8">
          {policy.description && (
            <p className="text-sm text-slate-600 mb-6 pb-6 border-b border-slate-100">{policy.description}</p>
          )}
          <style dangerouslySetInnerHTML={{ __html: `
            /* Nuclear option: disable ALL scrolling in policy content */
            .policy-content-wrapper,
            .policy-content-wrapper *,
            .prose,
            .prose * {
              overflow: visible !important;
              -webkit-overflow-scrolling: auto !important;
              max-height: none !important;
            }
            
            /* Hide ALL webkit scrollbar elements */
            .policy-content-wrapper *::-webkit-scrollbar,
            .prose *::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
              -webkit-appearance: none !important;
            }
            
            .policy-content-wrapper *::-webkit-scrollbar-button,
            .prose *::-webkit-scrollbar-button {
              display: none !important;
              height: 0 !important;
              width: 0 !important;
            }
          `}} />
          <div
            className="policy-content-wrapper prose prose-sm prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentVersion?.content || '<p>No content available.</p>') }}
          />
        </CardContent>
      </Card>

      {/* Acknowledgment section */}
      {policy.acknowledgment_required && (
        <Card className={pendingReAck ? 'border-orange-200 bg-orange-50/30' : ack ? 'border-emerald-200 bg-emerald-50/30' : 'border-indigo-200 bg-indigo-50/30'}>
          <CardContent className="p-6">
            {pendingReAck ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-sm font-semibold text-orange-800">Re-acknowledgment Required</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      A new version of this policy has been published. Please review and acknowledge v{pendingReAck.version_number}.
                    </p>
                  </div>
                </div>
                <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => setConfirmDialog(true)}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Re-acknowledge
                </Button>
              </div>
            ) : ack ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">You acknowledged this policy</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {format(new Date(ack.acknowledged_at || ack.created_date), 'MMMM d, yyyy \'at\' h:mm a')}
                      {ack.version_number && ` · Version ${ack.version_number}`}
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-emerald-200">
                  <p className="text-xs font-medium text-emerald-900 mb-1">🔒 Immutable Acknowledgment Record</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-emerald-700">
                    <div><span className="font-medium">Role at time:</span> {ack.employee_role_at_time || 'N/A'}</div>
                    <div><span className="font-medium">Location at time:</span> {ack.employee_location_at_time || 'N/A'}</div>
                  </div>
                  <p className="text-xs text-emerald-600 mt-2 italic">
                    This acknowledgment is part of the permanent governance ledger and cannot be modified or deleted.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-sm font-semibold text-indigo-800">
                      Acknowledgment Required
                    </p>
                    <p className="text-xs text-indigo-600 mt-0.5">
                      Please review the policy above and confirm your acknowledgment${policy.acknowledgment_deadline ? ` by ${format(new Date(policy.acknowledgment_deadline), 'MMMM d, yyyy')}` : ''}
                    </p>
                  </div>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setConfirmDialog(true)}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Acknowledge
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingReAck ? 'Confirm Re-acknowledgment' : 'Confirm Acknowledgment'}</DialogTitle>
            <DialogDescription>
              By acknowledging, you confirm that you have read and understood the policy "{policy.title}" (Version {currentVersion?.version_number}).
              This action is recorded and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-xs font-medium text-amber-900 mb-2">⚠️ Governance Ledger Record</p>
            <p className="text-xs text-amber-700">
              This acknowledgment will be permanently recorded in the governance ledger with your identity, role, location, and timestamp. 
              It cannot be edited or deleted after submission.
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-1">
            <p><strong>Employee:</strong> {employee?.full_name}</p>
            <p><strong>Role:</strong> {employee?.role || 'N/A'}</p>
            <p><strong>Location:</strong> {location?.name || 'N/A'}</p>
            <p><strong>Date:</strong> {format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
            <p><strong>Policy Version:</strong> {currentVersion?.version_number}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(false)}>Cancel</Button>
            <Button className={pendingReAck ? "bg-orange-600 hover:bg-orange-700" : "bg-indigo-600 hover:bg-indigo-700"} onClick={handleAcknowledge} disabled={acknowledging}>
              {acknowledging ? 'Recording...' : pendingReAck ? 'I Re-acknowledge & Accept' : 'I Acknowledge & Accept'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}