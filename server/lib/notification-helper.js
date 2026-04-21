/**
 * Notification Helper — checks per-employee delivery preferences
 * before dispatching email notifications.
 *
 * Lookup order: employee override → org default → platform default ('immediate').
 */
import { db } from './db-pg-adapter.js';

/** Valid delivery values */
export const DELIVERY_OPTIONS = ['immediate', 'daily_digest', 'off'];

/** HR-specific notification types */
export const NOTIFICATION_TYPES = [
  'policy_published',
  'acknowledgment_reminder',
  'hr_record_created',
  'incident_update',
  'onboarding_assigned',
];

/**
 * Get the delivery preference for an employee + notification type.
 * Falls back: employee pref → org default → 'immediate'.
 */
export async function getDeliveryPreference(employeeId, orgId, notificationType) {
  // 1. Employee-level override
  const empPref = await db.prepare(
    'SELECT delivery FROM notification_preferences WHERE employee_id = ? AND notification_type = ?'
  ).get(employeeId, notificationType);
  if (empPref) return empPref.delivery;

  // 2. Org-level default
  const orgDefault = await db.prepare(
    'SELECT delivery FROM org_notification_defaults WHERE organization_id = ? AND notification_type = ?'
  ).get(orgId, notificationType);
  if (orgDefault) return orgDefault.delivery;

  // 3. Platform default
  return 'immediate';
}

/**
 * Convenience: should this notification be sent immediately?
 */
export async function shouldSendImmediate(employeeId, orgId, notificationType) {
  const delivery = await getDeliveryPreference(employeeId, orgId, notificationType);
  return delivery === 'immediate';
}

/**
 * Check preference and dispatch email if delivery is 'immediate'.
 * @param {string} employeeId
 * @param {string} orgId
 * @param {string} notificationType
 * @param {Function} emailFn - async function that sends the email (called only if immediate)
 * @returns {Promise<{sent: boolean, delivery: string}>}
 */
export async function sendNotificationIfEnabled(employeeId, orgId, notificationType, emailFn) {
  const delivery = await getDeliveryPreference(employeeId, orgId, notificationType);
  if (delivery === 'immediate') {
    try {
      await emailFn();
      return { sent: true, delivery };
    } catch (err) {
      console.error(`[Notification] Failed to send ${notificationType} to employee ${employeeId}:`, err.message);
      return { sent: false, delivery, error: err.message };
    }
  }
  // daily_digest: would be picked up by a future cron job
  // off: silently skip
  return { sent: false, delivery };
}
