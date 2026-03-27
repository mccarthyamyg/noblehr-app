import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * AUTOMATION: Log HR record creation to SystemEvent
 * Triggered on every HRRecord.create()
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'create') return Response.json({ processed: false });

    // data contains the newly created HRRecord
    const record = data;

    // Create audit log entry
    await base44.asServiceRole.entities.SystemEvent.create({
      organization_id: record.organization_id,
      event_type: 'hr_record.created',
      entity_type: 'HRRecord',
      entity_id: record.id,
      actor_email: record.recorded_by_email,
      actor_name: record.recorded_by_name,
      summary: `HR record "${record.title}" created for ${record.employee_name}`
    });

    return Response.json({ processed: true });
  } catch (error) {
    console.error('logHRRecordEvent error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});