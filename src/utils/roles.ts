/**
 * Canonical role constants for this platform.
 *
 * These are the ONLY valid role strings — they come from the eng-labs SSO JWT
 * and are stored as-is (uppercase) in localStorage under `sso_context.role`.
 *
 * ┌───────────────────┬──────────────────────────────────────────────┐
 * │ Role              │ Description                                  │
 * ├───────────────────┼──────────────────────────────────────────────┤
 * │ LEARNER           │ Student — can create/submit their own resume │
 * │ INSTRUCTOR        │ Faculty — reviews resumes for their sections │
 * │ PLACEMENT_OFFICER │ PO — reviews resumes across all sections     │
 * │ ADMIN             │ Admin — org-wide metrics and management      │
 * └───────────────────┴──────────────────────────────────────────────┘
 *
 * DO NOT use: STUDENT, FACULTY, PO — these are non-canonical aliases.
 */

export const Role = {
	LEARNER: "LEARNER",
	INSTRUCTOR: "INSTRUCTOR",
	PLACEMENT_OFFICER: "PLACEMENT_OFFICER",
	ADMIN: "ADMIN",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** Actor types written into resume history / audit log. */
export const ActorType = {
	LEARNER: "LEARNER",
	INSTRUCTOR: "INSTRUCTOR",
	PLACEMENT_OFFICER: "PLACEMENT_OFFICER",
	ADMIN: "ADMIN",
} as const;

export type ActorType = (typeof ActorType)[keyof typeof ActorType];

/** Returns true when the role maps to a staff / reviewer. */
export function isStaffRole(role: string | null | undefined): boolean {
	return role === Role.INSTRUCTOR || role === Role.PLACEMENT_OFFICER || role === Role.ADMIN;
}

/** Returns true when the role is a student / learner. */
export function isLearnerRole(role: string | null | undefined): boolean {
	return role === Role.LEARNER;
}

// ─────────────────────────────────────────────────────────────────────────────
// Review stage ownership
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Review stages a Placement Officer owns.
 *
 * Once a resume reaches one of these the PO has taken it on, and faculty must not move it: with
 * both roles able to see the same resume, the later write silently overwrote the earlier verdict
 * and the student received two contradictory emails. PO outranks faculty, so these stages are
 * closed to faculty and open to the PO.
 *
 * This does not strand faculty work. A PO section review resets resumes to FINALIZED_BY_FACULTY —
 * a faculty stage — and an individual PO_REVISION_REQUESTED is cleared by the *student*
 * resubmitting, which `submitResume` turns into RESUBMITTED_TO_PO. Neither asks faculty to change
 * a stage listed here.
 */
export const PO_OWNED_REVIEW_STATUSES = [
	"SUBMITTED_TO_PO",
	"RESUBMITTED_TO_PO",
	"PO_REVISION_REQUESTED",
	"PO_VERIFIED",
	"APPROVED",
] as const;

export type PoOwnedReviewStatus = (typeof PO_OWNED_REVIEW_STATUSES)[number];

/** True when `status` belongs to the Placement Officer's half of the workflow. */
export function isPoOwnedStatus(status: string | null | undefined): status is PoOwnedReviewStatus {
	return !!status && (PO_OWNED_REVIEW_STATUSES as readonly string[]).includes(status);
}

/**
 * Whether `actorType` may move a resume that is currently at `currentStatus`.
 *
 * A Placement Officer (and an admin acting as one) may change any stage. Faculty may change only
 * the stages the PO has not taken over.
 */
export function canChangeReviewStatus(actorType: ActorType, currentStatus: string | null | undefined): boolean {
	if (actorType === ActorType.PLACEMENT_OFFICER || actorType === ActorType.ADMIN) return true;
	return !isPoOwnedStatus(currentStatus);
}

/** Message shown to faculty when the Placement Officer has taken the resume over. */
export const PO_STAGE_BLOCKED_MESSAGE =
	"This resume is at the Placement Officer stage, so it can no longer be changed here.";
