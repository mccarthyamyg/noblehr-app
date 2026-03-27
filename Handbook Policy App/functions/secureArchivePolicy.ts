import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * SECURE ARCHIVE with cascade protection
 * 
 * STEP 1: Validate user is admin
 * STEP 2: Remove policy from all handbooks
 * STEP 3: Archive the policy (soft delete)
 * STEP 4: Log audit event
 * 
 * Prevents orphaned policies in handbooks
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { policy_id, organization_id } = await req.json();

    if (!policy_id || !organization_id) {
      return Response.json(
        { error: 'policy_id and organization_id required' },
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
        { error: 'Only admins can archive policies' },
        { status: 403 }
      );
    }

    // STEP 2: Fetch policy
    const policies = await base44.asServiceRole.entities.Policy.filter({
      id: policy_id,
      organization_id
    });

    if (policies.length === 0) {
      return Response.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    const policy = policies[0];
    if (policy.status === 'archived') {
      return Response.json({
        success: true,
        message: 'Policy already archived'
      });
    }

    // STEP 3: Remove from all handbooks + clear pending re-acks in parallel
    const [handbooks, pendingReAcks] = await Promise.all([
      base44.asServiceRole.entities.Handbook.filter({ organization_id }),
      base44.asServiceRole.entities.PendingReAcknowledgment.filter({ policy_id, organization_id })
    ]);

    for (const handbook of handbooks) {
      if (handbook.policy_sections && handbook.policy_sections.length > 0) {
        const updated = handbook.policy_sections
          .map(section => ({
            ...section,
            policy_ids: (section.policy_ids || []).filter(id => id !== policy_id)
          }))
          .filter(section => section.policy_ids.length > 0);
        
        await base44.asServiceRole.entities.Handbook.update(handbook.id, {
          policy_sections: updated
        });
      }
    }

    for (const pend of pendingReAcks) {
      await base44.asServiceRole.entities.PendingReAcknowledgment.delete(pend.id);
    }

    // STEP 4: Archive the policy (soft delete)
    const archived = await base44.asServiceRole.entities.Policy.update(policy_id, {
      status: 'archived'
    });

    // STEP 5: Log audit event
    await base44.asServiceRole.entities.SystemEvent.create({
      organization_id,
      event_type: 'policy.archived',
      entity_type: 'Policy',
      entity_id: policy_id,
      actor_email: user.email,
      actor_name: user.full_name,
      summary: `Policy "${policy.title}" archived and removed from all handbooks`
    });

    return Response.json({
      success: true,
      policy: archived
    });

  } catch (error) {
    console.error('secureArchivePolicy error:', error);
    return Response.json(
      { error: error.message || 'Archive failed' },
      { status: 500 }
    );
  }
});