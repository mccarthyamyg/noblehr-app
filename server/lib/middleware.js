import { getOrgContextByOrgId } from './auth.js';

export function hasCapability(employee, capability) {
  if (!employee) return false;
  if (employee.permission_level === 'org_admin') return true;
  if (employee.permission_level === 'manager') {
    const caps = Array.isArray(employee.capabilities) ? employee.capabilities : [];
    return caps.includes(capability);
  }
  return false;
}

export function isAdmin(employee) {
  return employee && employee.permission_level === 'org_admin';
}

/**
 * Express middleware to strictly enforce a system capability before touching the DB.
 */
export function requireCapability(capability) {
  return (req, res, next) => {
    // Super admins bypass normal capability gates
    if (req.superAdmin) return next();

    const orgId = req.body?.organization_id || req.query?.organization_id || req.headers['x-organization-id'];
    
    // Attempt context load
    const { org, employee } = getOrgContextByOrgId(orgId);
    if (!org || !employee) {
      return res.status(403).json({ error: 'Organization context not found or employee inactive' });
    }

    if (!hasCapability(employee, capability)) {
      return res.status(403).json({ error: `Forbidden: requires ${capability} capability` });
    }

    // Attach to request so routes don't have to query it again
    req.orgContext = { org, employee };
    next();
  };
}

/**
 * Express middleware to strictly require org_admin.
 */
export function requireOrgAdmin() {
  return (req, res, next) => {
    if (req.superAdmin) return next();
    
    const orgId = req.body?.organization_id || req.query?.organization_id || req.headers['x-organization-id'];
    const { org, employee } = getOrgContextByOrgId(orgId);
    if (!org || !employee) return res.status(403).json({ error: 'Context invalid' });
    
    if (!isAdmin(employee)) {
      return res.status(403).json({ error: 'Forbidden: requires org_admin' });
    }

    req.orgContext = { org, employee };
    next();
  };
}
