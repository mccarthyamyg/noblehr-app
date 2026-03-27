import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Securely resolves the authenticated user's Organization and Employee record.
 * This is the trust anchor for all permission checks in the frontend.
 * The employee object is NEVER resolved client-side — always through this function.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the org this user belongs to by looking up their employee record first
    // Try exact match first, then case-insensitive fallback for invite flow edge cases
    let allEmployees = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email
    });

    // Case-insensitive fallback — handles email case mismatches from invites
    if (allEmployees.length === 0) {
      const allByEmail = await base44.asServiceRole.entities.Employee.filter({
        user_email: user.email.toLowerCase()
      });
      allEmployees = allByEmail;
    }

    if (allEmployees.length === 0) {
      // No employee record yet — new user, needs Setup
      return Response.json({ org: null, employee: null });
    }

    const employee = allEmployees[0];
    
    // If the stored email doesn't match the login email, update it to keep them in sync
    if (employee.user_email !== user.email) {
      await base44.asServiceRole.entities.Employee.update(employee.id, { user_email: user.email });
      employee.user_email = user.email;
    }

    const orgs = await base44.asServiceRole.entities.Organization.filter({
      id: employee.organization_id
    });

    if (orgs.length === 0) {
      return Response.json({ org: null, employee: null });
    }

    const org = orgs[0];

    return Response.json({ org, employee });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});