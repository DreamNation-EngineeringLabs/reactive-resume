import * as pg from "drizzle-orm/pg-core";
import { defaultResumeData, type ResumeData } from "@/schema/resume/data";
import type { UserInfoData } from "@/schema/resume/user-info";
import { generateId } from "@/utils/string";

// Workaround for CockroachDB internal types that Drizzle should ignore/recognize
export const crdbInternalRegion = pg.pgEnum("crdb_internal_region", ["aws-ap-south-1"]);

export const user = pg.pgTable(
	"user",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		image: pg.text("image"),
		name: pg.text("name").notNull(),
		email: pg.text("email").notNull().unique(),
		emailVerified: pg.boolean("email_verified").notNull().default(false),
		username: pg.text("username").notNull().unique(),
		displayUsername: pg.text("display_username").notNull().unique(),
		twoFactorEnabled: pg.boolean("two_factor_enabled").notNull().default(false),
		tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"),
		organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.createdAt.asc())],
);

export const session = pg.pgTable(
	"session",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		token: pg.text("token").notNull().unique(),
		ipAddress: pg.text("ip_address"),
		userAgent: pg.text("user_agent"),
		userId: pg
			.uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		expiresAt: pg.timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.token, t.userId), pg.index().on(t.expiresAt)],
);

export const account = pg.pgTable(
	"account",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		accountId: pg.text("account_id").notNull(),
		providerId: pg.text("provider_id").notNull().default("credential"),
		userId: pg
			.uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		scope: pg.text("scope"),
		idToken: pg.text("id_token"),
		password: pg.text("password"),
		accessToken: pg.text("access_token"),
		refreshToken: pg.text("refresh_token"),
		accessTokenExpiresAt: pg.timestamp("access_token_expires_at", { withTimezone: true }),
		refreshTokenExpiresAt: pg.timestamp("refresh_token_expires_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.userId)],
);

export const verification = pg.pgTable("verification", {
	id: pg
		.uuid("id")
		.notNull()
		.primaryKey()
		.$defaultFn(() => generateId()),
	identifier: pg.text("identifier").notNull().unique(),
	value: pg.text("value").notNull(),
	expiresAt: pg.timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: pg
		.timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date()),
});

export const twoFactor = pg.pgTable(
	"two_factor",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg
			.uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		secret: pg.text("secret"),
		backupCodes: pg.text("backup_codes"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.userId), pg.index().on(t.secret)],
);

export const passkey = pg.pgTable(
	"passkey",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		name: pg.text("name"),
		aaguid: pg.text("aaguid"),
		publicKey: pg.text("public_key").notNull(),
		credentialID: pg.text("credential_id").notNull(),
		counter: pg.integer("counter").notNull(),
		deviceType: pg.text("device_type").notNull(),
		backedUp: pg.boolean("backed_up").notNull().default(false),
		transports: pg.text("transports").notNull(),
		userId: pg
			.uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.userId)],
);

export const resume = pg.pgTable(
	"resume",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		name: pg.text("name").notNull(),
		slug: pg.text("slug").notNull(),
		tags: pg.text("tags").array().notNull().default([]),
		isPublic: pg.boolean("is_public").notNull().default(false),
		isLocked: pg.boolean("is_locked").notNull().default(false),
		isPrimary: pg.boolean("is_primary").notNull().default(false),
		password: pg.text("password"),
		data: pg
			.jsonb("data")
			.notNull()
			.$type<ResumeData>()
			.$defaultFn(() => defaultResumeData),
		userId: pg
			.uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		reviewStatus: pg.text("review_status").notNull().default("DRAFT"), // DRAFT | SUBMITTED_TO_FACULTY | FACULTY_REVISION_REQUESTED | FACULTY_VERIFIED | FINALIZED_BY_FACULTY | SUBMITTED_TO_PO | PO_REVISION_REQUESTED | RESUBMITTED_TO_PO | APPROVED
		locked: pg.boolean("locked").notNull().default(false),
		tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"),
		organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),
		unlockReason: pg.text("unlock_reason"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.unique().on(t.slug, t.userId),
		pg.index().on(t.userId),
		pg.index().on(t.reviewStatus),
		pg.index().on(t.createdAt.asc()),
		pg.index().on(t.userId, t.updatedAt.desc()),
		pg.index().on(t.isPublic, t.slug, t.userId),
	],
);

