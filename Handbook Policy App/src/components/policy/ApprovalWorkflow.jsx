import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { api } from '@/api/client';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

export default function ApprovalWorkflow({ policy, onStatusChange, currentUser }) {
  const [approvals, setApprovals] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const needsApproval = policy?.status === 'pending_approval';
  const isApprover = currentUser?.permission_level === 'org_admin';

  useEffect(() => {
    if (policy?.id) {
      loadApprovals();
    }
  }, [policy?.id]);

  async function loadApprovals() {
    const approvalRecords = await base44.entities.SystemEvent.filter({
      organization_id: policy.organization_id,
      entity_id: policy.id,
      event_type: 'policy.approval'
    });
    setApprovals(approvalRecords);
  }

  async function handleApprove() {
    setLoading(true);
    try {
      // REMOVED: Direct status mutation to 'active' is now BLOCKED
      // Approval workflow only marks for approval, actual publishing must go through publishPolicy()
      
      await api.invoke('createSystemEvent', {
        organization_id: policy.organization_id,
        event_type: 'policy.approval',
        entity_type: 'Policy',
        entity_id: policy.id,
        actor_email: currentUser?.user_email || currentUser?.email,
        actor_name: currentUser?.full_name,
        summary: `${currentUser?.full_name || 'User'} approved policy "${policy.title}" - ready to publish`,
        metadata: { action: 'approved', comment: comment || null }
      });

      // Policy remains in pending_approval state - admin must explicitly publish via Publish button
      alert('Policy approved! Use the Publish button to create an immutable version and activate.');
      onStatusChange?.('pending_approval');
    } catch (error) {
      alert('Failed to approve policy');
    } finally {
      setLoading(false);
      setComment('');
    }
  }

  async function handleReject() {
    setLoading(true);
    try {
      await api.invoke('updatePolicy', { policy_id: policy.id, organization_id: policy.organization_id, status: 'draft' });
      await api.invoke('createSystemEvent', {
        organization_id: policy.organization_id,
        event_type: 'policy.approval',
        entity_type: 'Policy',
        entity_id: policy.id,
        actor_email: currentUser?.user_email || currentUser?.email,
        actor_name: currentUser?.full_name,
        summary: `${currentUser?.full_name || 'User'} rejected policy "${policy.title}"`,
        metadata: { action: 'rejected', comment: comment || null }
      });

      onStatusChange?.('draft');
    } catch (error) {
      alert('Failed to reject policy');
    } finally {
      setLoading(false);
      setComment('');
    }
  }

  async function handleRequestApproval() {
    setLoading(true);
    try {
      await api.invoke('updatePolicy', { policy_id: policy.id, organization_id: policy.organization_id, status: 'pending_approval' });
      await api.invoke('createSystemEvent', {
        organization_id: policy.organization_id,
        event_type: 'policy.approval',
        entity_type: 'Policy',
        entity_id: policy.id,
        actor_email: currentUser?.user_email || currentUser?.email,
        actor_name: currentUser?.full_name,
        summary: `${currentUser?.full_name || 'User'} requested approval for policy "${policy.title}"`
      });

      onStatusChange?.('pending_approval');
    } catch (error) {
      alert('Failed to request approval');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {needsApproval ? (
            <>
              <Clock className="w-5 h-5 text-amber-600" />
              Pending Approval
            </>
          ) : policy?.status === 'active' ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Approved & Active
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-slate-600" />
              Draft Status
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {needsApproval && isApprover && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              This policy is awaiting your approval before it can be published.
            </p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add approval comments (optional)..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={handleReject}
                disabled={loading}
                variant="destructive"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        )}

        {policy?.status === 'draft' && !isApprover && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Submit this policy for admin approval before publishing.
            </p>
            <Button
              onClick={handleRequestApproval}
              disabled={loading}
              className="w-full"
            >
              <Clock className="w-4 h-4 mr-2" />
              Request Approval
            </Button>
          </div>
        )}

        {approvals.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <p className="text-sm font-medium text-slate-700">Approval History</p>
            {approvals.map((approval) => (
              <div key={approval.id} className="flex items-start gap-3 text-sm">
                {approval.metadata?.action === 'approved' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900">{approval.summary}</p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(approval.created_at || approval.created_date), 'MMM d, yyyy h:mm a')}
                  </p>
                  {approval.metadata?.comment && (
                    <p className="text-slate-600 mt-1 italic">"{approval.metadata.comment}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}