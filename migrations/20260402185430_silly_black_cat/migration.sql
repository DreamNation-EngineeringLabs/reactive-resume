CREATE TABLE "po_section_review" (
	"id" uuid PRIMARY KEY,
	"section_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"faculty_id" text NOT NULL,
	"po_id" text NOT NULL,
	"review_notes" text NOT NULL,
	"voice_note_url" text,
	"resume_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "po_section_review_section_id_index" ON "po_section_review" ("section_id");--> statement-breakpoint
CREATE INDEX "po_section_review_tenant_id_index" ON "po_section_review" ("tenant_id");--> statement-breakpoint
CREATE INDEX "po_section_review_faculty_id_index" ON "po_section_review" ("faculty_id");--> statement-breakpoint
CREATE INDEX "po_section_review_section_id_created_at_index" ON "po_section_review" ("section_id","created_at" DESC NULLS LAST);