export const resumeStatistics = pg.pgTable("resume_statistics", {
	id: pg
		.uuid("id")
		.notNull()
		.primaryKey()
		.$defaultFn(() => generateId()),
	views: pg.integer("views").notNull().default(0),
	downloads: pg.integer("downloads").notNull().default(0),
	lastViewedAt: pg.timestamp("last_viewed_at", { withTimezone: true }),
	lastDownloadedAt: pg.timestamp("last_downloaded_at", { withTimezone: true }),
	resumeId: pg
		.uuid("resume_id")
		.unique()
		.notNull()
		.references(() => resume.id, { onDelete: "cascade" }),
	createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: pg
		.timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date()),
});

export const userInfo = pg.pgTable("user_info", {
	id: pg
		.uuid("id")
		.notNull()
		.primaryKey()
		.$defaultFn(() => generateId()),
	data: pg.jsonb("data").notNull().$type<UserInfoData>(),
	userId: pg
		.uuid("user_id")
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: "cascade" }),
	tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"),
	organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),
	createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: pg
		.timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date()),
});

export const apikey = pg.pgTable(
	"apikey",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		name: pg.text("name"),
		start: pg.text("start"),
		prefix: pg.text("prefix"),
		key: pg.text("key").notNull(),
		userId: pg
			.uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		refillInterval: pg.integer("refill_interval"),
		refillAmount: pg.integer("refill_amount"),
		lastRefillAt: pg.timestamp("last_refill_at", { withTimezone: true }),
		enabled: pg.boolean("enabled").notNull().default(true),
		rateLimitEnabled: pg.boolean("rate_limit_enabled").notNull().default(false),
		rateLimitTimeWindow: pg.integer("rate_limit_time_window"),
		rateLimitMax: pg.integer("rate_limit_max"),
		requestCount: pg.integer("request_count").notNull().default(0),
		remaining: pg.integer("remaining"),
		lastRequest: pg.timestamp("last_request", { withTimezone: true }),
		expiresAt: pg.timestamp("expires_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
		permissions: pg.text("permissions"),
		metadata: pg.jsonb("metadata"),
	},
	(t) => [pg.index().on(t.userId), pg.index().on(t.key), pg.index().on(t.enabled, t.userId)],
);

// ─────────────────────────────────────────────────────────────────────────────
// Resume Feedback & Institutional Integration Tables
// ─────────────────────────────────────────────────────────────────────────────

export const resumeComment = pg.pgTable(
	"resume_comment",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		resumeId: pg
			.uuid("resume_id")
			.notNull()
			.references(() => resume.id, { onDelete: "cascade" }),
		tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"), // Reference to eng-labs tenant
		organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),
		authorId: pg.text("author_id").notNull(), // eng-labs user ID (faculty/PO)
		studentId: pg.text("student_id").notNull(), // eng-labs user ID (student)
		parentId: pg.uuid("parent_id"), // Support for nested replies
		content: pg.text("content").notNull(),
		scope: pg.text("scope").notNull().default("INDIVIDUAL"), // INDIVIDUAL | SECTION
		status: pg.text("status").notNull().default("OPEN"), // OPEN | ADDRESSED | RESOLVED
		resolvedAt: pg.timestamp("resolved_at", { withTimezone: true }),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.index().on(t.resumeId),
		pg.index().on(t.studentId),
		pg.index().on(t.tenantId),
		pg.index().on(t.authorId),
		pg.index().on(t.parentId),
	],
);

