import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Returns the current employee's active onboarding record
 * with full policy content snapshots for each assigned policy.
 * Fetches all policies and versions in two batched queries (not N queries).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { organization_id } = await req.json();
    if (!organization_id) return Response.json({ error: 'organization_id required' }, { status: 400 });

    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const employee = employees[0];

    const onboardings = await base44.asServiceRole.entities.Onboarding.filter({
      organization_id,
      employee_id: employee.id
    });

    const active = onboardings.filter(o => o.status === 'not_started' || o.status === 'in_progress');
    if (active.length === 0) return Response.json({ onboarding: null, policies: [] });

    const ob = active[0];
    if (!ob.assigned_policy_ids || ob.assigned_policy_ids.length === 0) {
      return Response.json({ onboarding: ob, policies: [] });
    }

    // Batch fetch all assigned policies and all their versions in parallel
    const [allPolicies, allVersions] = await Promise.all([
      Promise.all(ob.assigned_policy_ids.map(id =>
        base44.asServiceRole.entities.Policy.filter({ id, organization_id })
          .then(r => r[0] || null)
      )),
      Promise.all(ob.assigned_policy_ids.map(id =>
        base44.asServiceRole.entities.PolicyVersion.filter({ policy_id: id, organization_id })
          .then(versions => {
            // Pick highest version_number (current_version authoritative)
            return versions.sort((a, b) => b.version_number - a.version_number)[0] || null;
          })
      ))
    ]);

    const policyDetails = ob.assigned_policy_ids.map((id, idx) => {
      const policy = allPolicies[idx];
      if (!policy) return null;
      return { ...policy, currentVersion: allVersions[idx] || null };
    }).filter(Boolean);

    return Response.json({ onboarding: ob, policies: policyDetails });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});