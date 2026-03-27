/**
 * Audit log (Task 4.4). When DATABASE_URL is set, appends to PostgreSQL audit.logged_actions
 * (append-only; UPDATE/DELETE rejected by trigger). When using SQLite, no-op or use system_events.
 */
import { randomUUID } from 'crypto';
import { getDrizzlePg } from './db-pg.js';
import { loggedActions } from '../db/schema.js';
import { db } from './db.js';

/**
 * Log an action to the audit trail. When running on PostgreSQL, writes to audit.logged_actions.
 * When on SQLite, optionally logs to system_events for consistency (caller can also use createSystemEvent).
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization scope
 * @param {string} [params.actorEmail] - Actor email
 * @param {string} [params.actorId] - Actor user/employee id
 * @param {string} params.action - Action name (e.g. 'policy.publish', 'employee.update')
 * @param {string} [params.entityType] - Entity type (e.g. 'Policy', 'Employee')
 * @param {string} [params.entityId] - Entity id
 * @param {object} [params.oldData] - Previous state (JSON, stored as JSONB in pg)
 * @param {object} [params.newData] - New state (JSON, stored as JSONB in pg)
 * @param {import('express').Request} [params.req] - Request for IP and User-Agent
 */
export async function logAudit({ organizationId, actorEmail, actorId, action, entityType, entityId, oldData, newData, req }) {
  const pg = getDrizzlePg();
  if (pg) {
    const ip = req?.ip || req?.connection?.remoteAddress || null;
    const userAgent = req?.get?.('user-agent') || null;
    await pg.insert(loggedActions).values({
      id: randomUUID(),
      organizationId,
      actorEmail: actorEmail ?? null,
      actorId: actorId ?? null,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      oldData: oldData ?? null,
      newData: newData ?? null,
      ip,
      userAgent,
    });
    return;
  }
  // SQLite: optionally write to system_events for parity (Platform Truth #109: ip_address, app_source, old_value, new_value)
  const summary = [action, entityType, entityId].filter(Boolean).join(' ');
  const metadata = [oldData, newData].some(Boolean) ? JSON.stringify({ oldData: oldData ?? null, newData: newData ?? null }) : null;
  const ip = req?.ip || req?.connection?.remoteAddress || null;
  const clientType = (req?.get?.('x-client-type') || '').toLowerCase();
  const app_source = clientType.includes('mobile') || clientType.includes('expo') ? 'policyvault_mobile' : 'policyvault_web';
  const old_value = oldData != null ? JSON.stringify(oldData) : null;
  const new_value = newData != null ? JSON.stringify(newData) : null;
  try {
    db.prepare(
      `INSERT INTO system_events (id, organization_id, event_type, entity_type, entity_id, actor_email, summary, metadata, ip_address, device_id, app_source, old_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      organizationId,
      action,
      entityType ?? null,
      entityId ?? null,
      actorEmail ?? null,
      summary,
      metadata,
      ip,
      null,
      app_source,
      old_value,
      new_value
    );
  } catch (_) {
    // ignore if table or insert fails (e.g. dev without init-db)
  }
}
