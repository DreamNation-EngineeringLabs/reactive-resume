/**
 * Dashboard oRPC Endpoints
 *
 * Provides:
 * - Student feedback dashboard (with comments per resume)
 * - Faculty/PO section-scoped dashboard (with package grouping)
 * - Admin metrics dashboard (with timeline)
 * - Student detail endpoint (for faculty's detail panel)
 * - Submit resume for review (student action)
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";
import {
	enrichByEmails,
	getAllOrgUnits,
	getAllSections,
	getEngLabsUserByEmail,
	getFacultyList,
	getInstructorPackages,
	getInstructorSections,
	getPlacementPackages,
	getSectionsByIds,
	getStudentEnrollmentInfo,
	getStudentsBySections,
	getUnitSchemaTypes,
} from "@/integrations/eng-labs";
import type { OrgUnitRow, PlacementPackage, Section } from "@/integrations/eng-labs/types";
import { protectedProcedure } from "../context";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getLocalUsersByEmails(emails: string[]) {
	if (emails.length === 0) return [];
	return db.select().from(schema.user).where(inArray(schema.user.email, emails));
}

async function getResumesForUsers(userIds: string[]) {
	if (userIds.length === 0) return [];
	return db
		.select()
		.from(schema.resume)
		.where(and(inArray(schema.resume.userId, userIds), eq(schema.resume.isPrimary, true)));
}

async function getCommentCountsByResumeIds(resumeIds: string[]) {
	if (resumeIds.length === 0) return new Map<string, number>();
	const comments = await db
		.select({ resumeId: schema.resumeComment.resumeId })
		.from(schema.resumeComment)
		.where(inArray(schema.resumeComment.resumeId, resumeIds));

	const counts = new Map<string, number>();
	for (const c of comments) {
		counts.set(c.resumeId, (counts.get(c.resumeId) ?? 0) + 1);
	}
	return counts;
}

async function getLatestEvaluationsByResumeIds(resumeIds: string[]) {
	if (resumeIds.length === 0) return new Map<string, number | null>();
	const evaluations = await db
		.select({
			resumeId: schema.resumeEvaluation.resumeId,
			overallScore: schema.resumeEvaluation.overallScore,
			evaluatedAt: schema.resumeEvaluation.evaluatedAt,
		})
		.from(schema.resumeEvaluation)
		.where(inArray(schema.resumeEvaluation.resumeId, resumeIds))
		.orderBy(desc(schema.resumeEvaluation.evaluatedAt));

	const latest = new Map<string, number | null>();
	for (const e of evaluations) {
		if (!latest.has(e.resumeId)) {
			latest.set(e.resumeId, e.overallScore);
		}
	}
	return latest;
}

/** Returns true if the most recent history action for a resume is "SUBMITTED" */
async function getSubmissionStatusByResumeIds(resumeIds: string[]) {
	if (resumeIds.length === 0) return new Map<string, boolean>();

	const history = await db
		.select({
			resumeId: schema.resumeHistory.resumeId,
			action: schema.resumeHistory.action,
		})
		.from(schema.resumeHistory)
		.where(inArray(schema.resumeHistory.resumeId, resumeIds))
		.orderBy(desc(schema.resumeHistory.createdAt));

	// Only keep the latest entry per resume
	const statusMap = new Map<string, boolean>();
	for (const h of history) {
		if (!statusMap.has(h.resumeId)) {
			statusMap.set(h.resumeId, h.action === "SUBMITTED");
		}
	}
	return statusMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Student Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export const studentDashboard = protectedProcedure
	.route({
		method: "GET",
		path: "/resumes/dashboard/student",
		tags: ["Dashboard"],
		operationId: "getStudentDashboard",
		summary: "Get student dashboard data",
		description: "Returns student's resumes along with feedback summaries and overall performance metrics.",
	})
	.input(
		z.object({
			userId: z.string().describe("User ID of the student"),
			engLabsUserId: z.string().optional().describe("Eng-labs user ID for enrollment lookup"),
			tenantId: z.string().optional().describe("Tenant ID (optional)"),
		}),
	)
	.handler(async ({ input }) => {
		const { userId } = input;

		const resumes = await db.select().from(schema.resume).where(eq(schema.resume.userId, userId));

		const resumeIds = resumes.map((r) => r.id);
		const [commentCounts, latestScores, submissionStatus, enrollment] = await Promise.all([
			getCommentCountsByResumeIds(resumeIds),
			getLatestEvaluationsByResumeIds(resumeIds),
			getSubmissionStatusByResumeIds(resumeIds),
			input.engLabsUserId ? getStudentEnrollmentInfo(input.engLabsUserId) : Promise.resolve(null),
		]);

		const resumesWithFeedback = resumes.map((resume) => {
			const commentCount = commentCounts.get(resume.id) ?? 0;
			const evaluationScore = latestScores.get(resume.id) ?? null;
			const isSubmitted = submissionStatus.get(resume.id) ?? false;
			return {
				...resume,
				feedback: {
					totalComments: commentCount,
					evaluationScore,
					isSubmitted,
				},
			};
		});

		const totalComments = resumesWithFeedback.reduce((sum, r) => sum + r.feedback.totalComments, 0);
		const scored = resumesWithFeedback.filter((r) => r.feedback.evaluationScore !== null);
		const averageScore =
			scored.length > 0 ? scored.reduce((sum, r) => sum + (r.feedback.evaluationScore ?? 0), 0) / scored.length : null;

		return {
			user: { id: userId },
			enrollment,
			resumes: resumesWithFeedback,
			stats: {
				totalResumes: resumes.length,
				withFeedback: resumesWithFeedback.filter((r) => r.feedback.totalComments > 0).length,
				totalComments,
				evaluationsReceived: scored.length,
				averageScore,
			},
		};
	});

// ─────────────────────────────────────────────────────────────────────────────
// Unified Section-Scoped Dashboard (Faculty & PO)
// ─────────────────────────────────────────────────────────────────────────────

export const sectionsDashboard = protectedProcedure
	.route({
		method: "GET",
		path: "/resumes/dashboard/sections",
		tags: ["Dashboard"],
		operationId: "getSectionsDashboard",
		summary: "Get section-scoped dashboard data",
		description:
			"Returns students, resumes, and metrics scoped to the given sections, grouped by package. Used by Faculty (assigned sections) and PO (all sections).",
	})
	.input(
		z.object({
			sectionIds: z.array(z.string()).describe("Organisation unit IDs from SSO JWT (fallback)"),
			tenantId: z.string().describe("Eng-labs tenant ID"),
			activeUnitId: z.string().optional().describe("Selected org unit ID for filtering students"),
			scope: z.enum(["faculty", "po"]).describe("Determines section scoping"),
		}),
	)
	.handler(async ({ context, input }) => {
		const { activeUnitId, scope } = input;

		// 1. Resolve the authenticated user in eng-labs + actual tenantId
		const engLabsUser = await getEngLabsUserByEmail(context.user.email);
		let tenantId = input.tenantId;
		if ((!tenantId || tenantId === "default") && engLabsUser?.tenantId) {
			tenantId = engLabsUser.tenantId;
		}

		// 2. Get placement packages for the filter UI
		let filterPackages: PlacementPackage[] = [];
		let resolvedOrganisationId: string | null = null;

		if (engLabsUser?.id) {
			if (scope === "faculty") {
				filterPackages = await getInstructorPackages(engLabsUser.id);
			}
		}
		// PO/admin always get all packages for the org; faculty fallback to all if no assigned packages
		if (filterPackages.length === 0 && tenantId && tenantId !== "default") {
			// Derive organisationId from the first available placement package or org unit
			const pool = await import("@/integrations/eng-labs/client").then((m) => m.getEngLabsPool());
			if (pool) {
				const { rows } = await pool.query<{ organisation_id: string }>(
					`SELECT organisation_id FROM placement_packages WHERE tenant_id = $1 LIMIT 1`,
					[tenantId],
				);
				if (rows[0]) {
					resolvedOrganisationId = rows[0].organisation_id;
					filterPackages = await getPlacementPackages(tenantId, resolvedOrganisationId);
				}
				// If no packages, try to get organisation_id from org units
				if (!resolvedOrganisationId) {
					const { rows: ouRows } = await pool.query<{ organisation_id: string }>(
						`SELECT organisation_id FROM organisation_units WHERE tenant_id = $1 LIMIT 1`,
						[tenantId],
					);
					if (ouRows[0]) resolvedOrganisationId = ouRows[0].organisation_id;
				}
			}
		} else if (filterPackages.length > 0) {
			resolvedOrganisationId = filterPackages[0].organisationId;
		}

		// 3. Get unit schema types + all org units for the filter UI
		const [unitTypes, allOrgUnits] = await Promise.all([
			resolvedOrganisationId && tenantId && tenantId !== "default"
				? getUnitSchemaTypes(tenantId, resolvedOrganisationId)
				: Promise.resolve([] as string[]),
			resolvedOrganisationId && tenantId && tenantId !== "default"
				? getAllOrgUnits(tenantId, resolvedOrganisationId)
				: Promise.resolve([] as OrgUnitRow[]),
		]);

		// 4. Resolve CLASS-level sections (leaf nodes with learners) for student queries
		let sections: Section[] = [];
		if (scope === "faculty" && engLabsUser?.id) {
			sections = await getInstructorSections(engLabsUser.id);
		}
		if (sections.length === 0 && input.sectionIds.length > 0) {
			sections = await getSectionsByIds(input.sectionIds);
		}
		if (sections.length === 0 && tenantId && tenantId !== "default") {
			sections = await getAllSections(tenantId);
		}

		// 4b. For faculty scope, restrict allOrgUnits to only units relevant to their assigned sections
		//     (the sections themselves + their ancestors up the tree)
		let scopedOrgUnits = allOrgUnits;
		if (scope === "faculty" && sections.length > 0) {
			const relevantIds = new Set(sections.map((s) => s.id));
			scopedOrgUnits = allOrgUnits.filter((u) => relevantIds.has(u.id));
		}

		// 4c. Derive unit types present in the scoped units (overrides full-org unitTypes for faculty)
		const scopedUnitTypes =
			scope === "faculty" && sections.length > 0 ? [...new Set(scopedOrgUnits.map((u) => u.type))].sort() : unitTypes;

		// 5. If a specific unit is selected in the filter, narrow sections to descendants of that unit
		let effectiveSectionIds = sections.map((s) => s.id);
		if (activeUnitId) {
			// Find all descendant CLASS-level section IDs of the selected unit using scoped units
			const selectedUnit = scopedOrgUnits.find((u) => u.id === activeUnitId);
			if (selectedUnit) {
				const childIds = new Set<string>();
				const queue = [activeUnitId];
				while (queue.length > 0) {
					const current = queue.shift()!;
					childIds.add(current);
					for (const u of scopedOrgUnits) {
						if (u.parentId === current) queue.push(u.id);
					}
				}
				effectiveSectionIds = effectiveSectionIds.filter((id) => childIds.has(id));
				if (effectiveSectionIds.length === 0 && childIds.has(activeUnitId)) {
					effectiveSectionIds = [activeUnitId];
				}
			}
		}

		// 6. Get students for the effective sections
		const engLabsStudents = await getStudentsBySections(effectiveSectionIds, tenantId);
		const studentEmails = engLabsStudents.map((s) => s.email);

		// 7. Match to local resume app users by email
		const localUsers = await getLocalUsersByEmails(studentEmails);
		const emailToLocalUser = new Map(localUsers.map((u) => [u.email, u]));
		const localUserIds = localUsers.map((u) => u.id);

		// 8. Get resumes for matched users
		const resumes = await getResumesForUsers(localUserIds);
		const resumeIds = resumes.map((r) => r.id);

		// 9. Get feedback data + submission status
		const [commentCounts, latestScores, submissionStatus] = await Promise.all([
			getCommentCountsByResumeIds(resumeIds),
			getLatestEvaluationsByResumeIds(resumeIds),
			getSubmissionStatusByResumeIds(resumeIds),
		]);

		// 10. Build per-user resume data
		const resumesByUserId = new Map<string, typeof resumes>();
		for (const r of resumes) {
			const existing = resumesByUserId.get(r.userId) ?? [];
			existing.push(r);
			resumesByUserId.set(r.userId, existing);
		}

		const students = engLabsStudents.map((student) => {
			const localUser = emailToLocalUser.get(student.email);
			const userResumes = localUser ? (resumesByUserId.get(localUser.id) ?? []) : [];

			return {
				engLabsId: student.id,
				name: student.name,
				email: student.email,
				rollNumber: student.rollNumber,
				sectionId: student.sectionId,
				sectionName: student.sectionName ?? null,
				resumeAppUserId: localUser?.id ?? null,
				resumes: userResumes.map((r) => {
					const score = latestScores.get(r.id) ?? null;
					const comments = commentCounts.get(r.id) ?? 0;
					const isSubmitted = submissionStatus.get(r.id) ?? false;

					let status: "not_reviewed" | "submitted" | "evaluated" | "has_comments" = "not_reviewed";
					if (score !== null) status = "evaluated";
					else if (isSubmitted) status = "submitted";
					else if (comments > 0) status = "has_comments";

					return {
						id: r.id,
						name: r.name,
						updatedAt: r.updatedAt,
						evaluationScore: score,
						commentCount: comments,
						isSubmitted,
						status,
						reviewStatus: (r as any).reviewStatus ?? "DRAFT",
						locked: (r as any).locked ?? false,
						unlockReason: (r as any).unlockReason ?? null,
					};
				}),
			};
		});

		// 11. Calculate stats for ALL org units (hierarchical aggregation)
		const unitStats = scopedOrgUnits.map((unit) => {
			// Find all descendant CLASS-level section IDs for this unit
			const descendantSectionIds = new Set<string>();
			const queue = [unit.id];
			const processed = new Set<string>();

			while (queue.length > 0) {
				const currentId = queue.shift()!;
				if (processed.has(currentId)) continue;
				processed.add(currentId);

				// If it's a leaf section, add it
				const isSection = sections.some((s) => s.id === currentId);
				if (isSection) descendantSectionIds.add(currentId);

				// Find children in allOrgUnits to continue recursion
				for (const u of allOrgUnits) {
					if (u.parentId === currentId) queue.push(u.id);
				}
			}

			const unitStudents = students.filter((s) => descendantSectionIds.has(s.sectionId));
			const unitResumes = unitStudents.flatMap((s) => s.resumes);

			// New logic:
			// 1. Verified = Any progress from Faculty or PO
			const verified = unitResumes.filter((r) =>
				[
					"FACULTY_VERIFIED",
					"FINALIZED_BY_FACULTY",
					"PO_REVISION_REQUESTED",
					"RESUBMITTED_TO_PO",
					"PO_VERIFIED",
					"APPROVED",
				].includes((r as any).reviewStatus ?? "DRAFT"),
			);

			// 2. FinalizedByFaculty = Waiting in PO Inbox
			const finalized = unitResumes.filter((r) =>
				["FINALIZED_BY_FACULTY", "RESUBMITTED_TO_PO", "APPROVED"].includes((r as any).reviewStatus ?? "DRAFT"),
			);

			// 3. PassedFaculty = Cleared faculty stage once (even if in PO revision)
			const clearedFaculty = unitResumes.filter((r) =>
				["FINALIZED_BY_FACULTY", "PO_REVISION_REQUESTED", "RESUBMITTED_TO_PO", "PO_VERIFIED", "APPROVED"].includes(
					(r as any).reviewStatus ?? "DRAFT",
				),
			);

			// 4. PO Verified = Verified by PO but not yet approved section-wide
			const poVerified = unitResumes.filter((r) => (r as any).reviewStatus === "PO_VERIFIED");

			// 5. ApprovedOnly = Final Status
			const approved = unitResumes.filter((r) => (r as any).reviewStatus === "APPROVED");

			const scores = unitResumes.filter((r) => r.evaluationScore !== null).map((r) => r.evaluationScore!);

			return {
				id: unit.id,
				name: unit.name,
				unitType: unit.type,
				stats: {
					totalStudents: unitStudents.length,
					totalResumes: unitResumes.length,
					evaluatedResumes: verified.length,
					submittedResumes: finalized.length,
					passedFaculty: clearedFaculty.length,
					poVerifiedResumes: poVerified.length,
					approvedResumes: approved.length,
					completionRate: unitResumes.length > 0 ? Math.round((verified.length / unitResumes.length) * 100) : 0,
					averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
				},
			};
		});

		// 12. Aggregate stats
		const allResumes = students.flatMap((s) => s.resumes);
		const allEvaluated = allResumes.filter((r) => r.evaluationScore !== null);
		const allScores = allEvaluated.map((r) => r.evaluationScore!);
		const totalComments = allResumes.reduce((sum, r) => sum + r.commentCount, 0);
		const allSubmitted = allResumes.filter((r) => r.isSubmitted);

		// 13. Recent activity
		const recentEvaluations = await db
			.select()
			.from(schema.resumeEvaluation)
			.where(resumeIds.length > 0 ? inArray(schema.resumeEvaluation.resumeId, resumeIds) : undefined)
			.orderBy(desc(schema.resumeEvaluation.createdAt))
			.limit(5);

		const recentComments = await db
			.select()
			.from(schema.resumeComment)
			.where(resumeIds.length > 0 ? inArray(schema.resumeComment.resumeId, resumeIds) : undefined)
			.orderBy(desc(schema.resumeComment.createdAt))
			.limit(5);

		const resumeIdToEmail = new Map<string, string>();
		for (const student of students) {
			for (const r of student.resumes) {
				resumeIdToEmail.set(r.id, student.email);
			}
		}

		const enrichedEvaluations = recentEvaluations.map((e) => {
			const email = resumeIdToEmail.get(e.resumeId);
			const student = email ? engLabsStudents.find((s) => s.email === email) : null;
			return {
				id: e.id,
				resumeId: e.resumeId,
				overallScore: e.overallScore,
				evaluatedAt: e.evaluatedAt,
				studentName: student?.name ?? null,
			};
		});

		const enrichedComments = recentComments.map((c) => {
			const email = resumeIdToEmail.get(c.resumeId);
			const student = email ? engLabsStudents.find((s) => s.email === email) : null;
			return {
				id: c.id,
				resumeId: c.resumeId,
				content: c.content,
				createdAt: c.createdAt,
				studentName: student?.name ?? null,
			};
		});

		return {
			// Filter UI data (scoped to instructor's sections for faculty role)
			packages: filterPackages,
			unitTypes: scopedUnitTypes,
			allOrgUnits: scopedOrgUnits,
			// Section-level stats (CLASS leaf nodes)
			sections: unitStats,
			students,
			aggregateStats: {
				totalStudents: students.length,
				totalResumes: allResumes.length,
				totalEvaluations: allEvaluated.length,
				totalSubmitted: allSubmitted.length,
				totalComments,
				completionRate: allResumes.length > 0 ? Math.round((allEvaluated.length / allResumes.length) * 100) : 0,
				averageScore: allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null,
			},
			recentActivity: {
				recentEvaluations: enrichedEvaluations,
				recentComments: enrichedComments,
			},
		};
	});

// ─────────────────────────────────────────────────────────────────────────────
// Student Detail (for faculty's detail panel)
// ─────────────────────────────────────────────────────────────────────────────

export const studentResumes = protectedProcedure
	.route({
		method: "GET",
		path: "/resumes/dashboard/student-resumes",
		tags: ["Dashboard"],
		operationId: "getStudentResumes",
		summary: "Get full resume detail for a student",
		description:
			"Returns all resumes for a student with comments, evaluations, and history. Used by faculty detail panel.",
	})
	.input(
		z.object({
			resumeAppUserId: z.string().describe("Local resume app user ID of the student"),
		}),
	)
	.handler(async ({ input }) => {
		const resumes = await db
			.select()
			.from(schema.resume)
			.where(and(eq(schema.resume.userId, input.resumeAppUserId), eq(schema.resume.isPrimary, true)))
			.orderBy(desc(schema.resume.updatedAt));

		const resumesWithDetail = await Promise.all(
			resumes.map(async (resume) => {
				const [comments, evaluations, history] = await Promise.all([
					db
						.select()
						.from(schema.resumeComment)
						.where(eq(schema.resumeComment.resumeId, resume.id))
						.orderBy(schema.resumeComment.createdAt),
					db
						.select({
							id: schema.resumeEvaluation.id,
							overallScore: schema.resumeEvaluation.overallScore,
							evaluatedAt: schema.resumeEvaluation.evaluatedAt,
						})
						.from(schema.resumeEvaluation)
						.where(eq(schema.resumeEvaluation.resumeId, resume.id))
						.orderBy(desc(schema.resumeEvaluation.evaluatedAt)),
					db
						.select({
							id: schema.resumeHistory.id,
							action: schema.resumeHistory.action,
							actorType: schema.resumeHistory.actorType,
							createdAt: schema.resumeHistory.createdAt,
							currentData: schema.resumeHistory.currentData,
						})
						.from(schema.resumeHistory)
						.where(eq(schema.resumeHistory.resumeId, resume.id))
						.orderBy(desc(schema.resumeHistory.createdAt))
						.limit(20),
				]);

				const latestScore = evaluations[0]?.overallScore ?? null;
				const isSubmitted = history[0]?.action === "SUBMITTED";

				return {
					id: resume.id,
					name: resume.name,
					updatedAt: resume.updatedAt,
					evaluationScore: latestScore,
					isSubmitted,
					comments: comments.map((c) => ({
						id: c.id,
						content: c.content,
						authorId: c.authorId,
						status: c.status,
						parentId: c.parentId,
						createdAt: c.createdAt,
					})),
					reviewStatus: (resume as any).reviewStatus,
					locked: (resume as any).locked ?? false,
					unlockReason: (resume as any).unlockReason ?? null,
					evaluations: evaluations.slice(0, 3),
					history,
				};
			}),
		);

		return { resumes: resumesWithDetail };
	});

// ─────────────────────────────────────────────────────────────────────────────
// Submit Resume for Review (Student action)
// ─────────────────────────────────────────────────────────────────────────────

export const submitResume = protectedProcedure
	.route({
		method: "POST",
		path: "/resumes/dashboard/submit",
		tags: ["Dashboard"],
		operationId: "submitResumeForReview",
		summary: "Submit a resume for faculty review",
		description: "Student marks a resume as submitted for review. Visible to faculty as a pending review item.",
	})
	.input(
		z.object({
			resumeId: z.string(),
			studentId: z.string().describe("eng-labs student ID").optional(),
			tenantId: z.string().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { updateResumeStatus } = await import("@/integrations/drizzle/services/resume-feedback.service");

		// Fetch current status to decide if it's an initial submission or a re-submission to PO
		const [currentResume] = await db.select().from(schema.resume).where(eq(schema.resume.id, input.resumeId)).limit(1);

		let nextStatus: any = "SUBMITTED_TO_FACULTY";
		if (currentResume?.reviewStatus === "PO_REVISION_REQUESTED") {
			nextStatus = "RESUBMITTED_TO_PO";
		}

		await updateResumeStatus({
			resumeId: input.resumeId,
			studentId: input.studentId ?? currentResume?.userId ?? "unknown",
			tenantId: input.tenantId ?? "default",
			status: nextStatus,
			changedBy: context.user.id,
			actorType: "LEARNER",
		});

		return { success: true };
	});

// ─────────────────────────────────────────────────────────────────────────────
// PO Individual Approval Action
// ─────────────────────────────────────────────────────────────────────────────

export const approveResume = protectedProcedure
	.route({
		method: "POST",
		path: "/resumes/dashboard/approve",
		tags: ["Dashboard"],
		summary: "Approve a resume (PO action)",
	})
	.input(
		z.object({
			resumeId: z.string(),
			studentId: z.string().optional(),
			tenantId: z.string().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { updateResumeStatus } = await import("@/integrations/drizzle/services/resume-feedback.service");

		await updateResumeStatus({
			resumeId: input.resumeId,
			studentId: input.studentId,
			tenantId: input.tenantId,
			status: "PO_VERIFIED",
			changedBy: context.user.id,
			actorType: "PLACEMENT_OFFICER",
		});

		return { success: true };
	});

// ─────────────────────────────────────────────────────────────────────────────
// Manual Lock/Unlock Toggle
// ─────────────────────────────────────────────────────────────────────────────

export const toggleResumeLock = protectedProcedure
	.route({
		method: "POST",
		path: "/resumes/dashboard/lock",
		tags: ["Dashboard"],
		summary: "Lock or unlock a resume manually",
	})
	.input(
		z.object({
			resumeId: z.string(),
			isLocked: z.boolean(),
			reason: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { toggleLock } = await import("@/integrations/drizzle/services/resume-feedback.service");

		await toggleLock({
			resumeId: input.resumeId,
			isLocked: input.isLocked,
			reason: input.reason,
		});

		return { success: true };
	});

// ─────────────────────────────────────────────────────────────────────────────
// Update Resume Status (Faculty/PO action)
// ─────────────────────────────────────────────────────────────────────────────

export const updateStatus = protectedProcedure
	.route({
		method: "POST",
		path: "/resumes/dashboard/status",
		tags: ["Dashboard"],
		operationId: "updateResumeStatus",
		summary: "Update resume review status",
	})
	.input(
		z.object({
			resumeId: z.string(),
			studentId: z.string(),
			tenantId: z.string(),
			status: z.enum([
				"FACULTY_REVISION_REQUESTED",
				"FACULTY_VERIFIED",
				"FINALIZED_BY_FACULTY",
				"PO_REVISION_REQUESTED",
				"PO_VERIFIED",
				"APPROVED",
			]),
		}),
	)
	.handler(async ({ context, input }) => {
		const { updateResumeStatus } = await import("@/integrations/drizzle/services/resume-feedback.service");

		const actorType =
			input.status.startsWith("PO_") || input.status === "APPROVED" ? "PLACEMENT_OFFICER" : "INSTRUCTOR";

		await updateResumeStatus({
			resumeId: input.resumeId,
			studentId: input.studentId,
			tenantId: input.tenantId,
			status: input.status as any,
			changedBy: context.user.id,
			actorType,
		});

		return { success: true };
	});

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Update Resumes (Faculty/PO action)
// ─────────────────────────────────────────────────────────────────────────────

export const bulkUpdateResumes = protectedProcedure
	.route({
		method: "POST",
		path: "/resumes/dashboard/bulk-status",
		tags: ["Dashboard"],
		operationId: "bulkUpdateResumes",
		summary: "Bulk update resume review statuses",
	})
	.input(
		z.object({
			resumes: z.array(z.object({ id: z.string(), studentId: z.string() })),
			tenantId: z.string(),
			status: z.enum(["FINALIZED_BY_FACULTY", "SUBMITTED_TO_PO", "PO_VERIFIED", "APPROVED"]),
		}),
	)
	.handler(async ({ context, input }) => {
		const { bulkUpdateSectionResumes } = await import("@/integrations/drizzle/services/resume-feedback.service");

		const actorType =
			input.status === "APPROVED" || input.status === "PO_VERIFIED" ? "PLACEMENT_OFFICER" : "INSTRUCTOR";

		await bulkUpdateSectionResumes({
			resumes: input.resumes,
			tenantId: input.tenantId,
			toStatus: input.status as any,
			changedBy: context.user.id,
			actorType,
		});

		return { success: true };
	});

// ─────────────────────────────────────────────────────────────────────────────
// Admin Metrics Dashboard
// ─────────────────────────────────────────────────────────────────────────────

export const adminDashboard = protectedProcedure
	.route({
		method: "GET",
		path: "/resumes/dashboard/admin",
		tags: ["Dashboard"],
		operationId: "getAdminDashboard",
		summary: "Get admin organization metrics",
		description:
			"Returns aggregated metrics across the organization, including faculty performance and section health.",
	})
	.input(
		z.object({
			tenantId: z.string().describe("Tenant ID to fetch metrics for"),
		}),
	)
	.handler(async ({ input }) => {
		const { tenantId } = input;

		const allResumes = await db.select().from(schema.resume);
		const allEvaluations = await db.select().from(schema.resumeEvaluation);
		const allComments = await db.select().from(schema.resumeComment);

		const resumesWithEvaluation = allResumes.filter((r) => allEvaluations.some((e) => e.resumeId === r.id)).length;

		const averageScore =
			allEvaluations.length > 0
				? allEvaluations.reduce((sum, e) => sum + (e.overallScore || 0), 0) / allEvaluations.length
				: null;

		const [sections, facultyList] = await Promise.all([getAllSections(tenantId), getFacultyList(tenantId)]);

		const facultyPerformance = facultyList.map((faculty) => {
			const evalCount = allEvaluations.filter((e) => e.evaluatedBy === faculty.id).length;
			const commentCount = allComments.filter((c) => c.authorId === faculty.id).length;
			return {
				id: faculty.id,
				name: faculty.name,
				email: faculty.email,
				evaluationsCompleted: evalCount,
				commentsMade: commentCount,
			};
		});

		const localUsers = await db.select().from(schema.user);
		const localEmails = localUsers.map((u) => u.email);
		const engLabsInfo = await enrichByEmails(localEmails);

		const sectionHealth = sections.map((section) => {
			const sectionEmails = new Set<string>();
			for (const [email, info] of engLabsInfo) {
				if (info.sectionId === section.id) sectionEmails.add(email);
			}
			const sectionLocalUserIds = localUsers.filter((u) => sectionEmails.has(u.email)).map((u) => u.id);
			const sectionResumes = allResumes.filter((r) => sectionLocalUserIds.includes(r.userId));
			const sectionEvaluated = sectionResumes.filter((r) => allEvaluations.some((e) => e.resumeId === r.id));

			return {
				id: section.id,
				name: section.name,
				code: section.code,
				packageId: section.packageId,
				packageName: section.packageName,
				totalStudents: sectionEmails.size,
				totalResumes: sectionResumes.length,
				evaluatedResumes: sectionEvaluated.length,
				completionRate:
					sectionResumes.length > 0 ? Math.round((sectionEvaluated.length / sectionResumes.length) * 100) : 0,
			};
		});

		const recentResumes = allResumes
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 5);
		const recentEvaluations = allEvaluations
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 5);
		const recentComments = allComments
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 5);

		const recentHistory = await db
			.select()
			.from(schema.resumeHistory)
			.orderBy(desc(schema.resumeHistory.createdAt))
			.limit(15);

		return {
			organization: { id: tenantId },
			stats: {
				totalResumes: allResumes.length,
				totalEvaluations: allEvaluations.length,
				resumesEvaluated: resumesWithEvaluation,
				completionRate: allResumes.length > 0 ? Math.round((resumesWithEvaluation / allResumes.length) * 100) : 0,
				totalComments: allComments.length,
				averageScore,
			},
			facultyPerformance,
			sectionHealth,
			recentActivity: {
				recentResumes,
				recentEvaluations,
				recentComments,
			},
			recentHistory,
		};
	});

// ─────────────────────────────────────────────────────────────────────────────
// Forward Resume to PO
// ─────────────────────────────────────────────────────────────────────────────

export const forwardResume = protectedProcedure
	.route({
		method: "POST",
		path: "/resumes/{resumeId}/forward",
		tags: ["Dashboard"],
		operationId: "forwardResumeToPO",
		summary: "Forward a resume to Placement Officer",
	})
	.input(
		z.object({
			resumeId: z.string(),
			studentId: z.string(),
			tenantId: z.string(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { addToHistory } = await import("@/integrations/drizzle/services/resume-feedback.service");

		await addToHistory({
			resumeId: input.resumeId,
			studentId: input.studentId,
			tenantId: input.tenantId,
			action: "FORWARDED",
			changedBy: context.user.id,
			actorType: "INSTRUCTOR",
		});

		return { success: true };
	});

// ─────────────────────────────────────────────────────────────────────────────
// Sections List (for org unit switcher)
// ─────────────────────────────────────────────────────────────────────────────

export const sectionsList = protectedProcedure
	.route({
		method: "GET",
		path: "/resumes/dashboard/sections-list",
		tags: ["Dashboard"],
		operationId: "listSections",
		summary: "List organisation unit sections",
	})
	.input(
		z.object({
			sectionIds: z.array(z.string()).optional(),
			tenantId: z.string(),
		}),
	)
	.handler(async ({ context, input }) => {
		let sections: Section[] = [];

		// Try to resolve from DB first (for Faculty)
		const engLabsUser = await getEngLabsUserByEmail(context.user.email);

		// Auto-resolve tenantId if client sent placeholder "default"
		let tenantId = input.tenantId;
		if ((!tenantId || tenantId === "default") && engLabsUser?.tenantId) {
			tenantId = engLabsUser.tenantId;
		}

		if (engLabsUser?.id) {
			sections = await getInstructorSections(engLabsUser.id);
		}

		// Fallback to inputs
		if (sections.length === 0) {
			sections = input.sectionIds?.length ? await getSectionsByIds(input.sectionIds) : await getAllSections(tenantId);
		}

		return { sections };
	});

// ─────────────────────────────────────────────────────────────────────────────
// Review Resume (Faculty — fetch resume + full feedback for review page)
// ─────────────────────────────────────────────────────────────────────────────

export const reviewResume = protectedProcedure
	.route({
		method: "GET",
		path: "/resumes/dashboard/review",
		tags: ["Dashboard"],
		operationId: "reviewResume",
		summary: "Get full resume detail for faculty review",
		description: "Returns resume metadata, comments, evaluations, and history for faculty review page.",
	})
	.input(z.object({ resumeId: z.string() }))
	.handler(async ({ input }) => {
		const { getEvaluationsByResumeId } = await import("@/integrations/drizzle/services/resume-feedback.service");

		const [resume, comments, evaluations, history] = await Promise.all([
			db.select().from(schema.resume).where(eq(schema.resume.id, input.resumeId)).limit(1),
			db
				.select()
				.from(schema.resumeComment)
				.where(eq(schema.resumeComment.resumeId, input.resumeId))
				.orderBy(schema.resumeComment.createdAt),
			getEvaluationsByResumeId(input.resumeId),
			db
				.select()
				.from(schema.resumeHistory)
				.where(eq(schema.resumeHistory.resumeId, input.resumeId))
				.orderBy(desc(schema.resumeHistory.createdAt))
				.limit(30),
		]);

		if (resume.length === 0) throw new Error("Resume not found");

		const r = resume[0];
		const isSubmitted = history[0]?.action === "SUBMITTED";
		const latestScore = evaluations[0]?.overallScore ?? null;

		return {
			resume: {
				id: r.id,
				name: r.name,
				slug: r.slug,
				tags: r.tags,
				isLocked: r.isLocked,
				userId: r.userId,
				data: r.data,
				updatedAt: r.updatedAt,
				createdAt: r.createdAt,
				reviewStatus: (r as any).reviewStatus,
				isSubmitted,
				latestScore,
			},
			comments: comments.map((c) => ({
				id: c.id,
				content: c.content,
				authorId: c.authorId,
				status: c.status,
				parentId: c.parentId,
				createdAt: c.createdAt,
			})),
			evaluations: evaluations.slice(0, 5),
			history,
		};
	});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Router
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PO Section Review — send section back to faculty with notes + optional voice note
// ─────────────────────────────────────────────────────────────────────────────

export const poReviewSection = protectedProcedure
	.route({
		method: "POST",
		path: "/resumes/dashboard/po-review-section",
		tags: ["Dashboard"],
		operationId: "poReviewSection",
		summary: "PO sends section back to faculty with review notes",
		description:
			"Saves PO review notes and an optional voice note URL, then bulk-resets all submitted resumes in the section back to FINALIZED_BY_FACULTY so the faculty can address the feedback and resubmit.",
	})
	.input(
		z.object({
			sectionId: z.string().describe("eng-labs section / org-unit ID"),
			tenantId: z.string(),
			facultyId: z.string().optional().describe("eng-labs ID of the faculty who submitted this section"),
			reviewNotes: z.string().min(1, "Review notes are required"),
			voiceNoteUrl: z.string().optional().describe("Storage URL of the recorded voice note"),
			resumes: z.array(z.object({ id: z.string(), studentId: z.string() })),
		}),
	)
	.handler(async ({ context, input }) => {
		const { createPoSectionReview, bulkUpdateSectionResumes } = await import(
			"@/integrations/drizzle/services/resume-feedback.service"
		);

		// 1. Persist the review record
		await createPoSectionReview({
			sectionId: input.sectionId,
			tenantId: input.tenantId,
			facultyId: input.facultyId,
			poId: context.user.id,
			reviewNotes: input.reviewNotes,
			voiceNoteUrl: input.voiceNoteUrl,
			resumeIds: input.resumes.map((r) => r.id),
		});

		// 2. Bulk-reset all resumes back to FINALIZED_BY_FACULTY so faculty can address and resubmit
		await bulkUpdateSectionResumes({
			resumes: input.resumes,
			tenantId: input.tenantId,
			toStatus: "FINALIZED_BY_FACULTY",
			changedBy: context.user.id,
			actorType: "PLACEMENT_OFFICER",
		});

		return { success: true };
	});

// ─────────────────────────────────────────────────────────────────────────────
// Get PO Section Reviews (faculty reads feedback)
// ─────────────────────────────────────────────────────────────────────────────

export const updatePoSectionReview = protectedProcedure
	.route({
		method: "PATCH",
		path: "/resumes/dashboard/po-section-reviews/{id}",
		tags: ["Dashboard"],
		operationId: "updatePoSectionReview",
		summary: "Edit an existing PO section review",
	})
	.input(
		z.object({
			id: z.string(),
			reviewNotes: z.string().min(1, "Review notes are required"),
			voiceNoteUrl: z.string().optional().nullable(),
		}),
	)
	.handler(async ({ input }) => {
		const { updatePoSectionReview: updateReview } = await import(
			"@/integrations/drizzle/services/resume-feedback.service"
		);
		return updateReview(input.id, {
			reviewNotes: input.reviewNotes,
			voiceNoteUrl: input.voiceNoteUrl,
		});
	});

export const getPoSectionReviews = protectedProcedure
	.route({
		method: "GET",
		path: "/resumes/dashboard/po-section-reviews",
		tags: ["Dashboard"],
		operationId: "getPoSectionReviews",
		summary: "Get PO section review history for a section",
	})
	.input(
		z.object({
			sectionId: z.string(),
			tenantId: z.string(),
		}),
	)
	.output(
		z.array(
			z.object({
				id: z.string(),
				sectionId: z.string(),
				tenantId: z.string(),
				facultyId: z.string().nullable(),
				poId: z.string(),
				reviewNotes: z.string(),
				voiceNoteUrl: z.string().nullable(),
				resumeIds: z.array(z.string()),
				createdAt: z.date(),
			}),
		),
	)
	.handler(async ({ input }) => {
		const { getPoSectionReviews: getSectionReviews } = await import(
			"@/integrations/drizzle/services/resume-feedback.service"
		);
		return getSectionReviews(input.sectionId, input.tenantId);
	});

export const dashboardRouter = {
	student: studentDashboard,
	sections: sectionsDashboard,
	studentResumes,
	submitResume,
	reviewResume,
	admin: adminDashboard,
	forward: forwardResume,
	sectionsList,
	updateStatus,
	bulkUpdateResumes,
	approveResume,
	toggleResumeLock,
	poReviewSection,
	updatePoSectionReview,
	getPoSectionReviews,
};
