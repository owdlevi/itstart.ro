ALTER TABLE "projects" ADD COLUMN "link_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "link_ok" boolean;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "link_failed_at" timestamp with time zone;