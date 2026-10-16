// History and evaluation rows reference eng-labs rows on the platform database (tenant, organisation, student): they
// come from the resume and its owner, never from caller fallbacks. Needs a local database with a resume whose owner
// is an eng-labs user and a checklist with items: node --env-file=.env --import tsx --test <this file>
import assert from "node:assert/strict";
import { test } from "node:test";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/integrations/drizzle/client";
import {
	resume,
	resumeChecklistItem,
	resumeEvaluation,
	resumeEvaluationItem,
	resumeHistory,
	user,
} from "@/integrations/drizzle/schema";
import { getEngLabsUserByEmail } from "@/integrations/eng-labs";
import { addToHistory, createEvaluation } from "./resume-feedback.service";

async function ownedResume() {
	const resumes = await db
		.select({ id: resume.id, tenantId: resume.tenantId, organisationId: resume.organisationId, email: user.email })
		.from(resume)
		.innerJoin(user, eq(user.id, resume.userId));
	for (const r of resumes) {
		const student = await getEngLabsUserByEmail(r.email);
		if (student) return { r, student };
	}
	throw new Error("no resume whose owner is an eng-labs user");
}

test("history row takes tenant, organisation and student from the resume", async () => {
	const { r, student } = await ownedResume();
	const row = await addToHistory({
		resumeId: r.id,
		tenantId: "default",
		action: "FORWARDED",
		changedBy: student.id,
		actorType: "INSTRUCTOR",
	});
	await db.delete(resumeHistory).where(eq(resumeHistory.id, row.id));

	assert.equal(row.tenantId, r.tenantId);
	assert.equal(row.organisationId, r.organisationId);
	assert.equal(row.studentId, student.id);
});

test("a new evaluation takes tenant, organisation and student from the resume", async () => {
	const { r, student } = await ownedResume();
	const [item] = await db.select().from(resumeChecklistItem).limit(1);
	assert.ok(item, "a checklist item");
	const mine = and(eq(resumeEvaluation.resumeId, r.id), eq(resumeEvaluation.checklistId, item.checklistId));
	const [before] = await db.select().from(resumeEvaluation).where(mine);
	assert.equal(before, undefined, "no evaluation yet for this resume and checklist");
	const start = new Date();

	const created = await createEvaluation({
		resumeId: r.id,
		studentId: "not-a-user",
		tenantId: "default",
		checklistId: item.checklistId,
		evaluatedBy: student.id,
		items: [{ checklistItemId: item.id, passed: true, score: 5 }],
	});
	const [row] = await db.select().from(resumeEvaluation).where(mine);
	await db.delete(resumeEvaluationItem).where(eq(resumeEvaluationItem.evaluationId, row.id));
	await db.delete(resumeEvaluation).where(eq(resumeEvaluation.id, row.id));
	await db
		.delete(resumeHistory)
		.where(
			and(eq(resumeHistory.resumeId, r.id), eq(resumeHistory.action, "EVALUATED"), gte(resumeHistory.createdAt, start)),
		);

	assert.ok(created);
	assert.equal(row.tenantId, r.tenantId);
	assert.equal(row.organisationId, r.organisationId);
	assert.equal(row.studentId, student.id);
});