export const resumeChecklist = pg.pgTable(
	"resume_checklist",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		facultyId: pg.text("faculty_id").notNull(), // eng-labs faculty user ID
		tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"), // Reference to eng-labs tenant
		organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),
		courseId: pg.text("course_id"), // eng-labs course ID
		title: pg.text("title").notNull(),
		description: pg.text("description"),
		isActive: pg.boolean("is_active").notNull().default(true),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.facultyId), pg.index().on(t.courseId), pg.index().on(t.tenantId)],
);

export const resumeChecklistItem = pg.pgTable(
	"resume_checklist_item",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		checklistId: pg
			.uuid("checklist_id")
			.notNull()
			.references(() => resumeChecklist.id, { onDelete: "cascade" }),
		title: pg.text("title").notNull(),
		description: pg.text("description"),
		weight: pg.real("weight").notNull().default(1.0),
		order: pg.integer("order").notNull().default(0),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.checklistId)],
);

export const resumeEvaluation = pg.pgTable(
	"resume_evaluation",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		resumeId: pg
			.uuid("resume_id")
			.notNull()
			.references(() => resume.id, { onDelete: "cascade" }),
		studentId: pg.text("student_id").notNull(), // eng-labs user ID
		tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"), // Reference to eng-labs tenant
		organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),
		checklistId: pg
			.uuid("checklist_id")
			.notNull()
			.references(() => resumeChecklist.id, { onDelete: "cascade" }),
		overallScore: pg.real("overall_score"),
		isAutoGenerated: pg.boolean("is_auto_generated").notNull().default(false),
		snapshot: pg.jsonb("snapshot"),
		evaluatedBy: pg.text("evaluated_by").notNull(), // eng-labs faculty/PO user ID
		evaluatedAt: pg.timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.uniqueIndex().on(t.resumeId, t.checklistId),
		pg.index().on(t.studentId),
		pg.index().on(t.tenantId),
		pg.index().on(t.checklistId),
	],
);

export const resumeEvaluationItem = pg.pgTable(
	"resume_evaluation_item",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		evaluationId: pg
			.uuid("evaluation_id")
			.notNull()
			.references(() => resumeEvaluation.id, { onDelete: "cascade" }),
		checklistItemId: pg
			.uuid("checklist_item_id")
			.notNull()
			.references(() => resumeChecklistItem.id, { onDelete: "cascade" }),
		passed: pg.boolean("passed").notNull(),
		notes: pg.text("notes"),
		score: pg.real("score"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.evaluationId)],
);

export const resumeHistory = pg.pgTable(
	"resume_history",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		resumeId: pg
			.uuid("resume_id")
			.notNull()
			.references(() => resume.id, { onDelete: "cascade" }),
		studentId: pg.text("student_id").notNull(), // eng-labs user ID
		tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"), // Reference to eng-labs tenant
		organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),
		action: pg.text("action").notNull(), // CREATED | UPDATED | COMMENTED | EVALUATED | FORWARDED
		previousData: pg.jsonb("previous_data"),
		currentData: pg.jsonb("current_data"),
		changedBy: pg.text("changed_by").notNull(), // eng-labs user ID
		actorType: pg.text("actor_type").notNull(), // LEARNER | INSTRUCTOR | PLACEMENT_OFFICER | ADMIN
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.resumeId), pg.index().on(t.studentId), pg.index().on(t.tenantId)],
);

export const poSectionReview = pg.pgTable(
	"po_section_review",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		/** eng-labs section / org-unit ID */
		sectionId: pg.text("section_id").notNull(),
		tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"),
		organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),
		/** eng-labs ID of the faculty member who submitted the section (optional — query by sectionId instead) */
		facultyId: pg.text("faculty_id"),
		/** eng-labs ID of the PO who is sending the review back */
		poId: pg.text("po_id").notNull(),
		reviewNotes: pg.text("review_notes").notNull(),
		/** URL of voice note recorded/uploaded by PO (optional) */
		voiceNoteUrl: pg.text("voice_note_url"),
		/** Snapshot of resume IDs that were part of this submission batch */
		resumeIds: pg.text("resume_ids").array().notNull().default([]),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg.index().on(t.sectionId),
		pg.index().on(t.tenantId),
		pg.index().on(t.facultyId),
		// Most queries fetch latest review for a section
		pg.index().on(t.sectionId, t.createdAt.desc()),
	],
);

