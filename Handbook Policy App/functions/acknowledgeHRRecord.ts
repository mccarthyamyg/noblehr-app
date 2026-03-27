import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Secure HR Record acknowledgment.
 * Validates that:
 * 1. Caller is authenticated
 * 2. Caller's employee record matches the record's employee_id
 * 3. Only sets employee_acknowledged_at — no other fields can be changed
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { record_id, organization_id } = await req.json();
    if (!record_id || !organization_id) {
      return Response.json({ error: 'Missing record_id or organization_id' }, { status: 400 });
    }

    // Verify employee belongs to org
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const employee = employees[0];

    // Fetch the HR record and verify ownership
    const records = await base44.asServiceRole.entities.HRRecord.filter({ id: record_id, organization_id });
    if (records.length === 0) return Response.json({ error: 'Record not found' }, { status: 404 });
    const record = records[0];

    if (record.employee_id !== employee.id) {
      return Response.json({ error: 'Forbidden: not your record' }, { status: 403 });
    }

    if (!record.signature_required) {
      return Response.json({ error: 'This record does not require acknowledgment' }, { status: 400 });
    }

    if (record.employee_acknowledged_at) {
      return Response.json({ error: 'Already acknowledged' }, { status: 400 });
    }

    // Only set the acknowledgment timestamp — nothing else
    await base44.asServiceRole.entities.HRRecord.update(record_id, {
      employee_acknowledged_at: new Date().toISOString()
    });

    return Response.json({ success: true });

  } catch (error) {
    console.error('acknowledgeHRRecord error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});