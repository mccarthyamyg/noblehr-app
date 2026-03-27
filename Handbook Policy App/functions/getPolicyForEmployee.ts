import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Secure policy read for employees.
 * Validates the policy applies to the requesting employee before returning content.
 * Admins can always access any policy in their org.
 */

// Inline targeting logic (no local imports allowed)
// Matches AND logic of getApplicablePolicies (single source of truth for targeting)
function checkPolicyAppliesTo(policy, employee) {
  if (!policy || !employee) return false;
  const applies = policy.applies_to;
  if (!applies) return true; // No targeting object = applies to all
  if (applies.all_employees) return true;
  // No criteria set = applies to all
  if (!applies.roles?.length && !applies.departments?.length && !applies.locations?.length && !applies.tags?.length) return true;
  // AND logic: every non-empty criterion must be satisfied
  if (applies.roles?.length && !applies.roles.includes(employee.role)) return false;
  if (applies.departments?.length && !applies.departments.includes(employee.department)) return false;
  if (applies.locations?.length && !applies.locations.includes(employee.location_id)) return false;
  if (applies.tags?.length && !employee.tags?.some(t => applies.tags.includes(t))) return false;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organization_id, policy_id, employee_id } = await req.json();
    if (!organization_id || !policy_id) {
      return Response.json({ error: 'organization_id and policy_id required' }, { status: 400 });
    }

    // Verify caller belongs to org
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const emp = employees[0];
    const isAdmin = emp.permission_level === 'org_admin' || emp.permission_level === 'manager';

    // Fetch the policy
    const policies = await base44.asServiceRole.entities.Policy.filter({ id: policy_id, organization_id });
    if (policies.length === 0) {
      return Response.json({ error: 'Policy not found' }, { status: 404 });
    }
    const policy = policies[0];

    // Access check for non-admins
    if (!isAdmin && !checkPolicyAppliesTo(policy, emp)) {
      return Response.json({ error: 'Access denied: policy not assigned to you' }, { status: 403 });
    }

    // Fetch current version — sort by version_number desc, pick the one matching current_version
    const versions = await base44.asServiceRole.entities.PolicyVersion.filter({ policy_id, organization_id });
    const currentVersion = versions.sort((a, b) => b.version_number - a.version_number)
      .find(v => v.version_number === policy.current_version) || versions[0] || null;

    // Fetch employee's acknowledgment (for the employee requesting, or specified employee_id for admins)
    const ackEmployeeId = isAdmin && employee_id ? employee_id : emp.id;
    const acks = await base44.asServiceRole.entities.Acknowledgment.filter({
      policy_id,
      employee_id: ackEmployeeId
    });

    // Check if employee has a pending re-acknowledgment for this policy
    const pendingReAcks = await base44.asServiceRole.entities.PendingReAcknowledgment.filter({
      policy_id,
      employee_id: ackEmployeeId,
      organization_id
    });

    // Fetch employee location if needed
    let location = null;
    if (emp.location_id) {
      const locs = await base44.asServiceRole.entities.Location.filter({ id: emp.location_id });
      if (locs.length > 0) location = locs[0];
    }

    return Response.json({
      policy,
      currentVersion,
      acknowledgment: acks[0] || null,
      pending_re_acknowledgment: pendingReAcks[0] || null,
      employee: emp,
      location
    });

  } catch (error) {
    console.error('getPolicyForEmployee error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});