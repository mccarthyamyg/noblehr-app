import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Returns a single employee's profile data, org-scoped and admin-only.
 * Prevents cross-org employee lookups.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { organization_id, employee_id } = await req.json();
    if (!organization_id || !employee_id) {
      return Response.json({ error: 'organization_id and employee_id required' }, { status: 400 });
    }

    // Verify caller is admin/manager in this org
    const callers = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (callers.length === 0 || (callers[0].permission_level !== 'org_admin' && callers[0].permission_level !== 'manager')) {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    // Fetch target employee — must belong to same org
    const targets = await base44.asServiceRole.entities.Employee.filter({
      id: employee_id,
      organization_id
    });
    if (targets.length === 0) return Response.json({ error: 'Employee not found' }, { status: 404 });

    const employee = targets[0];

    let location = null;
    if (employee.location_id) {
      const locs = await base44.asServiceRole.entities.Location.filter({
        id: employee.location_id,
        organization_id
      });
      location = locs[0] || null;
    }

    return Response.json({ employee, location });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});