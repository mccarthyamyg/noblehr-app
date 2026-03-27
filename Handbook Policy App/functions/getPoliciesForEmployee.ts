import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Returns ONLY policies applicable to the requesting employee.
 * Delegates to getApplicablePolicies for override-aware targeting (single source of truth).
 */

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

    // Fetch requesting employee
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });

    if (!employees || employees.length === 0) {
      return Response.json({ error: 'Employee not found in organization' }, { status: 403 });
    }

    const employee = employees[0];

    // Admins see all policies (including drafts)
    if (employee.permission_level === 'org_admin' || employee.permission_level === 'manager') {
      const allPolicies = await base44.asServiceRole.entities.Policy.filter({ organization_id });
      return Response.json({ policies: allPolicies || [] });
    }

    // Regular employees: delegate to getApplicablePolicies (handles overrides correctly)
    const result = await base44.functions.invoke('getApplicablePolicies', {
      organization_id,
      employee_id: employee.id,
      acknowledgment_required_only: false
    });

    return Response.json({ policies: result.data?.policies || [] });

  } catch (error) {
    console.error('getPoliciesForEmployee error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});