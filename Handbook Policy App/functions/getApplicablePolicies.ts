import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Single source of truth for policy applicability.
 * Consolidates policyAppliesTo logic from 3 places into one backend function.
 * Eliminates drift risk and ensures consistency across all policy filtering.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organization_id, employee_id, acknowledgment_required_only } = await req.json();

    if (!organization_id || !employee_id) {
      return Response.json({ 
        error: 'Missing required fields: organization_id, employee_id' 
      }, { status: 400 });
    }

    // Verify caller belongs to org
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const callerEmp = employees[0];
    const isAdmin = callerEmp.permission_level === 'org_admin' || callerEmp.permission_level === 'manager';

    // Non-admins can only query their own applicable policies
    if (!isAdmin && callerEmp.id !== employee_id) {
      return Response.json({ error: 'Forbidden: cannot query applicable policies for another employee' }, { status: 403 });
    }

    // Fetch target employee
    const targetEmps = await base44.asServiceRole.entities.Employee.filter({
      id: employee_id,
      organization_id
    });
    if (targetEmps.length === 0) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }
    const targetEmp = targetEmps[0];

    // Fetch active policies and overrides
    const [allPolicies, overrides] = await Promise.all([
      base44.asServiceRole.entities.Policy.filter({ organization_id, status: 'active' }),
      base44.asServiceRole.entities.PolicyTargetingOverride.filter({ organization_id })
    ]);

    // Apply targeting logic + overrides
    const applicable = allPolicies.filter(policy => {
      // Check for employee-specific override first
      const employeeOverride = overrides.find(o =>
        o.policy_id === policy.id && o.override_type === 'employee' && o.employee_id === targetEmp.id
      );
      if (employeeOverride) return employeeOverride.applies;

      // Check for role-specific override
      const roleOverride = overrides.find(o =>
        o.policy_id === policy.id && o.override_type === 'role' && o.role === targetEmp.role
      );
      if (roleOverride) return roleOverride.applies;

      // Check for location-specific override
      const locationOverride = overrides.find(o =>
        o.policy_id === policy.id && o.override_type === 'location' && o.location_id === targetEmp.location_id
      );
      if (locationOverride) return locationOverride.applies;

      // Default targeting logic
      if (!policy.applies_to) return true;

      const { all_employees, roles, departments, locations, tags } = policy.applies_to;

      if (all_employees) return true;

      // If no criteria are set, policy applies to everyone
      const hasCriteria = roles?.length || departments?.length || locations?.length || tags?.length;
      if (!hasCriteria) return true;

      // OR logic: policy applies if the employee matches ANY of the specified criteria groups
      if (roles?.length && targetEmp.role && roles.includes(targetEmp.role)) return true;
      if (departments?.length && targetEmp.department && departments.includes(targetEmp.department)) return true;
      if (locations?.length && targetEmp.location_id && locations.includes(targetEmp.location_id)) return true;
      if (tags?.length && targetEmp.tags?.some(t => tags.includes(t))) return true;

      // Has criteria but employee didn't match any of them
      return false;
    });

    const filtered = acknowledgment_required_only 
      ? applicable.filter(p => p.acknowledgment_required) 
      : applicable;

    return Response.json({ policies: filtered });

  } catch (error) {
    console.error('getApplicablePolicies error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});