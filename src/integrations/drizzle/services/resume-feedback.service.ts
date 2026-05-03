/**
 * Resume Feedback Service
 * Handles all database operations for resume comments, checklists, and evaluations
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { DEFAULT_RESUME_USER_ORG_ID } from "@/integrations/auth/config";
import { db } from "@/integrations/drizzle/client";
import {
	poSectionReview,
	resume,
	resumeChecklist,
	resumeChecklistItem,
	resumeComment,
	resumeEvaluation,
	resumeEvaluationItem,
	resumeHistory,
} from "@/integrations/drizzle/schema";

/**
 * CREATE: Add a comment to a resume
 */
export async function createComment({
	resumeId,
	studentId,
	tenantId,
	authorId,
	content,
	scope = "INDIVIDUAL",
	parentId,
}: {
	resumeId: string;
	studentId: string;
	tenantId: string;
	authorId: string;
	content: string;
	scope?: "INDIVIDUAL" | "SECTION";
	parentId?: string;
}) {
	const result = await db
		.insert(resumeComment)
		.values({
			id: crypto.randomUUID(),
			resumeId,
			studentId,
			tenantId,
			organisationId: DEFAULT_RESUME_USER_ORG_ID,
			authorId,
			content,
			scope,
			parentId,
			status: "OPEN",
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning();

	// If this is a reply (has parentId), and the parent is ADDRESSED/RESOLVED,
	// we should probably re-open it because the feedback is ongoing.
	if (parentId) {
		await db
			.update(resumeComment)
			.set({ status: "OPEN", resolvedAt: null, updatedAt: new Date() })
			.where(eq(resumeComment.id, parentId));
	}

	return result[0];
}

/**
 * UPDATE: Update a comment's status
 */
export async function updateCommentStatus(id: string, status: "OPEN" | "ADDRESSED" | "RESOLVED") {
	const resolvedAt = status === "RESOLVED" ? new Date() : null;

	const result = await db
		.update(resumeComment)
		.set({ status, resolvedAt, updatedAt: new Date() })
		.where(eq(resumeComment.id, id))
		.returning();

	return result[0];
}

/**
 * READ: List comments for a resume
 */
export async function getCommentsByResumeId(resumeId: string) {
	const comments = await db
		.select()
		.from(resumeComment)
		.where(eq(resumeComment.resumeId, resumeId))
		.orderBy(desc(resumeComment.createdAt));

	return comments;
}

/**
 * UPDATE: Update a comment (status, content)
 */
export async function updateComment(
	commentId: string,
	updates: {
		content?: string;
		status?: "OPEN" | "ADDRESSED" | "RESOLVED";
		resolvedAt?: Date | null;
	},
) {
	const result = await db
		.update(resumeComment)
		.set({
			...updates,
			updatedAt: new Date(),
		})
		.where(eq(resumeComment.id, commentId))
		.returning();

	return result[0];
}

/**
 * DELETE: Soft delete a comment (set status to RESOLVED or add resolvedAt)
 */
export async function softDeleteComment(commentId: string) {
	const result = await db
		.update(resumeComment)
		.set({
			status: "RESOLVED",
			resolvedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(resumeComment.id, commentId))
		.returning();

	return result[0];
}

/**
 * CREATE: Create an evaluation checklist
 */
export async function createChecklist({
	facultyId,
	tenantId,
	courseId,
	title,
	description,
	items,
}: {
	facultyId: string;
	tenantId: string;
	courseId?: string;
	title: string;
	description?: string;
	items: Array<{
		title: string;
		description?: string;
		weight?: number;
		order?: number;
	}>;
}) {
	const checklistId = crypto.randomUUID();

	// Create checklist
	const checklistResult = await db
		.insert(resumeChecklist)
		.values({
			id: checklistId,
			facultyId,
			tenantId,
			organisationId: DEFAULT_RESUME_USER_ORG_ID,
			courseId,
			title,
			description,
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.returning();

	// Create items
	const itemsResult = await db
		.insert(resumeChecklistItem)
		.values(
			items.map((item, index) => ({
				id: crypto.randomUUID(),
				checklistId,
				title: item.title,
				description: item.description,
				weight: item.weight ?? 1.0,
				order: item.order ?? index,
				createdAt: new Date(),
				updatedAt: new Date(),
			})),
		)
		.returning();

	return {
		...checklistResult[0],
		items: itemsResult,
	};
}

/**
 * READ: Get checklist by ID with items
 */
export async function getChecklistById(checklistId: string) {
	const checklist = await db.select().from(resumeChecklist).where(eq(resumeChecklist.id, checklistId));

	if (!checklist.length) return null;

	const items = await db
		.select()
		.from(resumeChecklistItem)
		.where(eq(resumeChecklistItem.checklistId, checklistId))
		.orderBy(resumeChecklistItem.order);

	return {
		...checklist[0],
		items,
	};
}

/**
 * READ: List checklists by faculty or course
 */
export async function listChecklists({
	facultyId,
	facultyIds,
	courseId,
	tenantId,
}: {
	facultyId?: string;
	facultyIds?: string[];
	courseId?: string;
	tenantId: string;
}) {
	const conditions = [eq(resumeChecklist.tenantId, tenantId)];

	if (facultyId) {
		conditions.push(eq(resumeChecklist.facultyId, facultyId));
	}

	if (facultyIds && facultyIds.length > 0) {
		conditions.push(inArray(resumeChecklist.facultyId, facultyIds));
	}

	if (courseId) {
		conditions.push(eq(resumeChecklist.courseId, courseId));
	}

	return await db
		.select()
		.from(resumeChecklist)
		.where(and(...conditions));
}

/**
 * UPDATE: Deactivate a checklist
 */
export async function deactivateChecklist(checklistId: string) {
	const result = await db
		.update(resumeChecklist)
		.set({
			isActive: false,
			updatedAt: new Date(),
		})
		.where(eq(resumeChecklist.id, checklistId))
		.returning();

	return result[0];
}

/**
 * CREATE: Create or Update an evaluation
 */
export async function createEvaluation({
	resumeId,
	studentId,
	tenantId,
	checklistId,
	evaluatedBy,
	isAutoGenerated = false,
	items,
}: {
	resumeId: string;
	studentId: string;
	tenantId: string;
	checklistId: string;
	evaluatedBy: string;
	isAutoGenerated?: boolean;
	items: Array<{
		checklistItemId: string;
		passed: boolean;
		notes?: string;
		score?: number;
	}>;
}) {
	// Calculate overall score as weighted average:
	// overall = sum(itemScore * itemWeight) / sum(itemWeight)
	const checklistItemIds = [...new Set(items.map((item) => item.checklistItemId))];
	const checklistWeights =
		checklistItemIds.length > 0
			? await db
					.select({ id: resumeChecklistItem.id, weight: resumeChecklistItem.weight })
					.from(resumeChecklistItem)
					.where(
						and(
							eq(resumeChecklistItem.checklistId, checklistId),
							inArray(resumeChecklistItem.id, checklistItemIds),
						),
					)
			: [];
	const weightByItemId = new Map(checklistWeights.map((row) => [row.id, row.weight ?? 1]));
	let weightedScoreSum = 0;
	let totalWeight = 0;
	for (const item of items) {
		const weight = weightByItemId.get(item.checklistItemId) ?? 1;
		const score = item.score ?? 0;
		weightedScoreSum += score * weight;
		totalWeight += weight;
	}
	const overallScore = totalWeight > 0 ? weightedScoreSum / totalWeight : null;

	// Check if evaluation already exists for (resumeId, checklistId)
	const existing = await db
		.select()
		.from(resumeEvaluation)
		.where(and(eq(resumeEvaluation.resumeId, resumeId), eq(resumeEvaluation.checklistId, checklistId)))
		.limit(1);

	// Fetch current resume snapshot
	const resumeResult = await db.select().from(resume).where(eq(resume.id, resumeId)).limit(1);
	const snapshot = resumeResult.length > 0 ? resumeResult[0].data : null;

	let evaluationId: string;

	if (existing.length > 0) {
		evaluationId = existing[0].id;
		// Update existing evaluation
		await db
			.update(resumeEvaluation)
			.set({
				overallScore,
				isAutoGenerated,
				snapshot,
				evaluatedBy,
				evaluatedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(resumeEvaluation.id, evaluationId));

		// Delete existing items
		await db.delete(resumeEvaluationItem).where(eq(resumeEvaluationItem.evaluationId, evaluationId));
	} else {
		evaluationId = crypto.randomUUID();
		// Create new evaluation
		await db.insert(resumeEvaluation).values({
			id: evaluationId,
			resumeId,
			studentId,
			tenantId,
			organisationId: DEFAULT_RESUME_USER_ORG_ID,
			checklistId,
			overallScore,
			isAutoGenerated,
			snapshot,
			evaluatedBy,
			evaluatedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	}

	// Add to history
	await addToHistory({
		resumeId,
		studentId,
		tenantId,
		action: "EVALUATED",
		changedBy: evaluatedBy,
		actorType: "INSTRUCTOR",
		currentData: snapshot,
	});

	// Insert new evaluation items
	const itemsResult = await db
		.insert(resumeEvaluationItem)
		.values(
			items.map((item) => ({
				id: crypto.randomUUID(),
				evaluationId,
				checklistItemId: item.checklistItemId,
				passed: item.passed,
				notes: item.notes,
				score: item.score,
				createdAt: new Date(),
			})),
		)
		.returning();

	// Return the evaluation (either updated or new)
	const finalEval = await db.select().from(resumeEvaluation).where(eq(resumeEvaluation.id, evaluationId));

	return {
		...finalEval[0],
		items: itemsResult,
	};
}

/**
 * READ: Get evaluation by ID with items
 */
export async function getEvaluationById(evaluationId: string) {
	const evaluation = await db.select().from(resumeEvaluation).where(eq(resumeEvaluation.id, evaluationId));

	if (!evaluation.length) return null;

	const items = await db.select().from(resumeEvaluationItem).where(eq(resumeEvaluationItem.evaluationId, evaluationId));

	return {
		...evaluation[0],
		items,
	};
}

/**
 * READ: List evaluations for a resume
 */
export async function getEvaluationsByResumeId(resumeId: string) {
	const evaluations = await db
		.select()
		.from(resumeEvaluation)
		.where(eq(resumeEvaluation.resumeId, resumeId))
		.orderBy(desc(resumeEvaluation.evaluatedAt));

	// Fetch items for each evaluation
	const evaluationsWithItems = await Promise.all(
		evaluations.map(async (evaluation) => {
			const items = await db
				.select()
				.from(resumeEvaluationItem)
				.where(eq(resumeEvaluationItem.evaluationId, evaluation.id));

			return {
				...evaluation,
				items,
			};
		}),
	);

	return evaluationsWithItems;
}

/**
 * CREATE: Add to resume history audit trail
 */
export async function addToHistory({
	resumeId,
	studentId,
	tenantId,
	action,
	changedBy,
	actorType,
	previousData,
	currentData,
}: {
	resumeId: string;
	studentId?: string;
	tenantId?: string;
	action:
		| "CREATED"
		| "UPDATED"
		| "COMMENTED"
		| "EVALUATED"
		| "FORWARDED"
		| "SUBMITTED"
		| "FACULTY_VERIFIED"
		| "FINALIZED"
		| "PO_REVISION_REQUESTED"
		| "PO_APPROVED"
		| "PO_REJECTED"
		| "RESUBMITTED";
	changedBy: string;
	actorType: "LEARNER" | "INSTRUCTOR" | "PLACEMENT_OFFICER" | "ADMIN";
	previousData?: unknown;
	currentData?: unknown;
}) {
	const result = await db
		.insert(resumeHistory)
		.values({
			resumeId,
			studentId: studentId ?? "unknown",
			tenantId: tenantId ?? "default",
			organisationId: DEFAULT_RESUME_USER_ORG_ID,
			action,
			changedBy,
			actorType,
			previousData,
			currentData,
			createdAt: new Date(),
		})
		.returning();

	return result[0];
}

/**
 * UPDATE: Update resume review status and record history
 */
export async function updateResumeStatus({
	resumeId,
	studentId,
	tenantId,
	status,
	changedBy,
	actorType,
	isLocked: explicitIsLocked,
}: {
	resumeId: string;
	studentId?: string;
	tenantId?: string;
	status:
		| "DRAFT"
		| "SUBMITTED_TO_FACULTY"
		| "FACULTY_REVISION_REQUESTED"
		| "FACULTY_VERIFIED"
		| "FINALIZED_BY_FACULTY"
		| "SUBMITTED_TO_PO"
		| "PO_REVISION_REQUESTED"
		| "RESUBMITTED_TO_PO"
		| "PO_VERIFIED"
		| "APPROVED";
	changedBy: string;
	actorType: "LEARNER" | "INSTRUCTOR" | "PLACEMENT_OFFICER" | "ADMIN";
	isLocked?: boolean;
}) {
	// Decide default locking based on status if not explicitly provided
	let lockValue = explicitIsLocked;
	if (lockValue === undefined) {
		const lockStatuses = ["FACULTY_VERIFIED", "FINALIZED_BY_FACULTY", "SUBMITTED_TO_PO", "PO_VERIFIED", "APPROVED"];
		const unlockStatuses = ["DRAFT", "FACULTY_REVISION_REQUESTED", "PO_REVISION_REQUESTED"];

		if (lockStatuses.includes(status)) lockValue = true;
		if (unlockStatuses.includes(status)) lockValue = false;
	}

	const result = await db
		.update(resume)
		.set({
			reviewStatus: status,
			isLocked: lockValue,
			updatedAt: new Date(),
		})
		.where(eq(resume.id, resumeId))
		.returning();

	// Map status to history action
	const actionMap: Record<string, string> = {
		SUBMITTED_TO_FACULTY: "SUBMITTED",
		FACULTY_REVISION_REQUESTED: "UPDATED",
		FACULTY_VERIFIED: "FACULTY_VERIFIED",
		FINALIZED_BY_FACULTY: "FINALIZED",
		SUBMITTED_TO_PO: "SUBMITTED_TO_PO",
		PO_REVISION_REQUESTED: "PO_REVISION_REQUESTED",
		RESUBMITTED_TO_PO: "RESUBMITTED",
		PO_VERIFIED: "FACULTY_VERIFIED",
		APPROVED: "PO_APPROVED",
	};

	if (actionMap[status]) {
		await addToHistory({
			resumeId,
			studentId,
			tenantId,
			action: actionMap[status] as any,
			changedBy,
			actorType,
		});
	}

	return result[0];
}

/**
 * UPDATE: Bulk update status for an entire section
 * Used by Faculty to "Finalize Section" after individual reviews
 */
export async function bulkUpdateSectionResumes({
	resumes,
	tenantId,
	toStatus,
	changedBy,
	actorType,
}: {
	resumes: Array<{ id: string; studentId: string }>;
	tenantId: string;
	toStatus:
		| "DRAFT"
		| "SUBMITTED_TO_FACULTY"
		| "FACULTY_REVISION_REQUESTED"
		| "FACULTY_VERIFIED"
		| "FINALIZED_BY_FACULTY"
		| "SUBMITTED_TO_PO"
		| "PO_REVISION_REQUESTED"
		| "RESUBMITTED_TO_PO"
		| "PO_VERIFIED"
		| "APPROVED";
	changedBy: string;
	actorType: "INSTRUCTOR" | "PLACEMENT_OFFICER" | "ADMIN";
}) {
	const resumeIds = resumes.map((r) => r.id);

	// Decide locking based on status
	const lockStatuses = ["FACULTY_VERIFIED", "FINALIZED_BY_FACULTY", "SUBMITTED_TO_PO", "PO_VERIFIED", "APPROVED"];
	const isLocked = lockStatuses.includes(toStatus);

	// 1. Update all resumes
	const results = await db
		.update(resume)
		.set({
			reviewStatus: toStatus,
			isLocked,
			updatedAt: new Date(),
		})
		.where(inArray(resume.id, resumeIds))
		.returning();

	// 2. Map status to history action
	const actionMap: Record<string, string> = {
		SUBMITTED_TO_FACULTY: "SUBMITTED",
		FACULTY_REVISION_REQUESTED: "UPDATED",
		FACULTY_VERIFIED: "FACULTY_VERIFIED",
		FINALIZED_BY_FACULTY: "FINALIZED",
		SUBMITTED_TO_PO: "SUBMITTED_TO_PO",
		PO_REVISION_REQUESTED: "PO_REVISION_REQUESTED",
		RESUBMITTED_TO_PO: "RESUBMITTED",
		PO_VERIFIED: "FACULTY_VERIFIED",
		APPROVED: "PO_APPROVED",
	};

	// 3. Record history for each (Drizzle doesn't support bulk insert with different values easily if we want to reuse addToHistory)
	// But we can do a bulk insert into resumeHistory directly.
	if (actionMap[toStatus]) {
		await db.insert(resumeHistory).values(
			resumes.map((r) => ({
				id: crypto.randomUUID(),
				resumeId: r.id,
				studentId: r.studentId,
				tenantId,
				organisationId: DEFAULT_RESUME_USER_ORG_ID,
				action: actionMap[toStatus] as any,
				changedBy,
				actorType,
				createdAt: new Date(),
			})),
		);
	}

	return results;
}

/**
 * UPDATE: Explicitly toggle lock on a resume
 */
export async function toggleLock({
	resumeId,
	isLocked,
	reason,
}: {
	resumeId: string;
	isLocked: boolean;
	reason?: string;
}) {
	const result = await db
		.update(resume)
		.set({
			isLocked,
			unlockReason: isLocked ? null : reason,
			updatedAt: new Date(),
		})
		.where(eq(resume.id, resumeId))
		.returning();

	return result[0];
}

/**
 * READ: Get resume history timeline
 */
export async function getResumeHistory(resumeId: string) {
	const history = await db
		.select()
		.from(resumeHistory)
		.where(eq(resumeHistory.resumeId, resumeId))
		.orderBy(desc(resumeHistory.createdAt));

	return history;
}

/**
 * READ: Get history for a student across all resumes
 */
export async function getStudentHistory(studentId: string, tenantId: string) {
	const history = await db
		.select()
		.from(resumeHistory)
		.where(and(eq(resumeHistory.studentId, studentId), eq(resumeHistory.tenantId, tenantId)))
		.orderBy(desc(resumeHistory.createdAt));

	return history;
}

// ─────────────────────────────────────────────────────────────────────────────
// PO Section Review
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CREATE: Record a PO's section-level review feedback.
 * Call this BEFORE bulk-setting the resumes back to FINALIZED_BY_FACULTY.
 */
export async function createPoSectionReview({
	sectionId,
	tenantId,
	facultyId,
	poId,
	reviewNotes,
	voiceNoteUrl,
	resumeIds,
}: {
	sectionId: string;
	tenantId: string;
	facultyId?: string;
	poId: string;
	reviewNotes: string;
	voiceNoteUrl?: string;
	resumeIds: string[];
}) {
	const result = await db
		.insert(poSectionReview)
		.values({
			id: crypto.randomUUID(),
			sectionId,
			tenantId,
			organisationId: DEFAULT_RESUME_USER_ORG_ID,
			facultyId: facultyId ?? null,
			poId,
			reviewNotes,
			voiceNoteUrl: voiceNoteUrl ?? null,
			resumeIds,
			createdAt: new Date(),
		})
		.returning();

	return result[0];
}

/**
 * UPDATE: Edit an existing PO section review (notes and/or voice note).
 */
export async function updatePoSectionReview(
	id: string,
	{ reviewNotes, voiceNoteUrl }: { reviewNotes: string; voiceNoteUrl?: string | null },
) {
	const result = await db
		.update(poSectionReview)
		.set({
			reviewNotes,
			voiceNoteUrl: voiceNoteUrl ?? null,
		})
		.where(eq(poSectionReview.id, id))
		.returning();

	return result[0];
}

/**
 * READ: Get PO section reviews for a given section, newest first.
 */
export async function getPoSectionReviews(sectionId: string, tenantId: string) {
	return db
		.select()
		.from(poSectionReview)
		.where(and(eq(poSectionReview.sectionId, sectionId), eq(poSectionReview.tenantId, tenantId)))
		.orderBy(desc(poSectionReview.createdAt));
}
