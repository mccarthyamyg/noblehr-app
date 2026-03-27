/**
 * Drizzle schema for PostgreSQL — mirrors server/scripts/init-db.js (SQLite).
 * Use when DATABASE_URL is set; SQLite remains default until migration.
 */
import {
  pgTable,
  pgSchema,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

// --- Users (auth - email/password or Google) ---
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name'),
  authProvider: text('auth_provider').default('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Super Admins ---
export const superAdmins = pgTable('super_admins', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Organizations ---
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry'),
  settings: text('settings'),
  status: text('status').default('pending_approval'),
  state: text('state'),
  tosAcceptedAt: text('tos_accepted_at'),
  approvalToken: text('approval_token'),
  approvalTokenExpiresAt: text('approval_token_expires_at'),
  lastApprovalEmailSentAt: text('last_approval_email_sent_at'),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Platform locations ---
export const platformLocations = pgTable('platform_locations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  createdByEmail: text('created_by_email'),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Locations ---
export const locations = pgTable('locations', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  address: text('address'),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Employees ---
export const employees = pgTable(
  'employees',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    userEmail: text('user_email').notNull(),
    fullName: text('full_name'),
    role: text('role'),
    department: text('department'),
    locationId: text('location_id').references(() => locations.id),
    permissionLevel: text('permission_level').default('employee'),
    status: text('status').default('active'),
    hireDate: text('hire_date'),
    phoneNumber: text('phone_number'),
    emailReminders: integer('email_reminders').default(0),
    smsReminders: integer('sms_reminders').default(0),
    tags: text('tags'),
    capabilities: text('capabilities'),
    deletedAt: text('deleted_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex('employees_org_email').on(t.organizationId, t.userEmail),
    index('idx_employees_org').on(t.organizationId),
    index('idx_employees_email').on(t.userEmail),
  ]
);

// --- Policies ---
export const policies = pgTable(
  'policies',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').default('draft'),
    currentVersion: integer('current_version').default(0),
    draftContent: text('draft_content'),
    appliesTo: text('applies_to'),
    acknowledgmentRequired: integer('acknowledgment_required').default(1),
    handbookCategory: text('handbook_category'),
    handbookId: text('handbook_id'),
    deletedAt: text('deleted_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_policies_org').on(t.organizationId)]
);

// --- Policy Versions (immutable) ---
export const policyVersions = pgTable('policy_versions', {
  id: text('id').primaryKey(),
  policyId: text('policy_id').notNull().references(() => policies.id),
  versionNumber: integer('version_number').notNull(),
  content: text('content').notNull(),
  isLocked: integer('is_locked').default(1),
  changeSummary: text('change_summary'),
  effectiveDate: text('effective_date'),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Acknowledgments (immutable) ---
export const acknowledgments = pgTable(
  'acknowledgments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    policyId: text('policy_id').notNull(),
    policyVersionId: text('policy_version_id').notNull(),
    policyTitle: text('policy_title'),
    versionNumber: integer('version_number'),
    employeeId: text('employee_id').notNull(),
    employeeName: text('employee_name'),
    employeeEmail: text('employee_email'),
    employeeRoleAtTime: text('employee_role_at_time'),
    employeeLocationAtTime: text('employee_location_at_time'),
    acknowledgedAt: text('acknowledged_at').notNull(),
    contentHash: text('content_hash').notNull(),
    isLocked: integer('is_locked').default(1),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    deletedAt: text('deleted_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_acknowledgments_emp').on(t.employeeId),
    index('idx_acknowledgments_policy').on(t.policyId),
  ]
);

// --- Pending Re-Acknowledgments ---
export const pendingReAcknowledgments = pgTable('pending_re_acknowledgments', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  policyId: text('policy_id').notNull(),
  employeeId: text('employee_id').notNull(),
  versionNumber: integer('version_number'),
  previousVersionNumber: integer('previous_version_number'),
  dueDate: text('due_date'),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Handbooks ---
export const handbooks = pgTable('handbooks', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').default('draft'),
  policySections: text('policy_sections'),
  source: text('source'),
  createdByEmail: text('created_by_email'),
  createdByName: text('created_by_name'),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Onboardings ---
export const onboardings = pgTable('onboardings', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  employeeId: text('employee_id').notNull(),
  employeeName: text('employee_name'),
  employeeEmail: text('employee_email'),
  assignedPolicyIds: text('assigned_policy_ids'),
  completedPolicyIds: text('completed_policy_ids'),
  dueDate: text('due_date'),
  startDate: text('start_date'),
  completedDate: text('completed_date'),
  status: text('status').default('not_started'),
  reminderSentCount: integer('reminder_sent_count').default(0),
  lastReminderDate: text('last_reminder_date'),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- HR Records ---
export const hrRecords = pgTable('hr_records', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  employeeId: text('employee_id').notNull(),
  recordType: text('record_type').default('write_up'),
  title: text('title'),
  description: text('description'),
  status: text('status').default('submitted'),
  isLocked: integer('is_locked').default(0),
  severity: text('severity'),
  disciplineLevel: integer('discipline_level'),
  acknowledgedAt: text('acknowledged_at'),
  acknowledgedByEmail: text('acknowledged_by_email'),
  createdByEmail: text('created_by_email'),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// --- Incident Reports ---
export const incidentReports = pgTable('incident_reports', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  employeeId: text('employee_id').notNull(),
  title: text('title'),
  description: text('description'),
  status: text('status').default('submitted'),
  isLocked: integer('is_locked').default(0),
  attachments: text('attachments'),
  adminNotes: text('admin_notes'),
  incidentType: text('incident_type'),
  incidentDate: text('incident_date'),
  locationId: text('location_id'),
  severity: text('severity'),
  witnesses: text('witnesses'),
  acknowledgedAt: text('acknowledged_at'),
  acknowledgedByEmail: text('acknowledged_by_email'),
  createdByEmail: text('created_by_email'),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// --- Amendments (immutable) ---
export const amendments = pgTable(
  'amendments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    recordId: text('record_id').notNull(),
    recordType: text('record_type').notNull(),
    fieldChanged: text('field_changed'),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    amendedByEmail: text('amended_by_email'),
    amendmentNote: text('amendment_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_amendments_org').on(t.organizationId)]
);

// --- System Events (immutable) ---
export const systemEvents = pgTable(
  'system_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    actorEmail: text('actor_email'),
    actorName: text('actor_name'),
    summary: text('summary'),
    metadata: text('metadata'),
    deletedAt: text('deleted_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_system_events_org').on(t.organizationId)]
);

// --- Policy Targeting Overrides ---
export const policyTargetingOverrides = pgTable('policy_targeting_overrides', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  policyId: text('policy_id').notNull(),
  overrideType: text('override_type').notNull(),
  employeeId: text('employee_id'),
  role: text('role'),
  locationId: text('location_id'),
  applies: integer('applies').default(0),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Invites ---
export const invites = pgTable('invites', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdByEmail: text('created_by_email'),
  fullName: text('full_name'),
  role: text('role'),
  locationId: text('location_id'),
  usedAt: text('used_at'),
  deletedAt: text('deleted_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Password reset tokens ---
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- Refresh tokens ---
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userType: text('user_type').notNull(),
    userId: text('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    revokedAt: text('revoked_at'),
  },
  (t) => [
    uniqueIndex('idx_refresh_token_hash').on(t.tokenHash),
    index('idx_refresh_user').on(t.userType, t.userId),
  ]
);

// --- Compliance checklist ---
export const complianceChecklistItems = pgTable(
  'compliance_checklist_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    state: text('state').notNull(),
    industry: text('industry'),
    requirementKey: text('requirement_key').notNull(),
    requirementText: text('requirement_text').notNull(),
    suggestedAnswer: text('suggested_answer'),
    confirmed: integer('confirmed').default(0),
    confirmedAt: text('confirmed_at'),
    confirmedBy: text('confirmed_by'),
    notes: text('notes'),
    deletedAt: text('deleted_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_compliance_org').on(t.organizationId),
    index('idx_compliance_state_industry').on(t.state, t.industry),
  ]
);

// --- Audit schema (4.4): append-only, separate schema, no UPDATE/DELETE ---
export const auditSchema = pgSchema('audit');

export const loggedActions = auditSchema.table(
  'logged_actions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    actorEmail: text('actor_email'),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    oldData: jsonb('old_data'),
    newData: jsonb('new_data'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_logged_actions_org').on(t.organizationId), index('idx_logged_actions_created').on(t.createdAt)]
);
