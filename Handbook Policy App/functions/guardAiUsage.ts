import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * AI Rate Limiter
 * 
 * Limits:
 *   - Max 15 AI calls per user per hour
 *   - Max 100 AI calls per organization per hour
 * 
 * Logs each allowed call as SystemEvent with event_type: "ai.call"
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

    // Verify user belongs to this organization
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) {
      return Response.json({ error: 'Forbidden: not a member of this organization' }, { status: 403 });
    }

    const user_email = user.email;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Fetch AI call events from the last hour using server-side filter
    const recentHour = await base44.asServiceRole.entities.SystemEvent.filter({
      organization_id,
      event_type: 'ai.call',
      created_date: { $gte: oneHourAgo }
    });

    const orgCount = recentHour.length;
    const userCount = recentHour.filter(e => e.actor_email === user_email).length || 0;

    // Enforce org limit
    if (orgCount >= 100) {
      return Response.json({
        allowed: false,
        message: "Organization AI usage limit reached (100/hour). Please wait before trying again."
      });
    }

    // Enforce per-user limit
    if (userCount >= 15) {
      return Response.json({
        allowed: false,
        message: "AI usage limit reached (15/hour per user). Please wait before trying again."
      });
    }

    // Write the event FIRST, then re-verify count to close the race window
    // (two concurrent requests both pass the check above — the re-query catches the overage)
    await base44.asServiceRole.entities.SystemEvent.create({
      organization_id,
      event_type: 'ai.call',
      entity_type: 'AI',
      actor_email: user_email,
      summary: 'AI call executed',
      metadata: { timestamp: new Date().toISOString() }
    });

    // Re-check post-write to catch concurrent overages
    const postWriteCount = await base44.asServiceRole.entities.SystemEvent.filter({
      organization_id,
      event_type: 'ai.call',
      created_date: { $gte: oneHourAgo }
    });
    if (postWriteCount.length >= 100) {
      return Response.json({
        allowed: false,
        message: "Organization AI usage limit reached (100/hour). Please wait before trying again."
      });
    }

    return Response.json({ allowed: true });

  } catch (error) {
    console.error('guardAiUsage error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});