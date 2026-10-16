// History rows reference eng-labs rows on the platform database (tenant, organisation, student): they come from the
// resume and its owner, never from caller fallbacks. Needs a local database with a resume whose owner is an eng-labs user:
// node --env-file=.env --import tsx --test <this file>
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/integrations/drizzle/client";
import { resume, resumeHistory, user } from "@/integrations/drizzle/schema";
import { getEngLabsUserByEmail } from "@/integrations/eng-labs";
import { addToHistory } from "./resume-feedback.service";

test("history row takes tenant, organisation and student from the resume", async () => {
	const resumes = await db
		.select({ id: resume.id, tenantId: resume.tenantId, organisationId: resume.organisationId, email: user.email })
		.from(resume)
		.innerJoin(user, eq(user.id, resume.userId));
	let r = resumes[0];
	let student = null;
	for (r of resumes) if ((student = await getEngLabsUserByEmail(r.email))) break;
	assert.ok(student, "a resume whose owner is an eng-labs user");

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
