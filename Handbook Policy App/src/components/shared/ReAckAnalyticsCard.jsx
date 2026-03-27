import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from 'lucide-react';

export default function ReAckAnalyticsCard({ organizationId }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const result = await api.invoke('getAdminContext', {
          organization_id: organizationId
        });
        setMetrics(result.data);
      } catch (e) {
        console.error('Error loading re-ack metrics:', e);
      } finally {
        setLoading(false);
      }
    }
    
    if (organizationId) loadMetrics();
  }, [organizationId]);

  if (loading) return null;
  if (!metrics) return null;

  const complianceColor = metrics.reAckCompliancePercent >= 80 ? 'text-green-600' : 
                         metrics.reAckCompliancePercent >= 50 ? 'text-yellow-600' : 
                         'text-red-600';

  return (
    <Card className={metrics.pendingReAckCount > 0 ? 'border-orange-200 bg-orange-50/20' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {metrics.pendingReAckCount > 0 && <AlertTriangle className="w-4 h-4 text-orange-600" />}
          <span>Policy Compliance</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 mb-1">Pending Re-acknowledgments</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.pendingReAckCount}</p>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.employeesWithPendingReAcks} of {metrics.totalActiveEmployees} employees
            </p>
          </div>
          
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Compliance Rate</p>
              <span className={`text-lg font-bold ${complianceColor}`}>
                {metrics.reAckCompliancePercent}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  metrics.reAckCompliancePercent >= 80 ? 'bg-green-500' :
                  metrics.reAckCompliancePercent >= 50 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${metrics.reAckCompliancePercent}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}