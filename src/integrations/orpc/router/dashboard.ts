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

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";
import {
	enrichByEmails,
	filterEmailsWithResumeBuilderAccess,
	getAllOrgUnits,
	getDescendantOrgUnitIds,
	getEngLabsLearnerProfilesByEmails,
	getEngLabsUserByEmail,
	getFacultyList,
	getInstructorPackages,
	getInstructorSections,
	getPlacementPackages,
	getPlacementScopedSections,
	getPlacementSubtreeOrgUnitIds,
	getSectionsByIds,
	getStudentEnrollmentInfo,
	getStudentsBySections,
	getTenantIdForOrgUnits,
	getUnitSchemaTypes,
} from "@/integrations/eng-labs";
import type { EngLabsLearnerProfile, OrgUnitRow, PlacementPackage, Section } from "@/integrations/eng-labs/types";
import { protectedProcedure } from "../context";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

type SectionsDashboardStudent = {
	sectionId: string;
	/** Every eng-labs org unit this learner is tied to (enrollment + mappings). */
	engLabsUnitIds: string[];
	resumes: Array<{ evaluationScore: number | null; reviewStatus?: string }>;
};

/** Placement package for a dashboard row — from instructor assignment or org parent. */
function resolveSectionPackageMeta(
	unitId: string,
	descendantSectionIds: Set<string>,
	sectionRows: Section[],
): { packageId: string | null; packageName: string | null } {
	const direct = sectionRows.find((s) => s.id === unitId);
	if (direct?.packageId) {
		return { packageId: direct.packageId, packageName: direct.packageName };
	}
	for (const s of sectionRows) {
		if (descendantSectionIds.has(s.id) && s.packageId) {
			return { packageId: s.packageId, packageName: s.packageName };
		}
	}
	return { packageId: null, packageName: null };
}

