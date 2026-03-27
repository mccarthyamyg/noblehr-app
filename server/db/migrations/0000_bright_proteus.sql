CREATE TABLE "acknowledgments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"policy_version_id" text NOT NULL,
	"policy_title" text,
	"version_number" integer,
	"employee_id" text NOT NULL,
	"employee_name" text,
	"employee_email" text,
	"employee_role_at_time" text,
	"employee_location_at_time" text,
	"acknowledged_at" text NOT NULL,
	"content_hash" text NOT NULL,
	"is_locked" integer DEFAULT 1,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "amendments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"record_id" text NOT NULL,
	"record_type" text NOT NULL,
	"field_changed" text,
	"old_value" text,
	"new_value" text,
	"amended_by_email" text,
	"amendment_note" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_checklist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"state" text NOT NULL,
	"industry" text,
	"requirement_key" text NOT NULL,
	"requirement_text" text NOT NULL,
	"suggested_answer" text,
	"confirmed" integer DEFAULT 0,
	"confirmed_at" text,
	"confirmed_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_email" text NOT NULL,
	"full_name" text,
	"role" text,
	"department" text,
	"location_id" text,
	"permission_level" text DEFAULT 'employee',
	"status" text DEFAULT 'active',
	"hire_date" text,
	"phone_number" text,
	"email_reminders" integer DEFAULT 0,
	"sms_reminders" integer DEFAULT 0,
	"tags" text,
	"capabilities" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "handbooks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft',
	"policy_sections" text,
	"source" text,
	"created_by_email" text,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hr_records" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"record_type" text DEFAULT 'write_up',
	"title" text,
	"description" text,
	"status" text DEFAULT 'submitted',
	"is_locked" integer DEFAULT 0,
	"severity" text,
	"discipline_level" integer,
	"acknowledged_at" text,
	"acknowledged_by_email" text,
	"created_by_email" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "incident_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"title" text,
	"description" text,
	"status" text DEFAULT 'submitted',
	"is_locked" integer DEFAULT 0,
	"attachments" text,
	"admin_notes" text,
	"incident_type" text,
	"incident_date" text,
	"location_id" text,
	"severity" text,
	"witnesses" text,
	"acknowledged_at" text,
	"acknowledged_by_email" text,
	"created_by_email" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_by_email" text,
	"full_name" text,
	"role" text,
	"location_id" text,
	"used_at" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboardings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"employee_name" text,
	"employee_email" text,
	"assigned_policy_ids" text,
	"completed_policy_ids" text,
	"due_date" text,
	"start_date" text,
	"completed_date" text,
	"status" text DEFAULT 'not_started',
	"reminder_sent_count" integer DEFAULT 0,
	"last_reminder_date" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"industry" text,
	"settings" text,
	"status" text DEFAULT 'pending_approval',
	"state" text,
	"tos_accepted_at" text,
	"approval_token" text,
	"approval_token_expires_at" text,
	"last_approval_email_sent_at" text,
	"deleted_at" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"used_at" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pending_re_acknowledgments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"version_number" integer,
	"previous_version_number" integer,
	"due_date" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"created_by_email" text,
	"deleted_at" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft',
	"current_version" integer DEFAULT 0,
	"draft_content" text,
	"applies_to" text,
	"acknowledgment_required" integer DEFAULT 1,
	"handbook_category" text,
	"handbook_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policy_targeting_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"override_type" text NOT NULL,
	"employee_id" text,
	"role" text,
	"location_id" text,
	"applies" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"policy_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"content" text NOT NULL,
	"is_locked" integer DEFAULT 1,
	"change_summary" text,
	"effective_date" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_type" text NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" text NOT NULL,
	"used_at" text,
	"revoked_at" text
);
--> statement-breakpoint
CREATE TABLE "super_admins" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "super_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "system_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"actor_email" text,
	"actor_name" text,
	"summary" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text,
	"auth_provider" text DEFAULT 'email',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbooks" ADD CONSTRAINT "handbooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_acknowledgments_emp" ON "acknowledgments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_acknowledgments_policy" ON "acknowledgments" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "idx_amendments_org" ON "amendments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_org" ON "compliance_checklist_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_compliance_state_industry" ON "compliance_checklist_items" USING btree ("state","industry");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_org_email" ON "employees" USING btree ("organization_id","user_email");--> statement-breakpoint
CREATE INDEX "idx_employees_org" ON "employees" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_employees_email" ON "employees" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "idx_policies_org" ON "policies" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_refresh_token_hash" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_refresh_user" ON "refresh_tokens" USING btree ("user_type","user_id");--> statement-breakpoint
CREATE INDEX "idx_system_events_org" ON "system_events" USING btree ("organization_id");