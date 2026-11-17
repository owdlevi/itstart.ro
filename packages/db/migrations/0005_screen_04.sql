CREATE TYPE "public"."build_duration" AS ENUM('under_10h', '10_30h', 'over_30h');--> statement-breakpoint
CREATE TABLE "review_assignments" (
	"reviewer_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	CONSTRAINT "review_assignments_reviewerId_projectId_unique" UNIQUE("reviewer_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "build_duration" "build_duration";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "build_duration_text" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "build_hardest_part" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "build_prompt" text;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_author_id_created_at_index" ON "reviews" USING btree ("author_id","created_at");