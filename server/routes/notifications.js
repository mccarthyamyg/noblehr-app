/**
 * Notification Preferences Routes — CRUD for employee + org-wide notification settings.
 * Ported from Noble Task's server/routes/notifications.js.
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/db-pg-adapter.js';
import { authMiddleware, getEmployeeContext } from '../lib/auth.js';
import { NOTIFICATION_TYPES, DELIVERY_OPTIONS } from '../lib/notification-helper.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/notifications/preferences
 * Returns the current employee's notification preferences (merged with defaults).
 */
router.get('/preferences', async (req, res) => {
  try {
    if (req.superAdmin) {
      return res.status(400).json({ error: 'Super admin does not have notification preferences' });
    }
    const { org, employee } = await getEmployeeContext(req.user.email);
    if (!org || !employee) return res.status(403).json({ error: 'No active employee record' });

    // Get employee overrides
    const prefs = await db.prepare(
      'SELECT notification_type, delivery FROM notification_preferences WHERE employee_id = ?'
    ).all(employee.id);

    // Get org defaults
    const orgDefaults = await db.prepare(
      'SELECT notification_type, delivery FROM org_notification_defaults WHERE organization_id = ?'
    ).all(org.id);

    // Build merged map: employee override → org default → 'immediate'
    const defaultMap = {};
    for (const d of orgDefaults) defaultMap[d.notification_type] = d.delivery;
    const prefMap = {};
    for (const p of prefs) prefMap[p.notification_type] = p.delivery;

    const result = NOTIFICATION_TYPES.map(type => ({
      notification_type: type,
      delivery: prefMap[type] || defaultMap[type] || 'immediate',
      is_override: !!prefMap[type],
    }));

    res.json({ data: result });
  } catch (e) {
    console.error('GET /notifications/preferences error:', e);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

/**
 * PUT /api/notifications/preferences
 * Upsert the employee's preference for a notification type.
 * Body: { notification_type, delivery }
 */
router.put('/preferences', async (req, res) => {
  try {
    if (req.superAdmin) {
      return res.status(400).json({ error: 'Super admin does not have notification preferences' });
    }
    const { notification_type, delivery } = req.body;
    if (!notification_type || !delivery) {
      return res.status(400).json({ error: 'notification_type and delivery required' });
    }
    if (!NOTIFICATION_TYPES.includes(notification_type)) {
      return res.status(400).json({ error: `Invalid notification_type. Must be one of: ${NOTIFICATION_TYPES.join(', ')}` });
    }
    if (!DELIVERY_OPTIONS.includes(delivery)) {
      return res.status(400).json({ error: `Invalid delivery. Must be one of: ${DELIVERY_OPTIONS.join(', ')}` });
    }

    const { org, employee } = await getEmployeeContext(req.user.email);
    if (!org || !employee) return res.status(403).json({ error: 'No active employee record' });

    // Upsert: try update first, insert if not found
    const existing = await db.prepare(
      'SELECT id FROM notification_preferences WHERE employee_id = ? AND notification_type = ?'
    ).get(employee.id, notification_type);

    const now = new Date().toISOString();
    if (existing) {
      await db.prepare(
        'UPDATE notification_preferences SET delivery = ?, updated_at = ? WHERE id = ?'
      ).run(delivery, now, existing.id);
    } else {
      await db.prepare(
        'INSERT INTO notification_preferences (id, organization_id, employee_id, notification_type, delivery, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), org.id, employee.id, notification_type, delivery, now, now);
    }

    res.json({ data: { success: true, notification_type, delivery } });
  } catch (e) {
    console.error('PUT /notifications/preferences error:', e);
    res.status(500).json({ error: 'Failed to update notification preference' });
  }
});

/**
 * GET /api/notifications/org-defaults
 * Returns org-wide notification defaults. Admin only.
 */
router.get('/org-defaults', async (req, res) => {
  try {
    if (req.superAdmin) {
      return res.status(400).json({ error: 'Use org impersonation to access org defaults' });
    }
    const { org, employee } = await getEmployeeContext(req.user.email);
    if (!org || !employee) return res.status(403).json({ error: 'No active employee record' });
    if (employee.permission_level !== 'org_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const defaults = await db.prepare(
      'SELECT notification_type, delivery FROM org_notification_defaults WHERE organization_id = ?'
    ).all(org.id);

    const defaultMap = {};
    for (const d of defaults) defaultMap[d.notification_type] = d.delivery;

    const result = NOTIFICATION_TYPES.map(type => ({
      notification_type: type,
      delivery: defaultMap[type] || 'immediate',
    }));

    res.json({ data: result });
  } catch (e) {
    console.error('GET /notifications/org-defaults error:', e);
    res.status(500).json({ error: 'Failed to fetch org notification defaults' });
  }
});

/**
 * PUT /api/notifications/org-defaults
 * Upsert org-wide default for a notification type. Admin only.
 * Body: { notification_type, delivery }
 */
router.put('/org-defaults', async (req, res) => {
  try {
    if (req.superAdmin) {
      return res.status(400).json({ error: 'Use org impersonation to update org defaults' });
    }
    const { notification_type, delivery } = req.body;
    if (!notification_type || !delivery) {
      return res.status(400).json({ error: 'notification_type and delivery required' });
    }
    if (!NOTIFICATION_TYPES.includes(notification_type)) {
      return res.status(400).json({ error: `Invalid notification_type. Must be one of: ${NOTIFICATION_TYPES.join(', ')}` });
    }
    if (!DELIVERY_OPTIONS.includes(delivery)) {
      return res.status(400).json({ error: `Invalid delivery. Must be one of: ${DELIVERY_OPTIONS.join(', ')}` });
    }

    const { org, employee } = await getEmployeeContext(req.user.email);
    if (!org || !employee) return res.status(403).json({ error: 'No active employee record' });
    if (employee.permission_level !== 'org_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const existing = await db.prepare(
      'SELECT id FROM org_notification_defaults WHERE organization_id = ? AND notification_type = ?'
    ).get(org.id, notification_type);

    const now = new Date().toISOString();
    if (existing) {
      await db.prepare(
        'UPDATE org_notification_defaults SET delivery = ?, updated_at = ? WHERE id = ?'
      ).run(delivery, now, existing.id);
    } else {
      await db.prepare(
        'INSERT INTO org_notification_defaults (id, organization_id, notification_type, delivery, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), org.id, notification_type, delivery, now, now);
    }

    res.json({ data: { success: true, notification_type, delivery } });
  } catch (e) {
    console.error('PUT /notifications/org-defaults error:', e);
    res.status(500).json({ error: 'Failed to update org notification default' });
  }
});

export { router as notificationsRouter };
