import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { organization_id } = body;

    if (!organization_id) {
      return Response.json({ error: 'organization_id required' }, { status: 400 });
    }

    // Verify caller is admin/manager
    const callers = await base44.asServiceRole.entities.Employee.filter({ user_email: user.email, organization_id });
    if (!callers.length || (callers[0].permission_level !== 'org_admin' && callers[0].permission_level !== 'manager')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse optional include list
    const include = Array.isArray(body?.include) ? body.include : [];

    // Fetch admin-level metrics + optional includes
    const [pendingReAcks, employees, locations, onboardings, amendments, policies, overrides] = await Promise.all([
      base44.asServiceRole.entities.PendingReAcknowledgment.filter({ organization_id }),
      base44.asServiceRole.entities.Employee.filter({ organization_id }),
      base44.asServiceRole.entities.Location.filter({ organization_id }),
      include.includes('onboardings') ? base44.asServiceRole.entities.Onboarding.filter({ organization_id }) : Promise.resolve([]),
      (include.includes('amendments_hr') || include.includes('amendments_incident')) ? base44.asServiceRole.entities.Amendment.filter({ organization_id }) : Promise.resolve([]),
      include.includes('policies') ? base44.asServiceRole.entities.Policy.filter({ organization_id, status: 'active' }) : Promise.resolve([]),
      include.includes('overrides') ? base44.asServiceRole.entities.PolicyTargetingOverride.filter({ organization_id }) : Promise.resolve([])
    ]);

    // Count pending re-acks and group by employee
    const reAcksByEmployee = {};
    let totalPendingReAcks = 0;
    let employeesWithPendingReAcks = new Set();

    pendingReAcks.forEach(reAck => {
      totalPendingReAcks++;
      employeesWithPendingReAcks.add(reAck.employee_id);
      if (!reAcksByEmployee[reAck.employee_id]) {
        reAcksByEmployee[reAck.employee_id] = [];
      }
      reAcksByEmployee[reAck.employee_id].push(reAck);
    });

    const activeEmployees = employees.filter(e => e.status === 'active');

    const amendments_hr = amendments.filter(a => a.record_type === 'HRRecord');
    const amendments_incident = amendments.filter(a => a.record_type === 'IncidentReport');

    return Response.json({
      success: true,
      pendingReAckCount: totalPendingReAcks,
      employeesWithPendingReAcks: employeesWithPendingReAcks.size,
      totalActiveEmployees: activeEmployees.length,
      reAckCompliancePercent: activeEmployees.length > 0 
        ? Math.round(((activeEmployees.length - employeesWithPendingReAcks.size) / activeEmployees.length) * 100)
        : 100,
      employees,
      locations,
      onboardings,
      amendments_hr,
      amendments_incident,
      policies,
      overrides
    });
  } catch (error) {
    console.error('Error getting admin context:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});