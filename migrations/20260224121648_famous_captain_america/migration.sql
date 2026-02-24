CREATE TABLE "user_info" (
	"id" uuid PRIMARY KEY,
	"data" jsonb NOT NULL,
	"user_id" uuid NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "user_info_user_id_index" ON "user_info" ("user_id");--> statement-breakpoint
ALTER TABLE "user_info" ADD CONSTRAINT "user_info_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;