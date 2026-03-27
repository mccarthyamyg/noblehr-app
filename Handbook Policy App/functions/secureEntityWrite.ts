import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * MANDATORY WRAPPER for all entity writes
 * 
 * Every create/update MUST pass validation first:
 * 1. Call validateEntityWrite to check permissions + constraints
 * 2. If validation fails → reject with 403
 * 3. If validation passes → execute the write
 * 
 * This prevents:
 * - Non-admins creating policies/HR records
 * - Cross-org data access
 * - Invalid state changes
 * - Immutable record tampering
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, entity_type, organization_id, entity_id, data } = body;

    if (!action || !entity_type || !organization_id) {
      return Response.json(
        { error: 'action, entity_type, and organization_id required' },
        { status: 400 }
      );
    }

    // STEP 1: Verify user belongs to the organization and has appropriate permissions
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });

    if (!employees || employees.length === 0) {
      return Response.json({ error: 'User not found in organization' }, { status: 403 });
    }

    const emp = employees[0];
    const isAdmin = emp.permission_level === 'org_admin' || emp.permission_level === 'manager';

    // CRITICAL: Always overwrite organization_id in data with the server-verified value.
    // Never trust the client-supplied org ID in the data payload.
    if (data && typeof data === 'object') {
      data.organization_id = organization_id;
    }

    // Admin-only entities (both create and update require admin)
    const adminOnlyEntities = ['Policy', 'PolicyVersion', 'Handbook', 'HRRecord'];
    if (adminOnlyEntities.includes(entity_type) && !isAdmin) {
      return Response.json(
        { error: `Permission denied: ${entity_type} operations require admin/manager role` },
        { status: 403 }
      );
    }

    // Immutable entities — never allow update via this path
    if (['PolicyVersion', 'Acknowledgment'].includes(entity_type) && action === 'update') {
      return Response.json({ error: `${entity_type} records are immutable` }, { status: 403 });
    }

    // STEP 2: Execute the write
    let result;

    if (action === 'create') {
      // For HRRecord, always derive recorded_by from the authenticated user — never trust client
      if (entity_type === 'HRRecord') {
        data.recorded_by_email = user.email;
        data.recorded_by_name = user.full_name || user.email;
      }
      result = await base44.asServiceRole.entities[entity_type].create(data);
    } else if (action === 'update') {
      if (!entity_id) {
        return Response.json({ error: 'entity_id required for update' }, { status: 400 });
      }

      // For HRRecord updates, check is_locked
      if (entity_type === 'HRRecord') {
        const existing = await base44.asServiceRole.entities.HRRecord.filter({ id: entity_id });
        if (existing[0]?.is_locked) {
          return Response.json({ error: 'HRRecord is locked and cannot be updated' }, { status: 403 });
        }
        if (!isAdmin) {
          return Response.json({ error: 'Permission denied: updating HRRecord requires admin/manager role' }, { status: 403 });
        }
      }

      // Employees can only update their own Onboarding
      if (entity_type === 'Onboarding' && !isAdmin) {
        const existing = await base44.asServiceRole.entities.Onboarding.filter({ id: entity_id });
        if (!existing[0] || existing[0].employee_id !== emp.id) {
          return Response.json({ error: 'Permission denied: can only update your own onboarding' }, { status: 403 });
        }
      }

      result = await base44.asServiceRole.entities[entity_type].update(entity_id, data);
    } else if (action === 'amend') {
      // Amend: create an Amendment record + update the underlying entity field
      if (!entity_id) {
        return Response.json({ error: 'entity_id required for amend' }, { status: 400 });
      }
      const { field_changed, old_value, new_value, amendment_note } = body;
      if (!field_changed || new_value === undefined) {
        return Response.json({ error: 'field_changed and new_value required for amend' }, { status: 400 });
      }

      // amend requires admin (already verified above via emp/isAdmin)
      if (!isAdmin) {
        return Response.json({ error: 'Forbidden: admin or manager required to amend records' }, { status: 403 });
      }

      // Block amending locked records
      if (['HRRecord', 'IncidentReport'].includes(entity_type)) {
        const existing = await base44.asServiceRole.entities[entity_type].filter({ id: entity_id });
        if (existing[0]?.is_locked) {
          return Response.json({ error: `${entity_type} is locked and cannot be amended` }, { status: 403 });
        }
      }

      // Create Amendment record
      await base44.asServiceRole.entities.Amendment.create({
        organization_id,
        record_id: entity_id,
        record_type: entity_type,
        field_changed,
        old_value: old_value || '',
        new_value,
        amended_by_email: user.email,
        amended_by_name: user.full_name,
        amendment_note: amendment_note || ''
      });

      // Update the record field
      result = await base44.asServiceRole.entities[entity_type].update(entity_id, { [field_changed]: new_value });
    } else if (action === 'delete') {
      if (!entity_id) {
        return Response.json({ error: 'entity_id required for delete' }, { status: 400 });
      }
      if (!isAdmin) {
        return Response.json({ error: 'Permission denied: delete requires admin/manager role' }, { status: 403 });
      }
      // Hard block: these records are legally immutable and must never be deleted
      // Employee hard-delete is also blocked — use status:'terminated' instead (preserves audit trail)
      const undeletableEntities = ['PolicyVersion', 'Acknowledgment', 'SystemEvent', 'Amendment', 'Employee'];
      if (undeletableEntities.includes(entity_type)) {
        return Response.json({ error: `${entity_type} records are permanent and cannot be deleted` }, { status: 403 });
      }
      result = await base44.asServiceRole.entities[entity_type].delete(entity_id);
    } else {
      return Response.json({ error: 'Invalid action (must be create, update, amend, or delete)' }, { status: 400 });
    }

    return Response.json({
      success: true,
      record: result,
      data: result,
      entity_type,
      action
    });

  } catch (error) {
    console.error('secureEntityWrite error:', error);
    return Response.json(
      { error: error.message || 'Write failed' },
      { status: 500 }
    );
  }
});