// ─── Quota / Credit Tracking ─────────────────────────────────────────────────

export type QuotaServiceType = "RESUME_CREATE" | "ATS_SCORE";

/**
 * Per-user credit allocation per service type.
 * totalCredits = -1 means unlimited.
 * If no row exists for a (userId, serviceType) pair the user is treated as unlimited.
 */
export const userQuota = pg.pgTable(
	"user_quota",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg
			.uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		serviceType: pg.text("service_type").notNull().$type<QuotaServiceType>(),
		/** Total credits allocated. -1 = unlimited. */
		totalCredits: pg.integer("total_credits").notNull().default(-1),
		usedCredits: pg.integer("used_credits").notNull().default(0),
		tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"),
		organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [
		pg.unique().on(t.userId, t.serviceType),
		pg.index().on(t.userId),
		pg.index().on(t.tenantId),
	],
);

/** Append-only log of every credit consumption event. */
export const creditUsageLog = pg.pgTable(
	"credit_usage_log",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg
			.uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		serviceType: pg.text("service_type").notNull().$type<QuotaServiceType>(),
		/** Optional: the resume involved in this action. */
		resumeId: pg.uuid("resume_id").references(() => resume.id, { onDelete: "set null" }),
		tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"),
		organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg.index().on(t.userId),
		pg.index().on(t.userId, t.serviceType),
		pg.index().on(t.userId, t.createdAt.desc()),
		pg.index().on(t.tenantId),
	],
);

// ─── ATS Score History ───────────────────────────────────────────────────────

/** Snapshot of one ATS scoring run — stored so we can show score progression over time. */
export type AtsCategorySnapshot = {
	score: number;
	max: number;
};

export type AtsMajorImprovement = {
	/** Category key, e.g. "keywordMatch" */
	category: string;
	/** Human-readable label, e.g. "Keyword Match" */
	label: string;
	/** Points gained in this category vs previous run (positive = improvement) */
	delta: number;
};

export const atsScoreHistory = pg.pgTable(
	"ats_score_history",
	{
		id: pg
			.uuid("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),

		resumeId: pg
			.uuid("resume_id")
			.notNull()
			.references(() => resume.id, { onDelete: "cascade" }),

		userId: pg
			.uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),

		/** 0-100 overall ATS score for this run */
		overallScore: pg.integer("overall_score").notNull(),

		/** Per-category scores as a JSON map keyed by category name */
		categoryScores: pg.jsonb("category_scores").notNull().$type<Record<string, AtsCategorySnapshot>>(),

		/**
		 * Point change vs the immediately previous run for this resume.
		 * Null if this is the first recorded score.
		 */
		deltaScore: pg.integer("delta_score"),

		/**
		 * Top improvements compared to the previous run (categories that gained ≥ 1 pt).
		 * Empty array if this is the first run or scores did not improve.
		 */
		majorImprovements: pg.jsonb("major_improvements").notNull().$type<AtsMajorImprovement[]>().default([]),

		/** Whether a job description was provided for this scoring run */
		jobDescriptionProvided: pg.boolean("job_description_provided").notNull().default(false),

		tenantId: pg.text("tenant_id").notNull().default("yCXkn-v4fkLZw9FKXOAg8"),
		organisationId: pg.text("organisation_id").notNull().default("kAvyiiLGzMFOyOeVkcm5o"),

		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		pg.index().on(t.resumeId),
		pg.index().on(t.userId),
		// Most queries fetch history ordered by time
		pg.index().on(t.resumeId, t.createdAt.asc()),
		pg.index().on(t.userId, t.createdAt.desc()),
	],
);
