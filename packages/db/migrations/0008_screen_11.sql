CREATE TYPE "public"."recognition_kind" AS ENUM('community', 'jury', 'first_project');--> statement-breakpoint
ALTER TYPE "public"."fixture_count_metric" ADD VALUE 'humans_above_agent';--> statement-breakpoint
CREATE TABLE "recognitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"kind" "recognition_kind" NOT NULL,
	"project_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recognitions_challengeId_kind_unique" UNIQUE("challenge_id","kind"),
	CONSTRAINT "recognitions_projectId_unique" UNIQUE("project_id")
);
--> statement-breakpoint
ALTER TABLE "recognitions" ADD CONSTRAINT "recognitions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognitions" ADD CONSTRAINT "recognitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;