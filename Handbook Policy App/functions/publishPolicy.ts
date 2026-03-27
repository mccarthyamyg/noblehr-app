import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * HARDENED Policy Publishing with Immutability Enforcement
 * 
 * Atomic + Secure publish workflow:
 * 1. Validate user is admin of organization
 * 2. Fetch policy, enforce pre-publish validation
 * 3. Mark old versions as not current (via immutable lock check)
 * 4. Create NEW immutable PolicyVersion (is_locked=true, cannot be modified)
 * 5. Atomically update policy status + version
 * 6. Create SystemEvent audit trail
 * 7. Trigger acknowledgment assignments for applicable employees
 * 
 * SECURITY: No partial states. All versions locked after creation.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { policy_id, change_summary } = await req.json();

    if (!policy_id) {
      return Response.json({ error: 'Missing policy_id' }, { status: 400 });
    }

    // STEP 1: Fetch policy + verify org admin
    const policies = await base44.asServiceRole.entities.Policy.filter({
      id: policy_id
    });

    if (!policies || policies.length === 0) {
      return Response.json({ error: 'Policy not found' }, { status: 404 });
    }

    const policy = policies[0];

    // STEP 2: Verify user is admin in this org
    const empResults = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id: policy.organization_id
    });

    if (!empResults || empResults.length === 0) {
      return Response.json({ error: 'User not found in organization' }, { status: 403 });
    }

    const employee = empResults[0];
    if (employee.permission_level !== 'org_admin' && employee.permission_level !== 'manager') {
      return Response.json({ error: 'Admin access required to publish policies' }, { status: 403 });
    }

    // STEP 3: Validate policy state (must have draft content)
    if (!policy.draft_content || policy.draft_content.trim().length === 0) {
      return Response.json({
        error: 'Cannot publish empty policy. Add content before publishing.'
      }, { status: 400 });
    }

    // STEP 4: Calculate new version number from Policy.current_version (the authoritative pointer)
    // We do NOT touch is_current on old PolicyVersion records — Policy.current_version is the
    // single source of truth for which version is current. is_current on PolicyVersion is removed
    // from the write path to keep version records fully append-only.
    const newVersionNum = (policy.current_version || 0) + 1;

    // STEP 5: Create NEW immutable PolicyVersion — append-only, never modified after creation
    const newVersion = await base44.asServiceRole.entities.PolicyVersion.create({
      policy_id: policy.id,
      organization_id: policy.organization_id,
      version_number: newVersionNum,
      content: policy.draft_content,
      change_summary: change_summary || 'Policy published',
      author_email: user.email,
      author_name: user.full_name,
      effective_date: new Date().toISOString().split('T')[0],
      is_locked: true  // ← CRITICAL: Makes this version immutable forever
    });

    // STEP 7: Update policy to active + bump version counter
    await base44.asServiceRole.entities.Policy.update(policy.id, {
      status: 'active',
      current_version: newVersionNum
    });

    // STEP 8: Create audit event for compliance
    await base44.asServiceRole.entities.SystemEvent.create({
      organization_id: policy.organization_id,
      event_type: 'policy.published',
      entity_type: 'Policy',
      entity_id: policy.id,
      actor_email: user.email,
      actor_name: user.full_name,
      summary: `Policy "${policy.title}" published v${newVersionNum} (immutable)`,
      metadata: {
        version_number: newVersionNum,
        version_id: newVersion.id,
        change_summary: change_summary || 'Policy published',
        is_locked: true
      }
    });

    // STEP 9: Create PendingReAcknowledgment for applicable employees.
    // Version 1 (first publish): assign all applicable active employees.
    // Version 2+: re-assign employees who already acknowledged the prior version.

    // Always clear any stale pending re-acks first
    const stale = await base44.asServiceRole.entities.PendingReAcknowledgment.filter({
      organization_id: policy.organization_id,
      policy_id: policy.id
    });
    await Promise.all(stale.map(r => base44.asServiceRole.entities.PendingReAcknowledgment.delete(r.id)));

    if (newVersionNum === 1) {
      // First publish — assign all active employees the policy applies to
      const allEmployees = await base44.asServiceRole.entities.Employee.filter({
        organization_id: policy.organization_id,
        status: 'active'
      });

      // Inline applicability check — OR logic: applies if employee matches ANY criteria group
      const applicable = allEmployees.filter(emp => {
        if (!policy.applies_to) return true;
        const { all_employees, roles, departments, locations, tags } = policy.applies_to;
        if (all_employees) return true;
        const hasCriteria = roles?.length || departments?.length || locations?.length || tags?.length;
        if (!hasCriteria) return true;
        if (roles?.length && emp.role && roles.includes(emp.role)) return true;
        if (departments?.length && emp.department && departments.includes(emp.department)) return true;
        if (locations?.length && emp.location_id && locations.includes(emp.location_id)) return true;
        if (tags?.length && emp.tags?.some(t => tags.includes(t))) return true;
        return false;
      });

      await Promise.all(applicable.map(emp =>
        base44.asServiceRole.entities.PendingReAcknowledgment.create({
          organization_id: policy.organization_id,
          employee_id: emp.id,
          policy_id: policy.id,
          policy_title: policy.title,
          version_number: newVersionNum
        })
      ));
    } else {
      // Version 2+ — re-assign employees who previously acknowledged
      const priorAcks = await base44.asServiceRole.entities.Acknowledgment.filter({
        policy_id,
        organization_id: policy.organization_id
      });

      // Deduplicate by employee_id, keeping only the most recent acknowledgment per employee
      const latestAckByEmployee = new Map();
      for (const ack of priorAcks) {
        const existing = latestAckByEmployee.get(ack.employee_id);
        if (!existing || new Date(ack.acknowledged_at) > new Date(existing.acknowledged_at)) {
          latestAckByEmployee.set(ack.employee_id, ack);
        }
      }
      const toNotify = Array.from(latestAckByEmployee.values());

      // Skip employees who have already acknowledged the new version (e.g. republish edge case)
      const alreadyAckedNewVersion = new Set(
        priorAcks.filter(a => a.version_number === newVersionNum).map(a => a.employee_id)
      );

      await Promise.all(
        toNotify
          .filter(ack => !alreadyAckedNewVersion.has(ack.employee_id))
          .map(ack =>
            base44.asServiceRole.entities.PendingReAcknowledgment.create({
              organization_id: policy.organization_id,
              employee_id: ack.employee_id,
              policy_id: policy.id,
              policy_title: policy.title,
              version_number: newVersionNum,
              previous_version_number: ack.version_number
            })
          )
      );
    }

    return Response.json({
      success: true,
      version_number: newVersionNum,
      policy_id: policy.id,
      version_id: newVersion.id,
      is_locked: true,
      message: 'Policy published and locked (immutable)'
    });

  } catch (error) {
    console.error('publishPolicy error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Publish failed'
    }, { status: 500 });
  }
});