import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Server-side acknowledgement matrix.
 * 
 * Inlines the policy applicability logic (same algorithm as getApplicablePolicies)
 * rather than calling it N times per employee — avoids N network calls at scale.
 * 
 * All data fetched in a single parallel batch, then computed in memory.
 */

function policyAppliesToEmployee(policy, employee, overrides) {
  // Employee-specific override takes highest priority
  const employeeOverride = overrides.find(o =>
    o.policy_id === policy.id && o.override_type === 'employee' && o.employee_id === employee.id
  );
  if (employeeOverride) return employeeOverride.applies;

  // Role-specific override
  const roleOverride = overrides.find(o =>
    o.policy_id === policy.id && o.override_type === 'role' && o.role === employee.role
  );
  if (roleOverride) return roleOverride.applies;

  // Location-specific override
  const locationOverride = overrides.find(o =>
    o.policy_id === policy.id && o.override_type === 'location' && o.location_id === employee.location_id
  );
  if (locationOverride) return locationOverride.applies;

  // Default targeting logic — AND: employee must satisfy ALL non-empty criteria
  if (!policy.applies_to) return true;
  const { all_employees, roles, departments, locations, tags } = policy.applies_to;
  if (all_employees) return true;
  if (!roles?.length && !departments?.length && !locations?.length && !tags?.length) return true;
  if (roles?.length && !roles.includes(employee.role)) return false;
  if (departments?.length && !departments.includes(employee.department)) return false;
  if (locations?.length && !locations.includes(employee.location_id)) return false;
  if (tags?.length && !employee.tags?.some(t => tags.includes(t))) return false;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organization_id } = await req.json();

    if (!organization_id) {
      return Response.json({ error: 'organization_id required' }, { status: 400 });
    }

    const callers = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (callers.length === 0 || (callers[0].permission_level !== 'org_admin' && callers[0].permission_level !== 'manager')) {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    // Fetch ALL data in a single parallel batch — no per-employee calls
    const [employees, policies, overrides, acknowledgments, pendingReAcks] = await Promise.all([
      base44.asServiceRole.entities.Employee.filter({ organization_id, status: 'active' }),
      base44.asServiceRole.entities.Policy.filter({ organization_id, status: 'active' }),
      base44.asServiceRole.entities.PolicyTargetingOverride.filter({ organization_id }),
      base44.asServiceRole.entities.Acknowledgment.filter({ organization_id }),
      base44.asServiceRole.entities.PendingReAcknowledgment.filter({ organization_id })
    ]);

    // Only policies that require acknowledgment
    const ackRequiredPolicies = policies.filter(p => p.acknowledgment_required);

    // Build lookup maps
    const ackMap = {};
    acknowledgments.forEach(ack => {
      ackMap[`${ack.employee_id}-${ack.policy_id}`] = ack;
    });

    const pendingReAckMap = {};
    pendingReAcks.forEach(pending => {
      pendingReAckMap[`${pending.employee_id}-${pending.policy_id}`] = pending;
    });

    // Compute matrix entirely in memory — no additional DB/network calls
    const matrixRows = employees.map(emp => {
      const applicable = ackRequiredPolicies.filter(p => policyAppliesToEmployee(p, emp, overrides));
      const acked = applicable.filter(p => ackMap[`${emp.id}-${p.id}`]).length;
      const total = applicable.length;

      return {
        employee_id: emp.id,
        employee_name: emp.full_name,
        employee_email: emp.user_email,
        applicable_policies: applicable.map(p => ({
          policy_id: p.id,
          policy_title: p.title,
          acknowledged: !!ackMap[`${emp.id}-${p.id}`],
          acknowledged_at: ackMap[`${emp.id}-${p.id}`]?.acknowledged_at,
          needs_re_ack: !!pendingReAckMap[`${emp.id}-${p.id}`],
          pending_re_ack: pendingReAckMap[`${emp.id}-${p.id}`] || null
        })),
        progress: { acked, total, percent: total > 0 ? Math.round((acked / total) * 100) : 0 }
      };
    });

    return Response.json({ matrix: matrixRows });

  } catch (error) {
    console.error('getAcknowledgementMatrix error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});