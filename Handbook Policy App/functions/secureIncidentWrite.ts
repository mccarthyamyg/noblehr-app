import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Secure IncidentReport write endpoint.
 * - create: any org member can submit (org membership validated server-side)
 * - update_status / update_notes / update_attachments: admin/manager only
 * - amendment log is written server-side for notes changes
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, organization_id } = body;

    if (!organization_id) return Response.json({ error: 'Missing organization_id' }, { status: 400 });

    // Verify caller belongs to this org
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const employee = employees[0];
    const isAdmin = employee.permission_level === 'org_admin' || employee.permission_level === 'manager';

    // ── CREATE ──────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { form, location_name } = body;
      const incident = await base44.asServiceRole.entities.IncidentReport.create({
        ...form,
        organization_id,
        submitted_by_employee_id: employee.id,
        submitted_by_name: employee.full_name,
        submitted_by_email: user.email,
        location_name: location_name || '',
        status: 'submitted'
      });

      await base44.asServiceRole.entities.SystemEvent.create({
        organization_id,
        event_type: 'incident.created',
        entity_type: 'IncidentReport',
        entity_id: incident.id,
        actor_email: user.email,
        actor_name: employee.full_name,
        summary: `Incident report "${form.title}" submitted by ${employee.full_name}`
      });

      return Response.json({ success: true, incident });
    }

    // ── ADMIN-ONLY ACTIONS ──────────────────────────────────────────────────
    if (!isAdmin) return Response.json({ error: 'Admin access required' }, { status: 403 });

    const { incident_id } = body;
    if (!incident_id) return Response.json({ error: 'Missing incident_id' }, { status: 400 });

    // Verify incident belongs to org
    const incidents = await base44.asServiceRole.entities.IncidentReport.filter({ id: incident_id, organization_id });
    if (incidents.length === 0) return Response.json({ error: 'Incident not found' }, { status: 404 });
    const incident = incidents[0];

    if (action === 'update_status') {
      const { new_status } = body;
      await base44.asServiceRole.entities.IncidentReport.update(incident_id, { status: new_status });
      await base44.asServiceRole.entities.SystemEvent.create({
        organization_id,
        event_type: 'incident.status_changed',
        entity_type: 'IncidentReport',
        entity_id: incident_id,
        actor_email: user.email,
        actor_name: user.full_name,
        summary: `Incident "${incident.title}" status changed to ${new_status}`
      });
      return Response.json({ success: true });
    }

    if (action === 'update_notes') {
      const { field, old_value, new_value, amendment_note } = body;
      await base44.asServiceRole.entities.Amendment.create({
        organization_id,
        record_id: incident_id,
        record_type: 'IncidentReport',
        field_changed: field,
        old_value: old_value || '',
        new_value,
        amended_by_email: user.email,
        amended_by_name: user.full_name,
        amendment_note: amendment_note || ''
      });
      await base44.asServiceRole.entities.IncidentReport.update(incident_id, { [field]: new_value });
      return Response.json({ success: true });
    }

    if (action === 'update_attachments') {
      const { attachments } = body;
      await base44.asServiceRole.entities.IncidentReport.update(incident_id, { attachments });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('secureIncidentWrite error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});