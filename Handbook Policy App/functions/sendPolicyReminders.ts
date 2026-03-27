import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Scheduled automations run without a user — skip auth check, use service role only

    const orgs = await base44.asServiceRole.entities.Organization.list();
    let totalSent = 0;

    for (const org of orgs) {
      // Bulk-fetch everything for this org up front (avoid N+1 queries)
      const [employees, policies, allAcks, allPendingReAcks, allVersions] = await Promise.all([
        base44.asServiceRole.entities.Employee.filter({ organization_id: org.id, status: 'active', email_reminders: true }),
        base44.asServiceRole.entities.Policy.filter({ organization_id: org.id, status: 'active' }),
        base44.asServiceRole.entities.Acknowledgment.filter({ organization_id: org.id }),
        base44.asServiceRole.entities.PendingReAcknowledgment.filter({ organization_id: org.id }),
        base44.asServiceRole.entities.PolicyVersion.filter({ organization_id: org.id, is_current: true })
      ]);

      // Build lookup maps
      const ackMap = new Set(allAcks.map(a => `${a.employee_id}-${a.policy_id}-${a.version_number}`));
      const reAckMap = {};
      allPendingReAcks.forEach(r => { reAckMap[`${r.employee_id}-${r.policy_id}`] = r; });
      const versionMap = {};
      allVersions.forEach(v => { versionMap[v.policy_id] = v; });

      const now = new Date();

      for (const employee of employees) {
        const pendingPolicies = [];
        const pendingReAckPolicies = [];

        for (const policy of policies) {
          if (!policyAppliesTo(policy, employee)) continue;

          const reAckKey = `${employee.id}-${policy.id}`;
          if (reAckMap[reAckKey]) {
            pendingReAckPolicies.push({
              title: policy.title,
              version_number: reAckMap[reAckKey].version_number
            });
            continue;
          }

          // Already acknowledged current version?
          if (ackMap.has(`${employee.id}-${policy.id}-${policy.current_version}`)) continue;

          const version = versionMap[policy.id];
          if (!version) continue;

          const daysSincePublished = Math.floor((now - new Date(version.created_date)) / (1000 * 60 * 60 * 24));
          const daysSinceSignup = Math.floor((now - new Date(employee.created_date)) / (1000 * 60 * 60 * 24));
          const deadlineDays = daysSinceSignup <= 14 ? 14 : 7;
          const daysRemaining = deadlineDays - daysSincePublished;

          if (daysRemaining >= 0) {
            pendingPolicies.push({ title: policy.title, daysRemaining });
          }
        }

        if (pendingPolicies.length === 0 && pendingReAckPolicies.length === 0) continue;

        let body = `Hi ${employee.full_name},\n\n`;
        if (pendingReAckPolicies.length > 0) {
          const list = pendingReAckPolicies.map(p => `• ${p.title} (v${p.version_number})`).join('\n');
          body += `You have ${pendingReAckPolicies.length} policy update${pendingReAckPolicies.length > 1 ? 's' : ''} requiring re-acknowledgment:\n\n${list}\n\n`;
        }
        if (pendingPolicies.length > 0) {
          const list = pendingPolicies.map(p => `• ${p.title} (${p.daysRemaining} days remaining)`).join('\n');
          body += `You have ${pendingPolicies.length} policy acknowledgment${pendingPolicies.length > 1 ? 's' : ''} pending:\n\n${list}\n\n`;
        }
        body += `Please log in to PolicyVault to review and acknowledge these policies.\n\nThank you,\n${org.name}`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: org.name,
          to: employee.user_email,
          subject: 'Reminder: Policy Acknowledgments Needed',
          body
        });

        if (employee.sms_reminders && employee.phone_number) {
          console.log(`SMS would be sent to ${employee.phone_number}: pending policy acknowledgments reminder`);
        }

        totalSent++;
      }
    }

    return Response.json({
      success: true,
      remindersSent: totalSent,
      message: `Sent ${totalSent} reminder emails`
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// AND logic: matches getApplicablePolicies (single source of truth)
function policyAppliesTo(policy, employee) {
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