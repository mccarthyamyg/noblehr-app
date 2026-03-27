import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Secure IncidentReport read endpoint.
 * - Admins/managers: see all incidents for the org
 * - Employees: see only their own submitted incidents
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
      return Response.json({ error: 'Missing organization_id' }, { status: 400 });
    }

    // Verify caller belongs to this org
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const employee = employees[0];

    const isAdmin = employee.permission_level === 'org_admin' || employee.permission_level === 'manager';

    const filter = isAdmin
      ? { organization_id }
      : { organization_id, submitted_by_employee_id: employee.id };

    const incidents = await base44.asServiceRole.entities.IncidentReport.filter(filter, '-created_date');

    return Response.json({ incidents });

  } catch (error) {
    console.error('getIncidentReports error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});