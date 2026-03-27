import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CRITICAL FUNCTION: Prevent cascade delete corruption
 * 
 * Before allowing policy deletion:
 * 1. Check if policy is referenced in any Handbook
 * 2. Check if policy has any Acknowledgments
 * 3. If either: DENY deletion or require explicit orphan cleanup
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

    // Verify user is admin in organization
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });

    if (!employees || employees.length === 0 || (employees[0].permission_level !== 'org_admin' && employees[0].permission_level !== 'manager')) {
      return Response.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Check if policy is referenced in any Handbook
    const handbooks = await base44.asServiceRole.entities.Handbook.filter({
      organization_id
    });

    const referencedInHandbooks = [];
    for (const handbook of handbooks || []) {
      if (handbook.policy_sections && Array.isArray(handbook.policy_sections)) {
        for (const section of handbook.policy_sections) {
          if (section.policy_ids && section.policy_ids.includes(policy_id)) {
            referencedInHandbooks.push(handbook.id);
            break;
          }
        }
      }
    }

    // Check if policy has any Acknowledgments
    const acknowledgments = await base44.asServiceRole.entities.Acknowledgment.filter({
      policy_id,
      organization_id
    });

    const hasAcknowledgments = acknowledgments && acknowledgments.length > 0;

    // Return findings
    return Response.json({
      can_delete: referencedInHandbooks.length === 0 && !hasAcknowledgments,
      referenced_in_handbooks: referencedInHandbooks,
      has_acknowledgments: hasAcknowledgments,
      acknowledgment_count: hasAcknowledgments ? acknowledgments.length : 0,
      reason: referencedInHandbooks.length > 0 
        ? `Policy is referenced in ${referencedInHandbooks.length} handbook(s). Remove from handbooks first.`
        : hasAcknowledgments
        ? `Policy has ${acknowledgments.length} acknowledgment(s). Soft-delete recommended (set status: 'archived').`
        : 'Safe to delete'
    });

  } catch (error) {
    console.error('Error checking policy delete safety:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});