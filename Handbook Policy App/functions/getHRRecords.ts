import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Secure HRRecord read endpoint.
 * - Admins/managers: see all records for the org
 * - Employees: see only their own records (optionally filtered by record_type)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organization_id, record_type, employee_id } = await req.json();

    if (!organization_id) {
      return Response.json({ error: 'Missing organization_id' }, { status: 400 });
    }

    // Verify caller is a member of this org
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const employee = employees[0];

    const isAdmin = employee.permission_level === 'org_admin' || employee.permission_level === 'manager';

    let filter = { organization_id };
    if (!isAdmin) {
      // Employees can only read their own records
      filter.employee_id = employee.id;
    } else if (employee_id) {
      // Admins can filter by a specific employee
      filter.employee_id = employee_id;
    }
    if (record_type) {
      filter.record_type = record_type;
    }

    const records = await base44.asServiceRole.entities.HRRecord.filter(filter, '-created_date');

    return Response.json({ records });

  } catch (error) {
    console.error('getHRRecords error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});