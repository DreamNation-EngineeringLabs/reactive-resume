ALTER TABLE "ats_score_history" ADD COLUMN "tenant_id" text DEFAULT 'yCXkn-v4fkLZw9FKXOAg8' NOT NULL;--> statement-breakpoint
ALTER TABLE "ats_score_history" ADD COLUMN "organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL;--> statement-breakpoint
ALTER TABLE "po_section_review" ADD COLUMN "organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "tenant_id" text DEFAULT 'yCXkn-v4fkLZw9FKXOAg8' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_checklist" ADD COLUMN "organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_comment" ADD COLUMN "organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_evaluation" ADD COLUMN "organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_history" ADD COLUMN "organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tenant_id" text DEFAULT 'yCXkn-v4fkLZw9FKXOAg8' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_info" ADD COLUMN "tenant_id" text DEFAULT 'yCXkn-v4fkLZw9FKXOAg8' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_info" ADD COLUMN "organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL;--> statement-breakpoint
ALTER TABLE "po_section_review" ALTER COLUMN "tenant_id" SET DEFAULT 'yCXkn-v4fkLZw9FKXOAg8';--> statement-breakpoint
ALTER TABLE "resume_checklist" ALTER COLUMN "tenant_id" SET DEFAULT 'yCXkn-v4fkLZw9FKXOAg8';--> statement-breakpoint
ALTER TABLE "resume_comment" ALTER COLUMN "tenant_id" SET DEFAULT 'yCXkn-v4fkLZw9FKXOAg8';--> statement-breakpoint
ALTER TABLE "resume_evaluation" ALTER COLUMN "tenant_id" SET DEFAULT 'yCXkn-v4fkLZw9FKXOAg8';--> statement-breakpoint
ALTER TABLE "resume_history" ALTER COLUMN "tenant_id" SET DEFAULT 'yCXkn-v4fkLZw9FKXOAg8';