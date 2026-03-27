CREATE TABLE "resume_checklist" (
	"id" uuid PRIMARY KEY,
	"faculty_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"course_id" text,
	"title" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_checklist_item" (
	"id" uuid PRIMARY KEY,
	"checklist_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"weight" real DEFAULT 1 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_comment" (
	"id" uuid PRIMARY KEY,
	"resume_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"author_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"content" text NOT NULL,
	"scope" text DEFAULT 'INDIVIDUAL' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_evaluation" (
	"id" uuid PRIMARY KEY,
	"resume_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"checklist_id" uuid NOT NULL,
	"overall_score" real,
	"is_auto_generated" boolean DEFAULT false NOT NULL,
	"evaluated_by" uuid NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_evaluation_item" (
	"id" uuid PRIMARY KEY,
	"evaluation_id" uuid NOT NULL,
	"checklist_item_id" uuid NOT NULL,
	"passed" boolean NOT NULL,
	"notes" text,
	"score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_history" (
	"id" uuid PRIMARY KEY,
	"resume_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"action" text NOT NULL,
	"previous_data" jsonb,
	"current_data" jsonb,
	"changed_by" uuid NOT NULL,
	"actor_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "resume_checklist_faculty_id_index" ON "resume_checklist" ("faculty_id");--> statement-breakpoint
CREATE INDEX "resume_checklist_course_id_index" ON "resume_checklist" ("course_id");--> statement-breakpoint
CREATE INDEX "resume_checklist_tenant_id_index" ON "resume_checklist" ("tenant_id");--> statement-breakpoint
CREATE INDEX "resume_checklist_item_checklist_id_index" ON "resume_checklist_item" ("checklist_id");--> statement-breakpoint
CREATE INDEX "resume_comment_resume_id_index" ON "resume_comment" ("resume_id");--> statement-breakpoint
CREATE INDEX "resume_comment_student_id_index" ON "resume_comment" ("student_id");--> statement-breakpoint
CREATE INDEX "resume_comment_tenant_id_index" ON "resume_comment" ("tenant_id");--> statement-breakpoint
CREATE INDEX "resume_comment_author_id_index" ON "resume_comment" ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resume_evaluation_resume_id_checklist_id_index" ON "resume_evaluation" ("resume_id","checklist_id");--> statement-breakpoint
CREATE INDEX "resume_evaluation_student_id_index" ON "resume_evaluation" ("student_id");--> statement-breakpoint
CREATE INDEX "resume_evaluation_tenant_id_index" ON "resume_evaluation" ("tenant_id");--> statement-breakpoint
CREATE INDEX "resume_evaluation_checklist_id_index" ON "resume_evaluation" ("checklist_id");--> statement-breakpoint
CREATE INDEX "resume_evaluation_item_evaluation_id_index" ON "resume_evaluation_item" ("evaluation_id");--> statement-breakpoint
CREATE INDEX "resume_history_resume_id_index" ON "resume_history" ("resume_id");--> statement-breakpoint
CREATE INDEX "resume_history_student_id_index" ON "resume_history" ("student_id");--> statement-breakpoint
CREATE INDEX "resume_history_tenant_id_index" ON "resume_history" ("tenant_id");--> statement-breakpoint
ALTER TABLE "resume_checklist_item" ADD CONSTRAINT "resume_checklist_item_checklist_id_resume_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "resume_checklist"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resume_comment" ADD CONSTRAINT "resume_comment_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resume_evaluation" ADD CONSTRAINT "resume_evaluation_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resume_evaluation" ADD CONSTRAINT "resume_evaluation_checklist_id_resume_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "resume_checklist"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resume_evaluation_item" ADD CONSTRAINT "resume_evaluation_item_evaluation_id_resume_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "resume_evaluation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resume_evaluation_item" ADD CONSTRAINT "resume_evaluation_item_1lWt3I7y5W9U_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "resume_checklist_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resume_history" ADD CONSTRAINT "resume_history_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE CASCADE;