// Run: pnpm exec tsx --test src/routes/dashboard/-components/po-progress.check.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { byRollNumber, poCounts, poGroup, unitStudents } from "./po-progress";

const student = (reviewStatus: string | null, poReviewed = false, extra: Record<string, unknown> = {}) => ({
	sectionId: "class-a",
	resumes: reviewStatus === null ? [] : [{ reviewStatus, poReviewed }],
	...extra,
});

test("every student is in exactly one PO group", () => {
	assert.equal(poGroup(student(null)), "not_submitted", "no resume");
	assert.equal(poGroup(student("DRAFT", true)), "not_submitted", "a draft stays a draft, even if the PO commented");
	assert.equal(poGroup(student("SUBMITTED_TO_FACULTY")), "pending");
	assert.equal(poGroup(student("FACULTY_REVISION_REQUESTED")), "pending", "sent back by faculty, PO not yet");
	assert.equal(poGroup(student("FACULTY_VERIFIED")), "pending");
	assert.equal(poGroup(student("FACULTY_VERIFIED", true)), "reviewed", "the PO commented on it");
	assert.equal(poGroup(student("PO_REVISION_REQUESTED")), "reviewed");
	assert.equal(poGroup(student("RESUBMITTED_TO_PO")), "reviewed", "answered the PO's review");
	assert.equal(poGroup(student("APPROVED")), "reviewed");
});

test("the counts always add up to the class", () => {
	const counts = poCounts([
		student(null),
		student("DRAFT"),
		student("SUBMITTED_TO_FACULTY"),
		student("FACULTY_VERIFIED"),
		student("FACULTY_VERIFIED", true),
		student("APPROVED"),
	]);
	assert.deepEqual(counts, { total: 6, submitted: 4, reviewed: 2, balance: 2, notSubmitted: 2 });
	assert.equal(counts.reviewed + counts.balance + counts.notSubmitted, counts.total);
	assert.equal(counts.reviewed + counts.balance, counts.submitted);
});

test("a unit's students include those linked to any unit below it", () => {
	const units = [
		{ id: "dept", parentId: null },
		{ id: "class-a", parentId: "dept" },
		{ id: "class-b", parentId: "dept" },
		{ id: "other", parentId: null },
	];
	const students = [
		{ ...student("DRAFT"), sectionId: "class-a", engLabsUnitIds: ["class-a"] },
		{ ...student("DRAFT"), sectionId: "class-b", engLabsUnitIds: ["class-b"] },
		{ ...student("DRAFT"), sectionId: "other", engLabsUnitIds: ["other"] },
		{ ...student("DRAFT"), sectionId: "class-b" }, // no unit list: falls back to the section
	];
	assert.equal(unitStudents(students, "dept", units).length, 3, "a department card counts its classes");
	assert.equal(unitStudents(students, "class-b", units).length, 2);
	assert.equal(unitStudents(students, "other", units).length, 1);
});

test("roll numbers sort the way the college lists them", () => {
	const rolls = ["21A91A0410", null, "21A91A0409", "21A91A0402"].map((rollNumber) => ({ rollNumber }));
	assert.deepEqual(
		rolls.sort(byRollNumber).map((r) => r.rollNumber),
		["21A91A0402", "21A91A0409", "21A91A0410", null],
	);
	const plain = ["10", "9", "1"].map((rollNumber) => ({ rollNumber }));
	assert.deepEqual(
		plain.sort(byRollNumber).map((r) => r.rollNumber),
		["1", "9", "10"],
		"9 before 10",
	);
});
