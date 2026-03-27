import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Scheduled automations run without a user — skip auth check, use service role only
    const allOrgs = await base44.asServiceRole.entities.Organization.list();
    let totalReminders = 0;

    for (const org of allOrgs) {
      const onboardings = await base44.asServiceRole.entities.Onboarding.filter({
        organization_id: org.id,
        status: { $in: ['not_started', 'in_progress'] }
      });

      for (const onboarding of onboardings) {
        const dueDate = new Date(onboarding.due_date);
        const today = new Date();
        const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

        const lastReminder = onboarding.last_reminder_date 
          ? new Date(onboarding.last_reminder_date) 
          : null;
        const daysSinceReminder = lastReminder 
          ? Math.ceil((today - lastReminder) / (1000 * 60 * 60 * 24))
          : 999;

        const shouldSendReminder = 
          (daysUntilDue <= 3 && daysUntilDue >= 0 && daysSinceReminder >= 1) ||
          (daysUntilDue < 0 && daysSinceReminder >= 2);

        if (shouldSendReminder) {
          const pendingCount = onboarding.assigned_policy_ids.length - (onboarding.completed_policy_ids?.length || 0);
          
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: onboarding.employee_email,
            subject: daysUntilDue < 0 
              ? 'URGENT: Overdue Onboarding Policies'
              : 'Reminder: Complete Your Onboarding',
            body: `Hi ${onboarding.employee_name},

You have ${pendingCount} ${pendingCount === 1 ? 'policy' : 'policies'} remaining to acknowledge as part of your onboarding.

${daysUntilDue < 0 
  ? `Your onboarding was due ${Math.abs(daysUntilDue)} days ago. Please complete it as soon as possible.`
  : `Due date: ${dueDate.toLocaleDateString()} (${daysUntilDue} days remaining)`
}

Please log in to complete your onboarding.

Best regards,
${org.name} HR Team`
          });

          await base44.asServiceRole.entities.Onboarding.update(onboarding.id, {
            reminder_sent_count: (onboarding.reminder_sent_count || 0) + 1,
            last_reminder_date: today.toISOString().split('T')[0]
          });

          totalReminders++;
        }
      }
    }

    return Response.json({
      success: true,
      reminders_sent: totalReminders,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});