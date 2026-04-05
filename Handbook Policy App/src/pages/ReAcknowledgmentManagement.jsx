import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Send, Trash2 } from 'lucide-react';
import EmptyState from '../components/shared/EmptyState';

export default function ReAcknowledgmentManagement() {
  const { org } = useOrg();
  const [pendingReAcks, setPendingReAcks] = useState([]);
  const [selectedReAck, setSelectedReAck] = useState(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (org) loadData();
  }, [org]);

  async function loadData() {
    try {
      const result = await api.invoke('getAcknowledgementMatrix', {
        organization_id: org.id
      });
      
      // Flatten all pending re-acks from matrix (exclude archived policies)
      const allReAcks = [];
      (result.data?.matrix || []).forEach(row => {
        row.applicable_policies?.forEach(policy => {
          if (policy.needs_re_ack && policy.pending_re_ack && policy.status !== 'archived') {
            allReAcks.push({
              ...policy.pending_re_ack,
              employee_name: row.employee_name,
              employee_email: row.employee_email,
              employee_id: row.employee_id
            });
          }
        });
      });
      
      setPendingReAcks(allReAcks);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemind() {
    await api.invoke('sendPolicyReminders', {});
    alert('Reminder email sent for pending re-acknowledgments');
    setActionDialog(false);
  }

  async function handleClear() {
    if (!selectedReAck) return;
    
    try {
      // Delete the pending re-ack record
      await api.invoke('secureEntityWrite', {
        action: 'delete',
        entity_type: 'PendingReAcknowledgment',
        organization_id: org.id,
        entity_id: selectedReAck.id
      });
      
      loadData();
      setActionDialog(false);
      alert('Pending re-acknowledgment cleared');
    } catch (e) {
      console.error(e);
      alert('Failed to clear pending re-acknowledgment');
    }
  }

  if (loading) {
    return <div className="text-center py-20 text-sm text-slate-400">Loading...</div>;
  }

  if (pendingReAcks.length === 0) {
    return (
      <div>
        <PageHeader 
          title="Re-acknowledgment Management" 
          description="Manage pending policy re-acknowledgments"
        />
        <EmptyState 
          icon={AlertTriangle}
          title="No pending re-acknowledgments"
          description="All employees are up to date with policy acknowledgments."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Re-acknowledgment Management"
        description={`${pendingReAcks.length} pending re-acknowledgments`}
        actions={
          <Button onClick={() => { setActionType('remind'); setActionDialog(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Send className="w-4 h-4 mr-2" />
            Send Reminders
          </Button>
        }
      />

      <div className="space-y-3">
        {pendingReAcks.map(reAck => (
          <Card key={`${reAck.employee_id}-${reAck.policy_id}`} className="border-orange-200 bg-orange-50/20">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <div>
                      <h3 className="font-semibold text-slate-900">{reAck.policy_title}</h3>
                      <p className="text-xs text-slate-600">v{reAck.version_number} (was v{reAck.previous_version_number})</p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                      Re-ack Required
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 ml-8">
                    {reAck.employee_name} ({reAck.employee_email})
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedReAck(reAck);
                    setActionType('clear');
                    setActionDialog(true);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={actionDialog} onOpenChange={setActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'remind' ? 'Send Reminder Emails' : 'Clear Re-acknowledgment'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {actionType === 'remind' 
              ? 'Send reminder emails to all employees with pending re-acknowledgments?'
              : `Remove re-acknowledgment requirement for ${selectedReAck?.policy_title}?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(false)}>Cancel</Button>
            <Button 
              onClick={actionType === 'remind' ? handleRemind : handleClear}
              className={actionType === 'clear' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {actionType === 'remind' ? 'Send Reminders' : 'Clear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
