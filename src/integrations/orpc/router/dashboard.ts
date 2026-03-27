/**
 * Dashboard oRPC Endpoints
 *
 * Provides:
 * - Student feedback dashboard
 * - Faculty review dashboard
 * - Admin metrics dashboard
 * - PO cross-section dashboard
 */

import { z } from "zod";
import { protectedProcedure } from "../context";
import { db } from "@/integrations/drizzle/client";
import { schema } from "@/integrations/drizzle";
import { desc, eq } from "drizzle-orm";

/**
 * Student Dashboard
 * Shows student's resumes with feedback summary
 */
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
			tenantId: z.string().optional().describe("Tenant ID (optional)"),
		})
	)
	.handler(async ({ input }) => {
		const { userId } = input;

		// Fetch all resumes for this user
		const resumes = await db
			.select()
			.from(schema.resume)
			.where(eq(schema.resume.userId, userId));

		// For each resume, fetch feedback summary
		const resumesWithFeedback = await Promise.all(
			resumes.map(async (resume) => {
				const comments = await db
					.select()
					.from(schema.resumeComment)
					.where(eq(schema.resumeComment.resumeId, resume.id));

				const evaluations = await db
					.select()
					.from(schema.resumeEvaluation)
					.where(eq(schema.resumeEvaluation.resumeId, resume.id))
					.orderBy(desc(schema.resumeEvaluation.createdAt))
					.limit(1);

				const allEvaluations = await db
					.select({ score: schema.resumeEvaluation.overallScore })
					.from(schema.resumeEvaluation)
					.where(eq(schema.resumeEvaluation.resumeId, resume.id));

				return {
					...resume,
					feedback: {
						totalComments: comments.length,
						latestEvaluation: evaluations[0] || null,
						averageScore:
							allEvaluations.length > 0
								? allEvaluations.reduce((sum, e) => sum + (e.score || 0), 0) /
									  allEvaluations.length
								: null,
					},
				};
			})
		);

		// Calculate overall stats
		const totalComments = resumesWithFeedback.reduce(
			(sum, r) => sum + r.feedback.totalComments,
			0
		);
		const completedEvaluations = resumesWithFeedback.filter(
			(r) => r.feedback.latestEvaluation
		).length;

		return {
			user: {
				id: userId,
			},
			resumes: resumesWithFeedback,
			stats: {
				totalResumes: resumesWithFeedback.length,
				withFeedback: resumesWithFeedback.filter((r) => r.feedback.totalComments > 0)
					.length,
				totalComments,
				evaluationsReceived: completedEvaluations,
				averageScore:
					completedEvaluations > 0
						? resumesWithFeedback
								.filter((r) => r.feedback.latestEvaluation)
								.reduce((sum, r) => sum + (r.feedback.latestEvaluation?.overallScore || 0), 0) /
								completedEvaluations
						: null,
			},
		};
	});

/**
 * Faculty Review Dashboard
 * Shows faculty's assigned sections with student resumes
 */
export const facultyDashboard = protectedProcedure
	.route({
		method: "GET",
		path: "/resumes/dashboard/faculty",
		tags: ["Dashboard"],
		operationId: "getFacultyDashboard",
		summary: "Get faculty dashboard data",
		description: "Returns checklists, evaluations, and comments created by the faculty member.",
	})
	.input(
		z.object({
			userId: z.string().describe("User ID of the faculty member"),
			tenantId: z.string().optional().describe("Tenant ID (optional)"),
		})
	)
	.handler(async ({ input }) => {
		const { userId } = input;

		// Get all checklists created by this faculty
		const checklists = await db
			.select()
			.from(schema.resumeChecklist)
			.where(eq(schema.resumeChecklist.facultyId, userId));

		// Get all evaluations done by this faculty
		const evaluations = await db
			.select()
			.from(schema.resumeEvaluation)
			.where(eq(schema.resumeEvaluation.evaluatedBy, userId))
			.orderBy(desc(schema.resumeEvaluation.createdAt));

		// Get all comments from this faculty
		const comments = await db
			.select()
			.from(schema.resumeComment)
			.where(eq(schema.resumeComment.authorId, userId))
			.orderBy(desc(schema.resumeComment.createdAt));

		return {
			faculty: {
				id: userId,
			},
			checklists,
			stats: {
				totalChecklists: checklists.length,
				totalEvaluations: evaluations.length,
				totalComments: comments.length,
				recentActivity: {
					lastEvaluation: evaluations[0]?.createdAt || null,
					lastComment: comments[0]?.createdAt || null,
				},
			},
			recentEvaluations: evaluations.slice(0, 5),
			recentComments: comments.slice(0, 5),
		};
	});

/**
 * Admin Metrics Dashboard
 * Shows aggregated metrics across organization
 */
