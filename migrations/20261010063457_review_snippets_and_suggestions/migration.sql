CREATE TABLE "review_snippet" (
	"id" uuid PRIMARY KEY,
	"tenant_id" text NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_snippet_tenant_id_content_unique" UNIQUE("tenant_id","content")
);
--> statement-breakpoint
ALTER TABLE "resume_comment" ADD COLUMN "suggestion" text;