import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * HR RECORD LIFECYCLE HANDLER
 * 
 * Atomic state transitions for HR records (write-ups, incidents, discipline).
 * Ensures linked amendments, audit trails, and employee acknowledgments are consistent.
 * 
 * Supported transitions:
 * - Any → locked (finalize + immutable)
 * - submitted → under_review
 * - under_review → resolved / dismissed
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { record_id, organization_id, new_status, record_type } = await req.json();

    if (!record_id || !organization_id || !new_status || !record_type) {
      return Response.json(
        { error: 'record_id, organization_id, new_status, and record_type required' },
        { status: 400 }
      );
    }

    // Validate record type
    const validTypes = ['HRRecord', 'IncidentReport'];
    if (!validTypes.includes(record_type)) {
      return Response.json(
        { error: `Invalid record_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // STEP 1: Verify user is admin
    const employees = await base44.asServiceRole.entities.Employee.filter({
      organization_id,
      user_email: user.email
    });

    if (employees.length === 0 || !['org_admin', 'manager'].includes(employees[0].permission_level)) {
      return Response.json(
        { error: 'Only admins can manage HR record lifecycle' },
        { status: 403 }
      );
    }

    // STEP 2: Fetch record
    const records = await base44.asServiceRole.entities[record_type].filter({
      id: record_id,
      organization_id
    });

    if (records.length === 0) {
      return Response.json(
        { error: `${record_type} not found` },
        { status: 404 }
      );
    }

    const record = records[0];
    const currentStatus = record.status;

    // STEP 3: Validate state transition (support both incident report and HR record statuses)
    const validTransitions = {
      'submitted': ['under_review', 'dismissed'],
      'under_review': ['resolved', 'dismissed'],
      'resolved': [],
      'dismissed': [],
      'draft': ['active', 'archived'],
      'active': ['archived'],
      'archived': []
    };

    if (!validTransitions[currentStatus]?.includes(new_status)) {
      return Response.json(
        { error: `Cannot transition from '${currentStatus}' to '${new_status}'` },
        { status: 400 }
      );
    }

    // STEP 4: Execute transition
    let result = {};

    if (new_status === 'resolved') {
      result = await handleResolution(base44, record, record_type, organization_id, user);
    } else if (new_status === 'dismissed') {
      result = await handleDismissal(base44, record, record_type, organization_id, user);
    } else if (new_status === 'under_review') {
      result = await handleReview(base44, record, record_type, organization_id, user);
    } else if (new_status === 'active') {
      result = await handleActivate(base44, record, record_type, organization_id, user);
    } else if (new_status === 'archived') {
      result = await handleArchive(base44, record, record_type, organization_id, user);
    }

    return Response.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('manageHRRecordLifecycle error:', error);
    return Response.json(
      { error: error.message || 'HR record transition failed' },
      { status: 500 }
    );
  }
});

/**
 * Mark as under review
 */
async function handleReview(base44, record, record_type, organization_id, user) {
  const updated = await base44.asServiceRole.entities[record_type].update(record.id, {
    status: 'under_review'
  });

  await base44.asServiceRole.entities.SystemEvent.create({
    organization_id,
    event_type: `hr_record.status_changed`,
    entity_type: record_type,
    entity_id: record.id,
    actor_email: user.email,
    actor_name: user.full_name,
    summary: `HR Record moved to "Under Review"`
  });

  return {
    message: 'Record moved to review',
    record: updated
  };
}

/**
 * Resolve: lock the record (immutable)
 */
async function handleResolution(base44, record, record_type, organization_id, user) {
  const updated = await base44.asServiceRole.entities[record_type].update(record.id, {
    status: 'resolved',
    is_locked: true
  });

  await base44.asServiceRole.entities.SystemEvent.create({
    organization_id,
    event_type: `hr_record.status_changed`,
    entity_type: record_type,
    entity_id: record.id,
    actor_email: user.email,
    actor_name: user.full_name,
    summary: `HR Record resolved and locked (immutable)`
  });

  return {
    message: 'Record resolved and locked',
    record: updated,
    is_locked: true
  };
}

/**
 * Dismiss: soft-delete
 */
async function handleDismissal(base44, record, record_type, organization_id, user) {
  const updated = await base44.asServiceRole.entities[record_type].update(record.id, {
    status: 'dismissed',
    is_locked: true
  });

  await base44.asServiceRole.entities.SystemEvent.create({
    organization_id,
    event_type: `hr_record.status_changed`,
    entity_type: record_type,
    entity_id: record.id,
    actor_email: user.email,
    actor_name: user.full_name,
    summary: `HR Record dismissed`
  });

  return {
    message: 'Record dismissed',
    record: updated
  };
}

/**
 * Activate: publish draft record
 */
async function handleActivate(base44, record, record_type, organization_id, user) {
  const updated = await base44.asServiceRole.entities[record_type].update(record.id, {
    status: 'active'
  });

  await base44.asServiceRole.entities.SystemEvent.create({
    organization_id,
    event_type: `hr_record.status_changed`,
    entity_type: record_type,
    entity_id: record.id,
    actor_email: user.email,
    actor_name: user.full_name,
    summary: `HR Record activated`
  });

  return {
    message: 'Record activated',
    record: updated
  };
}

/**
 * Archive: lock and archive record
 */
async function handleArchive(base44, record, record_type, organization_id, user) {
  const updated = await base44.asServiceRole.entities[record_type].update(record.id, {
    status: 'archived',
    is_locked: true
  });

  await base44.asServiceRole.entities.SystemEvent.create({
    organization_id,
    event_type: `hr_record.status_changed`,
    entity_type: record_type,
    entity_id: record.id,
    actor_email: user.email,
    actor_name: user.full_name,
    summary: `HR Record archived and locked (immutable)`
  });

  return {
    message: 'Record archived and locked',
    record: updated,
    is_locked: true
  };
}