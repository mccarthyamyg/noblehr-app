import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Secure wrapper for Organization and Location writes.
 * - Only org_admin can update org settings
 * - Enforces organization_id from server
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, entity_type, organization_id, entity_id, data } = body;

    if (!action || !entity_type || !organization_id) {
      return Response.json({ error: 'action, entity_type, and organization_id required' }, { status: 400 });
    }

    // Verify caller is org_admin
    const callers = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });

    if (!callers || callers.length === 0) {
      return Response.json({ error: 'User not found in organization' }, { status: 403 });
    }

    const caller = callers[0];
    if (caller.permission_level !== 'org_admin') {
      return Response.json({ error: 'Only org_admin can modify organization settings' }, { status: 403 });
    }

    const allowedEntities = ['Organization', 'Location', 'PolicyTargetingOverride'];
    if (!allowedEntities.includes(entity_type)) {
      return Response.json({ error: `Entity type ${entity_type} not allowed via this endpoint` }, { status: 400 });
    }

    let result;
    if (action === 'update') {
      if (!entity_id) return Response.json({ error: 'entity_id required for update' }, { status: 400 });
      result = await base44.asServiceRole.entities[entity_type].update(entity_id, data);
    } else if (action === 'create') {
      result = await base44.asServiceRole.entities[entity_type].create({ ...data, organization_id });
    } else if (action === 'delete') {
      if (!entity_id) return Response.json({ error: 'entity_id required for delete' }, { status: 400 });
      await base44.asServiceRole.entities[entity_type].delete(entity_id);
      return Response.json({ success: true });
    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    return Response.json({ success: true, data: result });

  } catch (error) {
    console.error('secureOrgWrite error:', error);
    return Response.json({ error: error.message || 'Write failed' }, { status: 500 });
  }
});