import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Secure wrapper for Employee entity writes.
 * - Only org_admin or manager can create/update employees
 * - Cannot change own permission_level to org_admin (self-escalation)
 * - Cannot change another org_admin's permission_level unless you are org_admin
 * - organization_id always comes from the server-verified employee record
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, employee_id, data, organization_id } = body;

    if (!action || !organization_id) {
      return Response.json({ error: 'action and organization_id required' }, { status: 400 });
    }

    // Verify caller belongs to org and is admin/manager
    const callers = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });

    if (!callers || callers.length === 0) {
      return Response.json({ error: 'User not found in organization' }, { status: 403 });
    }

    const caller = callers[0];
    const isAdmin = caller.permission_level === 'org_admin';
    const isManager = caller.permission_level === 'manager';

    if (!isAdmin && !isManager) {
      return Response.json({ error: 'Permission denied: admin or manager required' }, { status: 403 });
    }

    // Enforce organization_id from server — never trust client
    const safeData = { ...data, organization_id };

    if (action === 'create') {
      // Only org_admin can create org_admin or manager employees
      if (safeData.permission_level === 'org_admin' && !isAdmin) {
        return Response.json({ error: 'Only org_admin can create org_admin employees' }, { status: 403 });
      }
      if (safeData.permission_level === 'manager' && !isAdmin) {
        return Response.json({ error: 'Only org_admin can create manager employees' }, { status: 403 });
      }

      const result = await base44.asServiceRole.entities.Employee.create(safeData);

      // Log system event
      await base44.asServiceRole.entities.SystemEvent.create({
        organization_id,
        event_type: 'employee.added',
        entity_type: 'Employee',
        entity_id: result.id,
        actor_email: user.email,
        actor_name: user.full_name,
        summary: `${safeData.full_name} was added to the organization`
      });

      return Response.json({ success: true, data: result });

    } else if (action === 'update') {
      if (!employee_id) return Response.json({ error: 'employee_id required for update' }, { status: 400 });

      // Fetch the employee being updated to check their current permission level
      const targets = await base44.asServiceRole.entities.Employee.filter({ id: employee_id, organization_id });
      if (!targets || targets.length === 0) {
        return Response.json({ error: 'Employee not found' }, { status: 404 });
      }
      const target = targets[0];

      // Managers cannot update org_admin employees
      if (target.permission_level === 'org_admin' && !isAdmin) {
        return Response.json({ error: 'Managers cannot update org_admin employees' }, { status: 403 });
      }

      // Managers cannot escalate anyone to org_admin or manager
      if (safeData.permission_level === 'org_admin' && !isAdmin) {
        return Response.json({ error: 'Only org_admin can assign org_admin permission level' }, { status: 403 });
      }
      if (safeData.permission_level === 'manager' && !isAdmin) {
        return Response.json({ error: 'Only org_admin can assign manager permission level' }, { status: 403 });
      }

      const result = await base44.asServiceRole.entities.Employee.update(employee_id, safeData);
      return Response.json({ success: true, data: result });

    } else {
      return Response.json({ error: 'Invalid action (must be create or update)' }, { status: 400 });
    }

  } catch (error) {
    console.error('secureEmployeeWrite error:', error);
    return Response.json({ error: error.message || 'Write failed' }, { status: 500 });
  }
});