function computeUnitStatsRow(
	unit: { id: string; name: string; type: string },
	descendantSectionIds: Set<string>,
	students: SectionsDashboardStudent[],
	packageMeta: { packageId: string | null; packageName: string | null },
) {
	const unitStudents = students.filter((s) => {
		const ids = s.engLabsUnitIds.length > 0 ? s.engLabsUnitIds : [s.sectionId];
		return ids.some((id) => descendantSectionIds.has(id));
	});
	const unitResumes = unitStudents.flatMap((s) => s.resumes);

	const verified = unitResumes.filter((r) =>
		[
			"FACULTY_VERIFIED",
			"FINALIZED_BY_FACULTY",
			"PO_REVISION_REQUESTED",
			"RESUBMITTED_TO_PO",
			"PO_VERIFIED",
			"APPROVED",
		].includes((r as { reviewStatus?: string }).reviewStatus ?? "DRAFT"),
	);

	const finalized = unitResumes.filter((r) =>
		["FINALIZED_BY_FACULTY", "RESUBMITTED_TO_PO", "APPROVED"].includes(
			(r as { reviewStatus?: string }).reviewStatus ?? "DRAFT",
		),
	);

	const clearedFaculty = unitResumes.filter((r) =>
		["FINALIZED_BY_FACULTY", "PO_REVISION_REQUESTED", "RESUBMITTED_TO_PO", "PO_VERIFIED", "APPROVED"].includes(
			(r as { reviewStatus?: string }).reviewStatus ?? "DRAFT",
		),
	);

	const poVerified = unitResumes.filter((r) => (r as { reviewStatus?: string }).reviewStatus === "PO_VERIFIED");

	const approved = unitResumes.filter((r) => (r as { reviewStatus?: string }).reviewStatus === "APPROVED");

	const scores = unitResumes.filter((r) => r.evaluationScore !== null).map((r) => r.evaluationScore!);

	return {
		id: unit.id,
		name: unit.name,
		unitType: unit.type,
		packageId: packageMeta.packageId,
		packageName: packageMeta.packageName,
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
}

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

		// 1. Resolve the authenticated user in eng-labs + actual tenantId.
		// The eng-labs user's tenantId is authoritative — client-supplied input.tenantId can drift
		// (e.g., stale SSO localStorage, cross-tenant testing) and would mis-scope every query below.
		const engLabsUser = await getEngLabsUserByEmail(context.user.email);
		let tenantId = engLabsUser?.tenantId ?? input.tenantId;

		// 2. Resolve assigned sections BEFORE packages/org tree — faculty SSO often has tenantId "default"
		//    and no org resolution until we know real tenant from organisation_units.
		let sections: Section[] = [];
		if (scope === "faculty" && engLabsUser?.id) {
			sections = await getInstructorSections(engLabsUser.id);
		}
		if (sections.length === 0 && input.sectionIds.length > 0) {
			sections = await getSectionsByIds(input.sectionIds);
		}
		if (sections.length > 0) {
			const ouTenant = await getTenantIdForOrgUnits(sections.map((s) => s.id));
			if (ouTenant && (!tenantId || tenantId === "default")) {
				tenantId = ouTenant;
			}
		}

		// 3. Get placement packages for the filter UI
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

		// 4. Get unit schema types + all org units for the filter UI
		const [unitTypes, allOrgUnits] = await Promise.all([
			resolvedOrganisationId && tenantId && tenantId !== "default"
				? getUnitSchemaTypes(tenantId, resolvedOrganisationId)
				: Promise.resolve([] as string[]),
			resolvedOrganisationId && tenantId && tenantId !== "default"
				? getAllOrgUnits(tenantId, resolvedOrganisationId)
				: Promise.resolve([] as OrgUnitRow[]),
		]);

		// 5. PO/admin: sections with learners under orgs that have placement packages (not whole tenant)
		if (sections.length === 0 && scope === "po" && tenantId && tenantId !== "default") {
			sections = await getPlacementScopedSections(tenantId);
		}

		// 6. For faculty scope, restrict allOrgUnits to only units relevant to their assigned sections
		let scopedOrgUnits = allOrgUnits;
		if (scope === "faculty" && sections.length > 0) {
			const relevantIds = new Set(sections.map((s) => s.id));
			scopedOrgUnits = allOrgUnits.filter((u) => relevantIds.has(u.id));
		}

		// 7. Derive unit types present in the scoped units (overrides full-org unitTypes for faculty).
		//     When allOrgUnits failed to load, scopedOrgUnits is empty — fall back to instructor sections' types
		//     so the Sections tab filter matches real rows.
		const scopedUnitTypes =
			scope === "faculty" && sections.length > 0
				? scopedOrgUnits.length > 0
					? [...new Set(scopedOrgUnits.map((u) => u.type))].sort()
					: [...new Set(sections.map((s) => s.type))].sort()
				: unitTypes;

		const normEmail = (e: string) => e.trim().toLowerCase();

		// 8–9. Cohort (resume DB first): all `user` rows for this tenant → eng-labs LEARNER profiles with
		//     every org link (enrollment + user_mappings). Filters:
		//     • PO: optional placement subtree (skip if none configured).
		//     • Faculty: instructor-assigned org units + all descendants in tenant.
		//     • activeUnitId: subtree of selected department/stream/class.
		//     This matches department-only and class-only enrollments for default overview and filters.
		let activeDescendantSet: Set<string> | null = null;
		if (activeUnitId) {
			if (tenantId && tenantId !== "default") {
				activeDescendantSet = new Set(await getDescendantOrgUnitIds([activeUnitId], tenantId));
			} else {
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
					activeDescendantSet = childIds;
				}
			}
		}

		let placementBoundarySet: Set<string> | null = null;
		if (scope === "po" && tenantId && tenantId !== "default") {
			const pIds = await getPlacementSubtreeOrgUnitIds(tenantId);
			placementBoundarySet = pIds.length > 0 ? new Set(pIds) : null;
		}

		let instructorSubtreeSet: Set<string> | null = null;
		if (scope === "faculty") {
			if (sections.length === 0) {
				instructorSubtreeSet = new Set();
			} else if (tenantId && tenantId !== "default") {
				instructorSubtreeSet = new Set(
					await getDescendantOrgUnitIds(
						sections.map((s) => s.id),
						tenantId,
					),
				);
			} else {
				instructorSubtreeSet = new Set(sections.map((s) => s.id));
			}
		}

		function profilePassesFilters(p: EngLabsLearnerProfile): boolean {
			if (placementBoundarySet && !p.unitIds.some((id) => placementBoundarySet.has(id))) return false;
			if (instructorSubtreeSet !== null && !p.unitIds.some((id) => instructorSubtreeSet.has(id))) return false;
			if (activeDescendantSet && !p.unitIds.some((id) => activeDescendantSet.has(id))) return false;
			return true;
		}

		// Cohort: source of truth is eng-labs. "Total Students" is the deduplicated set of learners
		// in scope who have **active resume-builder access** (a non-expired `user_quota_grants` row
		// for `RESUME_CREATE`). Better Auth `user` rows enrich each learner with resume data when
		// the learner has signed up; learners without a Better Auth row appear with empty resumes.
		//   • Faculty scope = learners in the faculty's assigned sections.
		//   • Admin / PO scope = learners across the tenant's placement-scoped packages, deduped.
		// See CLAUDE.md "Dashboard scoping rules" for the canonical product spec.
		const cohortEmailSet = new Set<string>();
		if (sections.length > 0 && tenantId && tenantId !== "default") {
			const inSections = await getStudentsBySections(
				sections.map((s) => s.id),
				tenantId,
			);
			for (const s of inSections) {
				const e = normEmail(s.email);
				if (e) cohortEmailSet.add(e);
			}
		}

		// Admin/PO also seed cohort from Better Auth tenant users (signed-up learners not yet linked
		// to a placement section). Faculty stays strictly within their assigned sections.
		let resumeUsers: (typeof schema.user.$inferSelect)[] = [];
		if (tenantId && tenantId !== "default") {
			if (scope === "faculty") {
				resumeUsers =
					cohortEmailSet.size > 0
						? await db
								.select()
								.from(schema.user)
								.where(inArray(sql<string>`lower(trim(${schema.user.email}))`, [...cohortEmailSet]))
						: [];
			} else {
				const resumeUsersByTenant = await db.select().from(schema.user).where(eq(schema.user.tenantId, tenantId));
				for (const u of resumeUsersByTenant) cohortEmailSet.add(normEmail(u.email));

				const allEmails = [...cohortEmailSet];
				resumeUsers =
					allEmails.length > 0
						? await db
								.select()
								.from(schema.user)
								.where(inArray(sql<string>`lower(trim(${schema.user.email}))`, allEmails))
						: [];
			}
		}

		// Restrict the cohort to learners with active resume-builder access. Returns null when
		// eng-labs isn't configured — in that case we leave the cohort untouched (no filter).
		const cohortBeforeAccess = cohortEmailSet.size;
		const accessEmails = await filterEmailsWithResumeBuilderAccess([...cohortEmailSet]);
		if (accessEmails !== null) {
			for (const email of [...cohortEmailSet]) {
				if (!accessEmails.has(email)) cohortEmailSet.delete(email);
			}
		}

		const profiles = await getEngLabsLearnerProfilesByEmails([...cohortEmailSet], tenantId);
		const profileByEmail = new Map<string, EngLabsLearnerProfile>(profiles.map((p) => [normEmail(p.email), p]));
		const localUserByEmail = new Map(resumeUsers.map((u) => [normEmail(u.email), u]));

		const emailToLocalUser = new Map<string, (typeof resumeUsers)[number]>();
		const engLabsStudents: import("@/integrations/eng-labs/types").StudentInfo[] = [];

		// TEMP-DIAGNOSTIC: trace cohort funnel for the dashboard. Remove once verified.
		console.log("[dashboard.sections] funnel", {
			scope,
			tenantId,
			engLabsUserId: engLabsUser?.id ?? null,
			sectionsResolved: sections.length,
			sectionIdsSample: sections.slice(0, 5).map((s) => s.id),
			cohortBeforeAccess,
			accessEmailsCount: accessEmails === null ? "no-filter" : accessEmails.size,
			cohortAfterAccess: cohortEmailSet.size,
			profilesCount: profiles.length,
			instructorSubtreeSetSize: instructorSubtreeSet?.size ?? null,
			profilesUnitIdsSample: profiles.slice(0, 3).map((p) => ({ email: p.email, unitIds: p.unitIds })),
		});

		for (const p of profiles) {
			if (!profilePassesFilters(p)) continue;
			const email = normEmail(p.email);
			const localUser = localUserByEmail.get(email);
			if (localUser) emailToLocalUser.set(email, localUser);
			const primarySection = p.enrollmentUnitId ?? p.unitIds[0] ?? "";
			engLabsStudents.push({
				id: p.id,
				name: p.name,
				email: p.email,
				rollNumber: p.rollNumber,
				sectionId: primarySection,
			});
		}

		const localUserIds = engLabsStudents.flatMap((s) => {
			const u = emailToLocalUser.get(normEmail(s.email));
			return u ? [u.id] : [];
		});

		// 10. Get resumes for matched users
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
			const localUser = emailToLocalUser.get(normEmail(student.email));
			const p = profileByEmail.get(normEmail(student.email));
			const userResumes = localUser ? (resumesByUserId.get(localUser.id) ?? []) : [];
			const engLabsUnitIds = p?.unitIds?.length ? p.unitIds : student.sectionId ? [student.sectionId] : [];

			return {
				engLabsId: student.id,
				name: student.name,
				email: student.email,
				rollNumber: student.rollNumber,
				sectionId: student.sectionId,
				sectionName: student.sectionName ?? null,
				engLabsUnitIds,
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
		let unitStats = scopedOrgUnits.map((unit) => {
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

			return computeUnitStatsRow(
				{ id: unit.id, name: unit.name, type: unit.type },
				descendantSectionIds,
				students,
				resolveSectionPackageMeta(unit.id, descendantSectionIds, sections),
			);
		});

		// Faculty: when org-unit tree never loaded (or IDs don't intersect), scopedOrgUnits is empty but
		// getInstructorSections still returned rows — build one card per assigned section so the UI isn't blank.
		if (unitStats.length === 0 && scope === "faculty" && sections.length > 0) {
			unitStats = sections.map((sec) =>
				computeUnitStatsRow({ id: sec.id, name: sec.name, type: sec.type }, new Set([sec.id]), students, {
					packageId: sec.packageId,
					packageName: sec.packageName,
				}),
			);
		}

		// 12. Aggregate stats. Cohort is now eng-labs-driven (every assigned learner counts in
		// totalStudents), so `enrolledInResumeBuilder` is specifically those who have a Better Auth
		// `user` row (resumeAppUserId set after the join above).
		const allResumes = students.flatMap((s) => s.resumes);
		const allEvaluated = allResumes.filter((r) => r.evaluationScore !== null);
		const allScores = allEvaluated.map((r) => r.evaluationScore!);
		const totalComments = allResumes.reduce((sum, r) => sum + r.commentCount, 0);
		const allSubmitted = allResumes.filter((r) => r.isSubmitted);
		const enrolledInResumeBuilder = students.filter((s) => s.resumeAppUserId !== null).length;
		const withPrimaryResume = students.filter((s) => s.resumes.length > 0).length;

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
				/** Learners in scope who have a Polymath `user` row (eng-labs ∩ resume DB). Same as totalStudents. */
				enrolledInResumeBuilder,
				/** How many of those have at least one primary resume document (`resume.is_primary`). */
				withPrimaryResume,
				/** % of resume-builder enrollees with a primary resume. */
				primaryResumeRate:
					enrolledInResumeBuilder > 0 ? Math.round((withPrimaryResume / enrolledInResumeBuilder) * 1000) / 10 : 0,
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

		const [sections, facultyList] = await Promise.all([getPlacementScopedSections(tenantId), getFacultyList(tenantId)]);

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

		const engLabsUser = await getEngLabsUserByEmail(context.user.email);

		let tenantId = input.tenantId;
		if ((!tenantId || tenantId === "default") && engLabsUser?.tenantId) {
			tenantId = engLabsUser.tenantId;
		}

		if (engLabsUser?.id) {
			sections = await getInstructorSections(engLabsUser.id);
		}
		if (sections.length === 0 && input.sectionIds?.length) {
			sections = await getSectionsByIds(input.sectionIds);
		}
		if (sections.length > 0) {
			const ouTenant = await getTenantIdForOrgUnits(sections.map((s) => s.id));
			if (ouTenant && (!tenantId || tenantId === "default")) {
				tenantId = ouTenant;
			}
		}

		if (sections.length === 0 && tenantId && tenantId !== "default") {
			sections = engLabsUser?.id ? [] : await getPlacementScopedSections(tenantId);
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
