import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * AUTOMATION: Log acknowledgment creation to SystemEvent
 * Triggered on every Acknowledgment.create()
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'create') return Response.json({ processed: false });

    // data contains the newly created Acknowledgment
    const ack = data;

    // Create audit log entry
    await base44.asServiceRole.entities.SystemEvent.create({
      organization_id: ack.organization_id,
      event_type: 'policy.acknowledged',
      entity_type: 'Acknowledgment',
      entity_id: ack.id,
      actor_email: ack.created_by,
      summary: `${ack.employee_name} acknowledged policy "${ack.policy_title}" v${ack.version_number}`
    });

    return Response.json({ processed: true });
  } catch (error) {
    console.error('logAcknowledgmentEvent error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});