// Editing a comment changes what the student reads, so it must change only the feedback — never the
// round's snapshot that every before/after diff compares against. Needs a local database with a
// resume whose owner is an eng-labs user:
// node --env-file=.env --import tsx --test <this file>
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/integrations/drizzle/client";
import { resume, resumeComment, user } from "@/integrations/drizzle/schema";
import { getEngLabsUserByEmail } from "@/integrations/eng-labs";
import { createComment, getCommentById, updateComment } from "./resume-feedback.service";

/** A real resume with a real eng-labs owner, for the foreign keys on `resume_comment`. */
async function scratch() {
	const rows = await db
		.select({ id: resume.id, email: user.email })
		.from(resume)
		.innerJoin(user, eq(user.id, resume.userId));
	for (const row of rows) {
		const owner = await getEngLabsUserByEmail(row.email);
		if (owner?.tenantId) {
			return { resumeId: row.id, studentId: owner.id, authorId: owner.id, tenantId: owner.tenantId };
		}
	}
	throw new Error("no resume whose owner is an eng-labs user with a tenant");
}

/** Only the rows this check created — never anything else on a real student's resume. */
async function sweep(ids: string[]) {
	if (ids.length > 0) await db.delete(resumeComment).where(inArray(resumeComment.id, ids));
}

test("editing swaps the text and severity and keeps the snapshot", async () => {
	const base = await scratch();
	let ids: string[] = [];
	try {
		const created = await createComment({
			...base,
			content: "check: before",
			severity: "LOW",
			anchor: { section: "skills" },
		});
		ids = [created.id];

		const updated = await updateComment(created.id, { content: "check: after", severity: "HIGH" });

		assert.equal(updated?.content, "check: after");
		assert.equal(updated?.severity, "HIGH");
		assert.deepEqual(updated?.anchor, { section: "skills" }, "what it points at stays unless asked");
		assert.deepEqual(updated?.snapshot, created.snapshot, "the round's baseline is not part of the feedback");
		assert.equal(updated?.status, created.status, "an edit is not a status change");
	} finally {
		await sweep(ids);
	}
});

test("moving to another section replaces the anchor and drops the rewrite", async () => {
	const base = await scratch();
	let ids: string[] = [];
	try {
		const created = await createComment({
			...base,
			content: "check: on a quote",
			anchor: { section: "projects", quote: { exact: "some text", prefix: "", suffix: "" } },
			suggestion: "better text",
		});
		ids = [created.id];

		await updateComment(created.id, {
			content: "check: on a section",
			anchor: { section: "skills" },
			suggestion: null,
		});
		const stored = await getCommentById(created.id);

		assert.deepEqual(stored?.anchor, { section: "skills" });
		assert.equal(stored?.suggestion, null, "a rewrite for text the comment no longer points at would apply to nothing");
	} finally {
		await sweep(ids);
	}
});

test("a null severity clears it", async () => {
	const base = await scratch();
	let ids: string[] = [];
	try {
		const created = await createComment({ ...base, content: "check: severe", severity: "HIGH" });
		ids = [created.id];
		const updated = await updateComment(created.id, { content: "check: severe", severity: null });
		assert.equal(updated?.severity, null);
	} finally {
		await sweep(ids);
	}
});
