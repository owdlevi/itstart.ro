ALTER TYPE "public"."fixture_count_metric" ADD VALUE 'launchers' BEFORE 'votes';--> statement-breakpoint
CREATE TABLE "project_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_updates_projectId_version_unique" UNIQUE("project_id","version")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "given_name" text;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "scenario_note" text;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "scenario" text;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "base_level" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "stretch" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "launch_criteria" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "launch_note" text;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "materials_url" text;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "materials_note" text;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "tips" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "jury_note" text;--> statement-breakpoint
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;