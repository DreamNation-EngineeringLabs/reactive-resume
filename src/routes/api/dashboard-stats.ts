/**
 * REST endpoint for the main Polymath app to fetch resume-specific dashboard stats.
 *
 * Authenticated via the shared INTERNAL_API_SECRET header.
 *
 * GET /api/dashboard-stats?tenantId=...&scope=po&sectionIds=id1,id2&activeUnitId=...&email=...
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";
import {
	getAllOrgUnits,
	getAllSections,
	getEngLabsUserByEmail,
	getInstructorPackages,
	getInstructorSections,
	getPlacementPackages,
	getSectionsByIds,
	getStudentsBySections,
	getUnitSchemaTypes,
} from "@/integrations/eng-labs";
import { env } from "@/utils/env";

// ── Helper functions (same as dashboard.ts oRPC procedure) ──

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
		if (!latest.has(e.resumeId)) latest.set(e.resumeId, e.overallScore);
	}
	return latest;
}

async function getSubmissionStatusByResumeIds(resumeIds: string[]) {
	if (resumeIds.length === 0) return new Map<string, boolean>();
	const history = await db
		.select({ resumeId: schema.resumeHistory.resumeId, action: schema.resumeHistory.action })
		.from(schema.resumeHistory)
		.where(inArray(schema.resumeHistory.resumeId, resumeIds))
		.orderBy(desc(schema.resumeHistory.createdAt));
	const statusMap = new Map<string, boolean>();
	for (const h of history) {
		if (!statusMap.has(h.resumeId)) statusMap.set(h.resumeId, h.action === "SUBMITTED");
	}
	return statusMap;
}

// ── Main handler ──

async function handler({ request }: { request: Request }) {
	// Auth: require internal API secret
	const secret = request.headers.get("x-internal-secret");
	if (!env.INTERNAL_API_SECRET || secret !== env.INTERNAL_API_SECRET) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const tenantId = url.searchParams.get("tenantId");
	const scope = url.searchParams.get("scope") || "po";
	const sectionIdsParam = url.searchParams.get("sectionIds") || "";
	const activeUnitId = url.searchParams.get("activeUnitId") || undefined;
	const email = url.searchParams.get("email") || undefined;

	if (!tenantId) {
		return Response.json({ error: "tenantId is required" }, { status: 400 });
	}

	try {
		const sectionIds = sectionIdsParam ? sectionIdsParam.split(",").filter(Boolean) : [];
		const engLabsUser = email ? await getEngLabsUserByEmail(email) : null;

		// 1. Resolve packages + organisation
		let filterPackages: any[] = [];
		let resolvedOrganisationId: string | null = null;

		if (scope === "faculty" && engLabsUser?.id) {
			filterPackages = await getInstructorPackages(engLabsUser.id);
		}
		if (filterPackages.length === 0 && tenantId !== "default") {
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

		// 2. Org units + unit types
		const [unitTypes, allOrgUnits] = await Promise.all([
			resolvedOrganisationId && tenantId !== "default"
				? getUnitSchemaTypes(tenantId, resolvedOrganisationId)
				: Promise.resolve([]),
			resolvedOrganisationId && tenantId !== "default"
				? getAllOrgUnits(tenantId, resolvedOrganisationId)
				: Promise.resolve([]),
		]);

		// 3. Resolve sections
		let sections: any[] = [];
		if (scope === "faculty" && engLabsUser?.id) {
			sections = await getInstructorSections(engLabsUser.id);
		}
		if (sections.length === 0 && sectionIds.length > 0) {
			sections = await getSectionsByIds(sectionIds);
		}
		if (sections.length === 0 && tenantId !== "default") {
			sections = await getAllSections(tenantId);
		}

		// Scope for faculty
		let scopedOrgUnits = allOrgUnits;
		if (scope === "faculty" && sections.length > 0) {
			const relevantIds = new Set(sections.map((s: any) => s.id));
			scopedOrgUnits = allOrgUnits.filter((u: any) => relevantIds.has(u.id));
		}

		// 4. Filter by activeUnitId
		let effectiveSectionIds = sections.map((s: any) => s.id);
		if (activeUnitId) {
			const childIds = new Set<string>();
			const queue = [activeUnitId];
			while (queue.length > 0) {
				const current = queue.shift()!;
				childIds.add(current);
				for (const u of scopedOrgUnits as any[]) {
					if (u.parentId === current) queue.push(u.id);
				}
			}
			effectiveSectionIds = effectiveSectionIds.filter((id: string) => childIds.has(id));
			if (effectiveSectionIds.length === 0 && childIds.has(activeUnitId)) {
				effectiveSectionIds = [activeUnitId];
			}
		}

		// 5. Get students → match to resume app users → get resumes
		const engLabsStudents = await getStudentsBySections(effectiveSectionIds, tenantId);
		const studentEmails = engLabsStudents.map((s) => s.email);
		const localUsers = await getLocalUsersByEmails(studentEmails);
		const emailToLocalUser = new Map(localUsers.map((u) => [u.email, u]));
		const localUserIds = localUsers.map((u) => u.id);

		const resumes = await getResumesForUsers(localUserIds);
		const resumeIds = resumes.map((r) => r.id);

		// 6. Get resume feedback data
		const [commentCounts, latestScores, submissionStatus] = await Promise.all([
			getCommentCountsByResumeIds(resumeIds),
			getLatestEvaluationsByResumeIds(resumeIds),
			getSubmissionStatusByResumeIds(resumeIds),
		]);

		// 7. Build per-student resume data
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
					let status: string = "not_reviewed";
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
					};
				}),
			};
		});

		// 8. Section-level stats with resume status breakdown
		const sectionStats = scopedOrgUnits.map((unit: any) => {
			const descendantSectionIds = new Set<string>();
			const queue = [unit.id];
			const processed = new Set<string>();
			while (queue.length > 0) {
				const currentId = queue.shift()!;
				if (processed.has(currentId)) continue;
				processed.add(currentId);
				if (sections.some((s: any) => s.id === currentId)) descendantSectionIds.add(currentId);
				for (const u of allOrgUnits as any[]) {
					if (u.parentId === currentId) queue.push(u.id);
				}
			}
			const unitStudents = students.filter((s) => descendantSectionIds.has(s.sectionId));
			const unitResumes = unitStudents.flatMap((s) => s.resumes);

			const byStatus = (statuses: string[]) => unitResumes.filter((r) => statuses.includes(r.reviewStatus)).length;
			const scores = unitResumes.filter((r) => r.evaluationScore !== null).map((r) => r.evaluationScore!);

			return {
				id: unit.id,
				name: unit.name,
				unitType: unit.type,
				stats: {
					totalStudents: unitStudents.length,
					totalResumes: unitResumes.length,
					evaluatedResumes: byStatus(["FACULTY_VERIFIED", "FINALIZED_BY_FACULTY", "PO_REVISION_REQUESTED", "RESUBMITTED_TO_PO", "PO_VERIFIED", "APPROVED"]),
					submittedResumes: byStatus(["FINALIZED_BY_FACULTY", "RESUBMITTED_TO_PO", "APPROVED"]),
					passedFaculty: byStatus(["FINALIZED_BY_FACULTY", "PO_REVISION_REQUESTED", "RESUBMITTED_TO_PO", "PO_VERIFIED", "APPROVED"]),
					poVerifiedResumes: byStatus(["PO_VERIFIED"]),
					approvedResumes: byStatus(["APPROVED"]),
					completionRate: unitResumes.length > 0 ? Math.round((byStatus(["FACULTY_VERIFIED", "FINALIZED_BY_FACULTY", "PO_REVISION_REQUESTED", "RESUBMITTED_TO_PO", "PO_VERIFIED", "APPROVED"]) / unitResumes.length) * 100) : 0,
					averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
				},
			};
		});

		// 9. Aggregate stats
		const allResumes = students.flatMap((s) => s.resumes);
		const allEvaluated = allResumes.filter((r) => r.evaluationScore !== null);
		const allScores = allEvaluated.map((r) => r.evaluationScore!);
		const totalComments = allResumes.reduce((sum, r) => sum + r.commentCount, 0);

		// 10. Recent activity
		const recentEvaluations = resumeIds.length > 0
			? await db
					.select()
					.from(schema.resumeEvaluation)
					.where(inArray(schema.resumeEvaluation.resumeId, resumeIds))
					.orderBy(desc(schema.resumeEvaluation.createdAt))
					.limit(5)
			: [];

		const recentComments = resumeIds.length > 0
			? await db
					.select()
					.from(schema.resumeComment)
					.where(inArray(schema.resumeComment.resumeId, resumeIds))
					.orderBy(desc(schema.resumeComment.createdAt))
					.limit(5)
			: [];

		const resumeIdToEmail = new Map<string, string>();
		for (const student of students) {
			for (const r of student.resumes) {
				resumeIdToEmail.set(r.id, student.email);
			}
		}

		// ── Derived stats matching the TPO overview UI exactly ──

		// Card 1-2: Total Students, Total Resumes
		const totalStudents = students.length;
		const totalResumes = allResumes.length;

		// Submission Breakdown (left column of charts)
		const withResumes = students.filter((s) => s.resumes.length > 0).length;
		const noResumes = totalStudents - withResumes;
		const pendingReview = students.filter((s) =>
			s.resumes.some((r) => r.isSubmitted && r.evaluationScore === null),
		).length;
		const evaluated = students.filter((s) =>
			s.resumes.some((r) => r.evaluationScore !== null),
		).length;

		// Card 3: Submission Rate = students with resumes / total students
		const submissionRate = totalStudents > 0 ? Math.round((withResumes / totalStudents) * 1000) / 10 : 0;

		// Card 4: Evaluation Rate = evaluated / students with resumes
		const evaluationRate = withResumes > 0 ? Math.round((evaluated / withResumes) * 1000) / 10 : 0;

		// Card 5: Avg Score (out of 5)
		const averageScore = allScores.length > 0
			? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
			: null;

		// Card 6: ATS Checks (total across all students)
		let totalAtsChecks = 0;
		try {
			const [atsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.atsScoreHistory);
			totalAtsChecks = atsResult?.count ?? 0;
		} catch { /* ats_score_history table may not exist */ }

		// Score Distribution (right column chart) — buckets of 0-1, 1-2, 2-3, 3-4, 4-5
		const scoreDistribution = [
			{ bucket: "0-1", min: 0, max: 1, count: 0 },
			{ bucket: "1-2", min: 1, max: 2, count: 0 },
			{ bucket: "2-3", min: 2, max: 3, count: 0 },
			{ bucket: "3-4", min: 3, max: 4, count: 0 },
			{ bucket: "4-5", min: 4, max: 5, count: 0 },
		];
		for (const score of allScores) {
			for (const b of scoreDistribution) {
				if (score >= b.min && score < b.max) { b.count++; break; }
				if (b.max === 5 && score === 5) { b.count++; break; }
			}
		}

		return Response.json({
			// ── Pre-computed overview stats (matches TPO dashboard cards exactly) ──
			overviewStats: {
				// Row 1: 6 stat cards
				totalStudents,
				totalResumes,
				submissionRate,          // % — "0.2%" in the UI
				evaluationRate,          // % — "100.0%" in the UI
				averageScore,            // out of 5 — "3.0/5" in the UI
				totalAtsChecks,          // integer — "4" in the UI

				// Submission Breakdown (left column)
				withResumes,             // students who have at least 1 resume
				noResumes,               // students with no resume
				pendingReview,           // submitted but not yet evaluated
				evaluated,               // has evaluation score

				// Donut Chart (center column)
				donutChart: {
					submitted: withResumes,
					notSubmitted: noResumes,
					total: totalStudents,
				},

				// Score Distribution bar chart (right column)
				scoreDistribution,
			},

			// ── Full data for drill-down ──
			sections: sectionStats,
			students,
			aggregateStats: {
				totalStudents,
				totalResumes,
				totalEvaluations: allEvaluated.length,
				totalSubmitted: allResumes.filter((r) => r.isSubmitted).length,
				totalComments,
				completionRate: totalResumes > 0 ? Math.round((allEvaluated.length / totalResumes) * 100) : 0,
				averageScore,
			},
			recentActivity: {
				recentEvaluations: recentEvaluations.map((e) => {
					const email = resumeIdToEmail.get(e.resumeId);
					const student = email ? engLabsStudents.find((s) => s.email === email) : null;
					return { id: e.id, resumeId: e.resumeId, overallScore: e.overallScore, evaluatedAt: e.evaluatedAt, studentName: student?.name ?? null };
				}),
				recentComments: recentComments.map((c) => {
					const email = resumeIdToEmail.get(c.resumeId);
					const student = email ? engLabsStudents.find((s) => s.email === email) : null;
					return { id: c.id, resumeId: c.resumeId, content: c.content, createdAt: c.createdAt, studentName: student?.name ?? null };
				}),
			},
			packages: filterPackages,
			unitTypes: scope === "faculty" && sections.length > 0 ? [...new Set(scopedOrgUnits.map((u: any) => u.type))].sort() : unitTypes,
			allOrgUnits: scopedOrgUnits,
		});
	} catch (error) {
		console.error("[dashboard-stats] Error:", error);
		return Response.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
	}
}

export const Route = createFileRoute("/api/dashboard-stats")({
	server: {
		handlers: {
			GET: handler,
		},
	},
});
