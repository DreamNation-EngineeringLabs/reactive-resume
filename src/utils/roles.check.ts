// Run: pnpm exec tsx --test src/utils/roles.check.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { ActorType, canChangeReviewStatus, isPoOwnedStatus, PO_OWNED_REVIEW_STATUSES } from "./roles";

const FACULTY_STAGES = [
	"DRAFT",
	"SUBMITTED_TO_FACULTY",
	"FACULTY_REVISION_REQUESTED",
	"FACULTY_VERIFIED",
	"FINALIZED_BY_FACULTY",
];

test("faculty may act on every stage the Placement Officer has not taken on", () => {
	for (const stage of FACULTY_STAGES) {
		assert.equal(canChangeReviewStatus(ActorType.INSTRUCTOR, stage), true, stage);
	}
});

test("faculty may not act once the resume is at a Placement Officer stage", () => {
	for (const stage of PO_OWNED_REVIEW_STATUSES) {
		assert.equal(canChangeReviewStatus(ActorType.INSTRUCTOR, stage), false, stage);
	}
});

test("the Placement Officer may act on any stage, including faculty ones", () => {
	for (const stage of [...FACULTY_STAGES, ...PO_OWNED_REVIEW_STATUSES]) {
		assert.equal(canChangeReviewStatus(ActorType.PLACEMENT_OFFICER, stage), true, stage);
	}
});

test("an admin has the same reach as the Placement Officer", () => {
	for (const stage of PO_OWNED_REVIEW_STATUSES) {
		assert.equal(canChangeReviewStatus(ActorType.ADMIN, stage), true, stage);
	}
});

test("a resume with no status yet is open to faculty", () => {
	// A resume created before review existed has reviewStatus null; it is a draft, not PO work.
	assert.equal(canChangeReviewStatus(ActorType.INSTRUCTOR, null), true);
	assert.equal(canChangeReviewStatus(ActorType.INSTRUCTOR, undefined), true);
	assert.equal(isPoOwnedStatus(null), false);
});

test("the PO revision loop does not strand faculty", () => {
	// A PO section review resets resumes to FINALIZED_BY_FACULTY for faculty to address, so the
	// stage faculty is asked to act on must stay open to them.
	assert.equal(canChangeReviewStatus(ActorType.INSTRUCTOR, "FINALIZED_BY_FACULTY"), true);
	// An individual PO_REVISION_REQUESTED is cleared by the student resubmitting, not by faculty,
	// so it stays closed to them.
	assert.equal(canChangeReviewStatus(ActorType.INSTRUCTOR, "PO_REVISION_REQUESTED"), false);
});

test("an unknown stage is not mistaken for Placement Officer work", () => {
	assert.equal(isPoOwnedStatus("SOMETHING_ELSE"), false);
	assert.equal(canChangeReviewStatus(ActorType.INSTRUCTOR, "SOMETHING_ELSE"), true);
});
