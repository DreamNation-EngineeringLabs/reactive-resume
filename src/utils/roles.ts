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
