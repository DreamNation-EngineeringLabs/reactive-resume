/**
 * Joins eng-labs roster data with this app's Postgres `user` table (resume builder).
 *
 * Eng-labs and Polymath/resume DB are separate systems; the stable join key is email.
 * We treat "enrolled in resume builder" as: a row exists in `user` with a matching email.
 * Metrics that need `resume` / feedback then use `user.id` from the matched rows.
 */
import { inArray, sql } from "drizzle-orm";
import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";

export type ResumeAppUser = typeof schema.user.$inferSelect;

/** Case-insensitive match so casing differences between systems do not drop learners. */
export async function fetchResumeUsersForEngLabsEmails(emails: string[]): Promise<ResumeAppUser[]> {
	if (emails.length === 0) return [];
	const normalized = [
		...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0)),
	];
	if (normalized.length === 0) return [];
	return db
		.select()
		.from(schema.user)
		.where(inArray(sql`lower(trim(${schema.user.email}))`, normalized));
}

export function mergeEngLabsWithResumeUsers<T extends { email: string }>(
	engLabsStudentsRaw: T[],
	localUsersMatched: ResumeAppUser[],
): {
	engLabsStudents: T[];
	localUsers: ResumeAppUser[];
	emailToLocalUser: Map<string, ResumeAppUser>;
	localUserIds: string[];
} {
	const resumeAppEmailSet = new Set(localUsersMatched.map((u) => u.email.trim().toLowerCase()));
	const engLabsStudents = engLabsStudentsRaw.filter((s) =>
		resumeAppEmailSet.has(s.email.trim().toLowerCase()),
	);
	const engEmailSet = new Set(engLabsStudents.map((s) => s.email.trim().toLowerCase()));
	const localUsers = localUsersMatched.filter((u) => engEmailSet.has(u.email.trim().toLowerCase()));
	const emailToLocalUser = new Map(localUsers.map((u) => [u.email.trim().toLowerCase(), u]));
	const localUserIds = localUsers.map((u) => u.id);
	return { engLabsStudents, localUsers, emailToLocalUser, localUserIds };
}

export async function resolveResumeBuilderCohort<T extends { email: string }>(
	engLabsStudentsRaw: T[],
): Promise<{
	engLabsStudents: T[];
	localUsers: ResumeAppUser[];
	emailToLocalUser: Map<string, ResumeAppUser>;
	localUserIds: string[];
}> {
	const emails = engLabsStudentsRaw.map((s) => s.email);
	const localUsersMatched = await fetchResumeUsersForEngLabsEmails(emails);
	return mergeEngLabsWithResumeUsers(engLabsStudentsRaw, localUsersMatched);
}
