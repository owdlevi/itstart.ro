ALTER TABLE "challenges" ADD COLUMN "launch_check" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_late" boolean DEFAULT false NOT NULL;