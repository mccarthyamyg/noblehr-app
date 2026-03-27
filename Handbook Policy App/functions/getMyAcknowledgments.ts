import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Securely returns acknowledgments for the authenticated employee only.
 * Prevents employees from reading each other's acknowledgment records.
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

    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const employee = employees[0];

    const [acknowledgments, pendingReAcks] = await Promise.all([
      base44.asServiceRole.entities.Acknowledgment.filter({ organization_id, employee_id: employee.id }),
      base44.asServiceRole.entities.PendingReAcknowledgment.filter({ organization_id, employee_id: employee.id })
    ]);

    return Response.json({ acknowledgments, pending_re_acknowledgments: pendingReAcks });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});