CREATE TABLE "credit_usage_log" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"service_type" text NOT NULL,
	"resume_id" uuid,
	"tenant_id" text DEFAULT 'yCXkn-v4fkLZw9FKXOAg8' NOT NULL,
	"organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_quota" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"service_type" text NOT NULL,
	"total_credits" integer DEFAULT -1 NOT NULL,
	"used_credits" integer DEFAULT 0 NOT NULL,
	"tenant_id" text DEFAULT 'yCXkn-v4fkLZw9FKXOAg8' NOT NULL,
	"organisation_id" text DEFAULT 'kAvyiiLGzMFOyOeVkcm5o' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_quota_user_id_service_type_unique" UNIQUE("user_id","service_type")
);
--> statement-breakpoint
CREATE INDEX "credit_usage_log_user_id_index" ON "credit_usage_log" ("user_id");--> statement-breakpoint
CREATE INDEX "credit_usage_log_user_id_service_type_index" ON "credit_usage_log" ("user_id","service_type");--> statement-breakpoint
CREATE INDEX "credit_usage_log_user_id_created_at_index" ON "credit_usage_log" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "credit_usage_log_tenant_id_index" ON "credit_usage_log" ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_quota_user_id_index" ON "user_quota" ("user_id");--> statement-breakpoint
CREATE INDEX "user_quota_tenant_id_index" ON "user_quota" ("tenant_id");--> statement-breakpoint
ALTER TABLE "credit_usage_log" ADD CONSTRAINT "credit_usage_log_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "credit_usage_log" ADD CONSTRAINT "credit_usage_log_resume_id_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resume"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "user_quota" ADD CONSTRAINT "user_quota_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;