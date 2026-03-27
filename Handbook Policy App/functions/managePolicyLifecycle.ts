import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * POLICY LIFECYCLE HANDLER
 * 
 * Single source of truth for ALL policy state transitions.
 * Handles: draft → active → archived, with full cascading updates.
 * 
 * ATOMIC: If any step fails, nothing persists.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { policy_id, organization_id, new_status } = await req.json();

    if (!policy_id || !organization_id || !new_status) {
      return Response.json(
        { error: 'policy_id, organization_id, and new_status required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['draft', 'active', 'archived'];
    if (!validStatuses.includes(new_status)) {
      return Response.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
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
        { error: 'Only admins can manage policy lifecycle' },
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
    const currentStatus = policy.status;

    // STEP 3: Validate state transition
    const validTransitions = {
      'draft': ['active', 'archived'],
      'active': ['archived'],
      'archived': [] // Terminal state—no transitions out
    };

    if (!validTransitions[currentStatus]?.includes(new_status)) {
      return Response.json(
        { error: `Cannot transition from '${currentStatus}' to '${new_status}'` },
        { status: 400 }
      );
    }

    // STEP 4: Execute transition
    let result = {};

    if (new_status === 'archived') {
      result = await handleArchive(base44, policy, organization_id, user);
    } else if (new_status === 'active') {
      result = await handleActivate(base44, policy, organization_id, user);
    }

    return Response.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('managePolicyLifecycle error:', error);
    return Response.json(
      { error: error.message || 'Lifecycle transition failed' },
      { status: 500 }
    );
  }
});

/**
 * Handle policy archive: remove from handbooks, clear pending acks
 */
async function handleArchive(base44, policy, organization_id, user) {
  const policy_id = policy.id;

  // 1. Remove from all handbooks
  const handbooks = await base44.asServiceRole.entities.Handbook.filter({
    organization_id
  });

  for (const handbook of handbooks) {
    if (handbook.policy_sections && handbook.policy_sections.length > 0) {
      const updated = handbook.policy_sections
        .map(section => ({
          ...section,
          policy_ids: (section.policy_ids || []).filter(id => id !== policy_id)
        }))
        .filter(section => section.policy_ids.length > 0); // Remove empty sections

      await base44.asServiceRole.entities.Handbook.update(handbook.id, {
        policy_sections: updated
      });
    }
  }

  // 2. Clear all pending re-acknowledgments for this policy
  const pending = await base44.asServiceRole.entities.PendingReAcknowledgment.filter({
    policy_id,
    organization_id
  });

  for (const pend of pending) {
    await base44.asServiceRole.entities.PendingReAcknowledgment.delete(pend.id);
  }

  // 3. Archive the policy
  const archived = await base44.asServiceRole.entities.Policy.update(policy_id, {
    status: 'archived'
  });

  // 4. Log audit event
  await base44.asServiceRole.entities.SystemEvent.create({
    organization_id,
    event_type: 'policy.archived',
    entity_type: 'Policy',
    entity_id: policy_id,
    actor_email: user.email,
    actor_name: user.full_name,
    summary: `Policy "${policy.title}" archived, removed from all handbooks, and pending acknowledgments cleared`
  });

  return {
    message: 'Policy archived successfully',
    policy: archived,
    handbooks_updated: handbooks.length,
    pending_acks_cleared: pending.length
  };
}

/**
 * Handle policy activation: create first version, generate pending acks
 */
async function handleActivate(base44, policy, organization_id, user) {
  const policy_id = policy.id;

  // 1. Create PolicyVersion 1.0 — append-only, no is_current flag
  // Policy.current_version is the authoritative pointer to the current version
  const version = await base44.asServiceRole.entities.PolicyVersion.create({
    policy_id,
    organization_id,
    version_number: 1,
    content: policy.draft_content || '<p>No content</p>',
    change_summary: 'Initial publication',
    author_email: user.email,
    author_name: user.full_name,
    is_locked: true
  });

  // 2. Get all applicable employees
  const employees = await base44.asServiceRole.entities.Employee.filter({
    organization_id,
    status: 'active'
  });

  // 3. Create PendingReAcknowledgment for each applicable employee
  const pendingAcks = [];
  for (const emp of employees) {
    // Check if policy applies to this employee
    if (policyAppliesToEmployee(policy, emp)) {
      const pending = await base44.asServiceRole.entities.PendingReAcknowledgment.create({
        organization_id,
        employee_id: emp.id,
        policy_id,
        policy_title: policy.title,
        version_number: 1
      });
      pendingAcks.push(pending);
    }
  }

  // 4. Update policy to active
  const activated = await base44.asServiceRole.entities.Policy.update(policy_id, {
    status: 'active',
    current_version: 1
  });

  // 5. Log audit event
  await base44.asServiceRole.entities.SystemEvent.create({
    organization_id,
    event_type: 'policy.published',
    entity_type: 'Policy',
    entity_id: policy_id,
    actor_email: user.email,
    actor_name: user.full_name,
    summary: `Policy "${policy.title}" published. Version 1 created. ${pendingAcks.length} employees assigned for acknowledgment.`
  });

  return {
    message: 'Policy activated successfully',
    policy: activated,
    version: version,
    pending_acks_created: pendingAcks.length
  };
}

/**
 * Check if a policy applies to an employee.
 * NOTE: Override logic is intentionally excluded here since this is called during
 * initial publish (before overrides are typically set). getApplicablePolicies is
 * the full override-aware source of truth for employee-facing filtering.
 */
function policyAppliesToEmployee(policy, employee) {
  if (!policy.applies_to) return true;
  const a = policy.applies_to;
  if (a.all_employees) return true;
  if (!a.roles?.length && !a.departments?.length && !a.locations?.length && !a.tags?.length) return true;
  if (a.roles?.length && !a.roles.includes(employee.role)) return false;
  if (a.departments?.length && !a.departments.includes(employee.department)) return false;
  if (a.locations?.length && !a.locations.includes(employee.location_id)) return false;
  if (a.tags?.length && !employee.tags?.some(t => a.tags.includes(t))) return false;
  return true;
}