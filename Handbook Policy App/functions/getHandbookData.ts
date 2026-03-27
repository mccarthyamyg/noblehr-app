import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Returns handbook list and optionally a policy version for handbook rendering.
 * All reads are org-scoped server-side.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { organization_id, action, policy_id, version_number, handbook_id } = await req.json();
    if (!organization_id) return Response.json({ error: 'organization_id required' }, { status: 400 });

    // Verify org membership
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (action === 'list_handbooks') {
      const handbooks = await base44.asServiceRole.entities.Handbook.filter({ organization_id });
      return Response.json({ handbooks });
    }

    if (action === 'get_policy_version') {
      if (!policy_id) return Response.json({ error: 'policy_id required' }, { status: 400 });
      const filter = { policy_id, organization_id };
      if (version_number) filter.version_number = version_number;
      else filter.is_current = true;
      const versions = await base44.asServiceRole.entities.PolicyVersion.filter(filter);
      return Response.json({ version: versions[0] || null });
    }

    if (action === 'get_handbook_version') {
      if (!handbook_id) return Response.json({ error: 'handbook_id required' }, { status: 400 });
      const versions = await base44.asServiceRole.entities.HandbookVersion.filter({
        handbook_id,
        is_current: true
      });
      return Response.json({ version: versions[0] || null });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});