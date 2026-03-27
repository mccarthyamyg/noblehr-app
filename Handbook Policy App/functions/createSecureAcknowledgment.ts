import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * MANDATORY WRAPPER for creating acknowledgments
 *
 * CRITICAL VALIDATION:
 * 1. Verify policy applies to employee via getApplicablePolicies (override-aware, single source of truth)
 * 2. Ensure policy is published (has current_version > 0)
 * 3. Create immutable Acknowledgment record with content hash
 * 4. Log SystemEvent for audit trail
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { policy_id, organization_id, employee_id, policy_version_id } = await req.json();

    if (!policy_id || !organization_id || !employee_id) {
      return Response.json(
        { error: 'policy_id, organization_id, and employee_id required' },
        { status: 400 }
      );
    }

    // Verify caller is admin or the employee themselves
    const caller = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });

    if (caller.length === 0) {
      return Response.json({ error: 'User not in organization' }, { status: 403 });
    }

    const callerEmp = caller[0];
    const isAdmin = callerEmp.permission_level === 'org_admin' || callerEmp.permission_level === 'manager';
    // Use server-resolved caller ID — no extra DB call, org-scoped by the filter above
    const isOwnAcknowledgment = callerEmp.id === employee_id;

    if (!isAdmin && !isOwnAcknowledgment) {
      return Response.json({ error: 'Forbidden: cannot acknowledge for another employee' }, { status: 403 });
    }

    // STEP 1: Fetch policy and employee
    const [policies, employees] = await Promise.all([
      base44.asServiceRole.entities.Policy.filter({ id: policy_id, organization_id }),
      base44.asServiceRole.entities.Employee.filter({ id: employee_id, organization_id })
    ]);

    if (policies.length === 0) {
      return Response.json({ error: 'Policy not found or access denied' }, { status: 404 });
    }

    if (employees.length === 0) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    const policy = policies[0];
    const employee = employees[0];

    // STEP 2: Verify policy is published (not draft/archived)
    if (policy.status !== 'active' || policy.current_version === 0) {
      return Response.json(
        { error: 'Cannot acknowledge draft or archived policy', allowed: false },
        { status: 403 }
      );
    }

    // STEP 3: Verify policy applies to employee via getApplicablePolicies
    // This is the override-aware single source of truth — checks employee/role/location overrides
    const applicabilityResult = await base44.functions.invoke('getApplicablePolicies', {
      organization_id,
      employee_id,
      acknowledgment_required_only: false
    });

    const applicablePolicies = applicabilityResult.data?.policies || [];
    const policyApplies = applicablePolicies.some(p => p.id === policy_id);

    if (!policyApplies) {
      return Response.json(
        { error: 'This policy does not apply to this employee', allowed: false },
        { status: 403 }
      );
    }

    // STEP 4: Fetch current published version
    const versions = await base44.asServiceRole.entities.PolicyVersion.filter({
      policy_id,
      version_number: policy.current_version
    });

    if (versions.length === 0) {
      return Response.json({ error: 'Policy version not found' }, { status: 404 });
    }

    const version = versions[0];

    // Compute content hash for tamper-evident acknowledgment proof
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(version.content || '');
    const hashBuffer = await crypto.subtle.digest('SHA-256', contentBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // STEP 5: Create immutable Acknowledgment
    const ack = await base44.asServiceRole.entities.Acknowledgment.create({
      organization_id,
      policy_id,
      policy_version_id: version.id,
      policy_title: policy.title,
      version_number: policy.current_version,
      employee_id,
      employee_name: employee.full_name,
      employee_email: employee.user_email,
      employee_role_at_time: employee.role || 'Employee',
      employee_location_at_time: employee.location_id || '',
      acknowledged_at: new Date().toISOString(),
      content_hash: contentHash,
      is_locked: true
    });

    // STEP 6: Clear any pending re-acknowledgment for this employee+policy
    const pendingReAcks = await base44.asServiceRole.entities.PendingReAcknowledgment.filter({
      organization_id,
      employee_id,
      policy_id
    });
    await Promise.all(pendingReAcks.map(r => base44.asServiceRole.entities.PendingReAcknowledgment.delete(r.id)));

    // STEP 7: Auto-advance onboarding status if all assigned policies are now acknowledged
    const onboardings = await base44.asServiceRole.entities.Onboarding.filter({
      organization_id,
      employee_id,
      status: 'in_progress'
    });

    // Also check not_started onboardings and move to in_progress on first ack
    const notStarted = await base44.asServiceRole.entities.Onboarding.filter({
      organization_id,
      employee_id,
      status: 'not_started'
    });

    for (const ob of notStarted) {
      await base44.asServiceRole.entities.Onboarding.update(ob.id, { status: 'in_progress', start_date: new Date().toISOString().split('T')[0] });
      onboardings.push({ ...ob, status: 'in_progress' });
    }

    for (const ob of onboardings) {
      if (!ob.assigned_policy_ids?.length) continue;

      // Get all acknowledgments for this employee across assigned policies (current versions only)
      const assignedPolicies = await Promise.all(
        ob.assigned_policy_ids.map(pid =>
          base44.asServiceRole.entities.Policy.filter({ id: pid, organization_id }).then(r => r[0] || null)
        )
      );

      const completedPolicyIds = new Set(ob.completed_policy_ids || []);

      // Mark this policy as completed if not already
      if (!completedPolicyIds.has(policy_id)) {
        completedPolicyIds.add(policy_id);
      }

      // Check if all assigned policies requiring acknowledgment are now acknowledged
      const allDone = ob.assigned_policy_ids.every(pid => {
        const pol = assignedPolicies.find(p => p?.id === pid);
        if (!pol || !pol.acknowledgment_required) return true; // skip non-required
        return completedPolicyIds.has(pid);
      });

      const update = { completed_policy_ids: Array.from(completedPolicyIds) };
      if (allDone) {
        update.status = 'completed';
        update.completed_date = new Date().toISOString().split('T')[0];
      }
      await base44.asServiceRole.entities.Onboarding.update(ob.id, update);
    }

    // STEP 8: Log audit event
    await base44.asServiceRole.entities.SystemEvent.create({
      organization_id,
      event_type: 'policy.acknowledged',
      entity_type: 'Acknowledgment',
      entity_id: ack.id,
      actor_email: user.email,
      actor_name: user.full_name,
      summary: `${employee.full_name} acknowledged policy "${policy.title}" v${policy.current_version}`
    });

    return Response.json({ success: true, acknowledgment: ack });

  } catch (error) {
    console.error('createSecureAcknowledgment error:', error);
    return Response.json(
      { error: error.message || 'Acknowledgment creation failed' },
      { status: 500 }
    );
  }
});