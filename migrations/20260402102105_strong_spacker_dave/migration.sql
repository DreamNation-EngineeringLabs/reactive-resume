CREATE TYPE "crdb_internal_region" AS ENUM('aws-ap-south-1');--> statement-breakpoint
CREATE TABLE "ats_score_history" (
	"id" uuid PRIMARY KEY,
	"resume_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"overall_score" integer NOT NULL,
	"category_scores" jsonb NOT NULL,
	"delta_score" integer,
	"major_improvements" jsonb DEFAULT '[]' NOT NULL,
	"job_description_provided" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "review_status" text DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "resume" ADD COLUMN "unlock_reason" text;--> statement-breakpoint
ALTER TABLE "resume_comment" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "resume_evaluation" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "resume_checklist" ALTER COLUMN "faculty_id" SET DATA TYPE text USING "faculty_id"::text;--> statement-breakpoint
ALTER TABLE "resume_comment" ALTER COLUMN "author_id" SET DATA TYPE text USING "author_id"::text;--> statement-breakpoint
ALTER TABLE "resume_comment" ALTER COLUMN "student_id" SET DATA TYPE text USING "student_id"::text;--> statement-breakpoint
ALTER TABLE "resume_comment" ALTER COLUMN "status" SET DEFAULT 'OPEN';--> statement-breakpoint
ALTER TABLE "resume_evaluation" ALTER COLUMN "student_id" SET DATA TYPE text USING "student_id"::text;--> statement-breakpoint
ALTER TABLE "resume_evaluation" ALTER COLUMN "evaluated_by" SET DATA TYPE text USING "evaluated_by"::text;--> statement-breakpoint
ALTER TABLE "resume_history" ALTER COLUMN "student_id" SET DATA TYPE text USING "student_id"::text;--> statement-breakpoint
ALTER TABLE "resume_history" ALTER COLUMN "changed_by" SET DATA TYPE text USING "changed_by"::text;--> statement-breakpoint
CREATE INDEX "ats_score_history_resume_id_index" ON "ats_score_history" ("resume_id");--> statement-breakpoint
CREATE INDEX "ats_score_history_user_id_index" ON "ats_score_history" ("user_id");--> statement-breakpoint
CREATE INDEX "ats_score_history_resume_id_created_at_index" ON "ats_score_history" ("resume_id","created_at");--> statement-breakpoint
CREATE INDEX "ats_score_history_user_id_created_at_index" ON "ats_score_history" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "resume_review_status_index" ON "resume" ("review_status");--> statement-breakpoint
CREATE INDEX "resume_comment_parent_id_index" ON "resume_comment" ("parent_id");--> statement-breakpoint
ALTER TABLE "ats_score_history" ADD CONSTRAINT "ats_score_history_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ats_score_history" ADD CONSTRAINT "ats_score_history_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;