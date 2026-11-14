CREATE TYPE "public"."fixture_count_metric" AS ENUM('participants', 'agents', 'launched', 'in_progress', 'votes', 'reviews');--> statement-breakpoint
CREATE TABLE "participations" (
	"user_id" uuid NOT NULL,
	"challenge_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "participations_userId_challengeId_unique" UNIQUE("user_id","challenge_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"is_automated" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fixture_count_extras" (
	"subject_id" uuid NOT NULL,
	"metric" "fixture_count_metric" NOT NULL,
	"n" integer NOT NULL,
	CONSTRAINT "fixture_count_extras_subject_id_metric_pk" PRIMARY KEY("subject_id","metric")
);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "number" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "intro" text;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "built_for" text;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "starts_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "pitch" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "live_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "tools" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "screenshots" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participations" ADD CONSTRAINT "participations_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_parent_id_reviews_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participations_challenge_id_index" ON "participations" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "reviews_project_id_index" ON "reviews" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_number_unique" UNIQUE("number");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_slug_unique" UNIQUE("slug");