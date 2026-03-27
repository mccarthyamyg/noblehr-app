import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Verifies the tamper-evident content hash of an Acknowledgment record.
 * 
 * Re-hashes the linked PolicyVersion.content and compares it to the stored hash.
 * Returns { verified: true/false, stored_hash, computed_hash, acknowledgment_id }
 * 
 * This is the legal proof mechanism — call this to demonstrate a record is untampered.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { acknowledgment_id, organization_id } = await req.json();

    if (!acknowledgment_id || !organization_id) {
      return Response.json({ error: 'acknowledgment_id and organization_id required' }, { status: 400 });
    }

    // Verify caller belongs to this org
    const callers = await base44.asServiceRole.entities.Employee.filter({
      user_email: user.email,
      organization_id
    });
    if (callers.length === 0) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const caller = callers[0];
    const isAdmin = caller.permission_level === 'org_admin' || caller.permission_level === 'manager';

    // Fetch the acknowledgment — must belong to this org
    const acks = await base44.asServiceRole.entities.Acknowledgment.filter({
      id: acknowledgment_id,
      organization_id
    });
    if (acks.length === 0) {
      return Response.json({ error: 'Acknowledgment not found' }, { status: 404 });
    }

    const ack = acks[0];

    // Non-admins can only verify their own acknowledgments
    if (!isAdmin && ack.employee_id !== caller.id) {
      return Response.json({ error: 'Forbidden: can only verify your own acknowledgments' }, { status: 403 });
    }

    // Fetch the linked PolicyVersion
    const versions = await base44.asServiceRole.entities.PolicyVersion.filter({
      id: ack.policy_version_id,
      organization_id
    });
    if (versions.length === 0) {
      return Response.json({
        verified: false,
        reason: 'PolicyVersion record not found — cannot verify',
        acknowledgment_id,
        stored_hash: ack.content_hash || null,
        computed_hash: null
      });
    }

    const version = versions[0];

    // Re-compute the hash from the current PolicyVersion content
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(version.content || '');
    const hashBuffer = await crypto.subtle.digest('SHA-256', contentBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const storedHash = ack.content_hash || '';
    const verified = storedHash === computedHash;

    return Response.json({
      verified,
      acknowledgment_id,
      policy_id: ack.policy_id,
      policy_title: ack.policy_title,
      version_number: ack.version_number,
      employee_name: ack.employee_name,
      employee_email: ack.employee_email,
      acknowledged_at: ack.acknowledged_at,
      stored_hash: storedHash,
      computed_hash: computedHash,
      reason: verified
        ? 'PolicyVersion content matches stored hash — record is untampered'
        : 'Hash mismatch — PolicyVersion content does not match stored hash. Record may have been tampered with.'
    });

  } catch (error) {
    console.error('verifyAcknowledgment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});