-- Rows saved before this change have no organisation. They are only on local databases (the platform database is
-- migrated from eng-labs-monorepo), and the starter set reseeds the next time a reviewer opens the comment bank.
DELETE FROM "review_snippet";--> statement-breakpoint
ALTER TABLE "review_snippet" ADD COLUMN "organisation_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "review_snippet" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "review_snippet_organisation_id_idx" ON "review_snippet" ("organisation_id");--> statement-breakpoint
CREATE INDEX "review_snippet_author_id_idx" ON "review_snippet" ("author_id");