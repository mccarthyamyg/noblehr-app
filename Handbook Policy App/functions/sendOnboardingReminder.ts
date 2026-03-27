import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Sends a reminder email for an onboarding record.
 * Admin/manager only. Updates reminder count on the Onboarding entity.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { organization_id, onboarding_id } = await req.json();
    if (!organization_id || !onboarding_id) {
      return Response.json({ error: 'organization_id and onboarding_id required' }, { status: 400 });
    }

    // Verify caller is admin/manager
    const employees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (employees.length === 0) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const caller = employees[0];
    if (caller.permission_level !== 'org_admin' && caller.permission_level !== 'manager') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch the onboarding record
    const onboardings = await base44.asServiceRole.entities.Onboarding.filter({
      id: onboarding_id,
      organization_id
    });
    if (onboardings.length === 0) return Response.json({ error: 'Onboarding not found' }, { status: 404 });
    const ob = onboardings[0];

    const remaining = (ob.assigned_policy_ids?.length || 0) - (ob.completed_policy_ids?.length || 0);
    const dueDate = ob.due_date ? new Date(ob.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ob.employee_email,
      subject: 'Reminder: Complete Your Onboarding',
      body: `Hi ${ob.employee_name},\n\nThis is a reminder that you have ${remaining} polic${remaining === 1 ? 'y' : 'ies'} remaining to acknowledge as part of your onboarding.\n\nDue date: ${dueDate}\n\nPlease log in to complete your onboarding.\n\nThank you.`
    });

    // Update reminder count
    const today = new Date().toISOString().split('T')[0];
    await base44.asServiceRole.entities.Onboarding.update(ob.id, {
      reminder_sent_count: (ob.reminder_sent_count || 0) + 1,
      last_reminder_date: today
    });

    return Response.json({ success: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});