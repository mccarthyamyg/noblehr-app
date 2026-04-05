import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { api } from '@/api/client';
import { useOrg } from '../components/hooks/useOrganization';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, FileText, Calendar, AlertCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function MyOnboardingPage() {
  const { org, employee } = useOrg();
  const [onboarding, setOnboarding] = useState(null);
   const [policies, setPolicies] = useState([]);
   const [selectedPolicy, setSelectedPolicy] = useState(null);
   const [viewDialog, setViewDialog] = useState(false);
   const [pendingReAcks, setPendingReAcks] = useState({});
   const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (org && employee) loadData();
  }, [org, employee]);

  async function loadData() {
     const [result, myAcksResult] = await Promise.all([
       api.invoke('getMyOnboarding', { organization_id: org.id }),
       api.invoke('getMyAcknowledgments', { organization_id: org.id })
     ]);
     setOnboarding(result.data?.onboarding || null);
     // Filter out archived policies
     const activePolicies = (result.data?.policies || []).filter(p => p.status !== 'archived');
     setPolicies(activePolicies);

     // Map pending re-acks by policy_id for quick lookup
     const reAckMap = {};
     (myAcksResult.data?.pending_re_acknowledgments || []).forEach(reAck => {
       reAckMap[reAck.policy_id] = reAck;
     });
     setPendingReAcks(reAckMap);

     setLoading(false);
   }

  async function acknowledgePolicy(policy) {
    const result = await api.invoke('createSecureAcknowledgment', {
      organization_id: org.id,
      policy_id: policy.id,
      employee_id: employee.id
    });

    if (!result.data?.success) {
      alert(result.data?.error || 'Failed to record acknowledgment.');
      return;
    }

    // Update onboarding progress server-side via secureEntityWrite
    const newCompletedIds = [...(onboarding.completed_policy_ids || []), policy.id];
    const isComplete = newCompletedIds.length === onboarding.assigned_policy_ids.length;

    await api.invoke('secureEntityWrite', {
      action: 'update',
      entity_type: 'Onboarding',
      organization_id: org.id,
      entity_id: onboarding.id,
      data: {
        completed_policy_ids: newCompletedIds,
        status: isComplete ? 'completed' : 'in_progress',
        completed_date: isComplete ? format(new Date(), 'yyyy-MM-dd') : null
      }
    });

    setViewDialog(false);
    setSelectedPolicy(null);
    loadData();
  }

  if (loading) return <div className="text-center py-20 text-sm text-slate-400">Loading...</div>;

  if (!onboarding) {
    return (
      <div>
        <PageHeader title="My Onboarding" description="Complete your onboarding requirements" />
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-slate-600">You don't have any pending onboarding tasks.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = ((onboarding.completed_policy_ids?.length || 0) / onboarding.assigned_policy_ids.length) * 100;
  const daysRemaining = differenceInDays(new Date(onboarding.due_date), new Date());
  const isOverdue = daysRemaining < 0;

  return (
    <div>
      <PageHeader
        title="My Onboarding"
        description="Complete your required policy acknowledgments"
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Onboarding Progress</h3>
              <p className="text-sm text-slate-600">
                {onboarding.completed_policy_ids?.length || 0} of {onboarding.assigned_policy_ids.length} policies acknowledged
              </p>
            </div>
            <Badge variant={isOverdue ? 'destructive' : 'outline'}>
              <Calendar className="w-3 h-3 mr-1" />
              Due: {format(new Date(onboarding.due_date), 'MMM d, yyyy')}
            </Badge>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-3 mb-2">
            <div 
              className="bg-indigo-600 h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {isOverdue && (
            <div className="flex items-center gap-2 text-sm text-red-600 mt-3">
              <AlertCircle className="w-4 h-4" />
              Your onboarding is overdue by {Math.abs(daysRemaining)} days
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {policies.map(policy => {
          const isCompleted = onboarding.completed_policy_ids?.includes(policy.id);
          const needsReAck = pendingReAcks[policy.id];
          const buttonText = needsReAck ? 'Review Updated Policy' : 'Review & Acknowledge';

          return (
            <Card key={policy.id} className={`${isCompleted && !needsReAck ? 'opacity-60' : ''} ${needsReAck ? 'border-orange-200 bg-orange-50/20' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {needsReAck ? (
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-slate-400" />
                      )}
                      <h3 className="font-semibold text-slate-900">{policy.title}</h3>
                      {needsReAck && (
                        <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                          Re-acknowledgment Required
                        </Badge>
                      )}
                      {isCompleted && !needsReAck && (
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                          Acknowledged
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 ml-8">{policy.description}</p>
                  </div>

                  {(!isCompleted || needsReAck) && (
                    <Button
                      onClick={() => {
                        setSelectedPolicy(policy);
                        setViewDialog(true);
                      }}
                      className={needsReAck ? 'bg-orange-600 hover:bg-orange-700' : ''}
                    >
                      {buttonText}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedPolicy?.title}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-96 prose prose-sm">
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedPolicy?.currentVersion?.content || '') }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialog(false)}>Cancel</Button>
            <Button 
              className="bg-noble hover:bg-noble-dark"
              onClick={() => acknowledgePolicy(selectedPolicy)}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              I Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
