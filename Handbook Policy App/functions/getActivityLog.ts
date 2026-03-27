import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Secure ActivityLog read endpoint.
 * Only admins and managers can access system events.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organization_id, skip = 0, limit = 50, search = '', event_type_prefix = '' } = await req.json();

    if (!organization_id) {
      return Response.json({ error: 'Missing organization_id' }, { status: 400 });
    }

    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const employee = employees[0];
    const isAdmin = employee.permission_level === 'org_admin' || employee.permission_level === 'manager';
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build filter — apply event_type prefix if provided
    const filter = { organization_id };
    if (event_type_prefix && event_type_prefix !== 'all') {
      filter.event_type = { $regex: `^${event_type_prefix}` };
    }

    const events = await base44.asServiceRole.entities.SystemEvent.filter(
      filter,
      '-created_date',
      limit,
      skip
    );

    // Apply search filter server-side
    const filtered = search
      ? events.filter(e => e.summary?.toLowerCase().includes(search.toLowerCase()))
      : events;

    return Response.json({ events: filtered });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});