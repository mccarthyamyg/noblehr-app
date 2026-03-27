CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE TABLE "audit"."logged_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_email" text,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"old_data" jsonb,
	"new_data" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_logged_actions_org" ON "audit"."logged_actions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_logged_actions_created" ON "audit"."logged_actions" USING btree ("created_at");
--> statement-breakpoint
-- Immutability: block UPDATE/DELETE for all roles (including owner)
CREATE OR REPLACE FUNCTION audit.reject_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit.logged_actions is append-only: UPDATE and DELETE are not allowed';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER logged_actions_immutable
  BEFORE UPDATE OR DELETE ON audit.logged_actions
  FOR EACH ROW EXECUTE FUNCTION audit.reject_update_delete();
--> statement-breakpoint
-- Revoke UPDATE/DELETE so app role cannot modify even if it owns the table
REVOKE UPDATE, DELETE ON audit.logged_actions FROM PUBLIC;