export const adminDashboard = protectedProcedure
	.route({
		method: "GET",
		path: "/resumes/dashboard/admin",
		tags: ["Dashboard"],
		operationId: "getAdminDashboard",
		summary: "Get admin organization metrics",
		description: "Returns aggregated metrics across the organization, including total resumes and evaluation rates.",
	})
	.input(
		z.object({
			tenantId: z.string().describe("Tenant ID to fetch metrics for"),
		})
	)
	.handler(async ({ input }) => {
		const { tenantId } = input;

		// Get all resumes in organization
		const allResumes = await db.select().from(schema.resume);

		// Get all evaluations
		const allEvaluations = await db.select().from(schema.resumeEvaluation);

		// Get all comments
		const allComments = await db.select().from(schema.resumeComment);

		// Get all checklists
		const allChecklists = await db.select().from(schema.resumeChecklist);

		// Calculate stats
		const resumesWithEvaluation = allResumes.filter((r) =>
			allEvaluations.some((e) => e.resumeId === r.id)
		).length;

		const averageScore =
			allEvaluations.length > 0
				? allEvaluations.reduce((sum, e) => sum + (e.overallScore || 0), 0) /
						allEvaluations.length
				: null;

		return {
			organization: {
				id: tenantId,
			},
			stats: {
				totalResumes: allResumes.length,
				totalEvaluations: allEvaluations.length,
				resumesEvaluated: resumesWithEvaluation,
				completionRate:
					allResumes.length > 0
						? Math.round((resumesWithEvaluation / allResumes.length) * 100)
						: 0,
				totalComments: allComments.length,
				totalChecklists: allChecklists.length,
				averageScore,
			},
			recentActivity: {
				recentResumes: allResumes.slice(0, 5),
				recentEvaluations: allEvaluations
					.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
					.slice(0, 5),
				recentComments: allComments
					.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
					.slice(0, 5),
			},
		};
	});

/**
 * PO Cross-Section Dashboard
 * Shows all resumes and metrics across sections
 */
export const poDashboard = protectedProcedure
	.route({
		method: "GET",
		path: "/resumes/dashboard/po",
		tags: ["Dashboard"],
		operationId: "getPoDashboard",
		summary: "Get Placement Officer dashboard data",
		description: "Returns cross-sectional metrics and user-specific performance data for PO review.",
	})
	.input(
		z.object({
			tenantId: z.string().describe("Tenant ID to fetch metrics for"),
		})
	)
	.handler(async ({ input }) => {
		const { tenantId } = input;

		// Get all resumes
		const allResumes = await db.select().from(schema.resume);

		// Get all evaluations
		const allEvaluations = await db.select().from(schema.resumeEvaluation);

		// Get all comments
		const allComments = await db.select().from(schema.resumeComment);

		// Group by user for section-like grouping
		const resumesByUser = new Map<string, (typeof allResumes)[number][]>();
		allResumes.forEach((resume) => {
			const existing = resumesByUser.get(resume.userId);
			if (existing) {
				existing.push(resume);
			} else {
				resumesByUser.set(resume.userId, [resume]);
			}
		});

		// Calculate metrics per user/section
		const userMetrics = Array.from(resumesByUser.entries()).map(([userId, userResumes]) => {
			const userEvaluations = allEvaluations.filter((e) =>
				userResumes.some((r) => r.id === e.resumeId)
			);
			const userComments = allComments.filter((c) =>
				userResumes.some((r) => r.id === c.resumeId)
			);

			return {
				userId,
				totalResumes: userResumes.length,
				evaluatedResumes: new Set(userEvaluations.map((e) => e.resumeId)).size,
				totalComments: userComments.length,
				averageScore:
					userEvaluations.length > 0
						? userEvaluations.reduce((sum, e) => sum + (e.overallScore || 0), 0) /
								userEvaluations.length
						: null,
			};
		});

		return {
			organization: {
				id: tenantId,
			},
			userMetrics,
			aggregateStats: {
				totalResumes: allResumes.length,
				totalEvaluations: allEvaluations.length,
				evaluatedResumes: new Set(allEvaluations.map((e) => e.resumeId)).size,
				completionRate:
					allResumes.length > 0
						? Math.round(
								(new Set(allEvaluations.map((e) => e.resumeId)).size / allResumes.length) *
									100
							)
						: 0,
				totalComments: allComments.length,
				averageScore:
					allEvaluations.length > 0
						? allEvaluations.reduce((sum, e) => sum + (e.overallScore || 0), 0) /
								allEvaluations.length
						: null,
			},
		};
	});

/**
 * Dashboard Router
 */
export const dashboardRouter = {
	student: studentDashboard,
	faculty: facultyDashboard,
	admin: adminDashboard,
	po: poDashboard,
};

