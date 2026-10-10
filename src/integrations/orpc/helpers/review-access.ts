import { ORPCError } from "@orpc/client";
import { eq } from "drizzle-orm";
import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";

const CROSS_TENANT_TYPES = new Set(["PLATFORM_ADMIN", "SUPER_ADMIN"]);

/**
 * Who may read or act on a resume's review feedback: its owner, or eng-labs staff (any non-LEARNER)
 * from the student's tenant. The student's tenant comes from eng-labs by email (authoritative),
 * falling back to the Better Auth user row for students not provisioned there.
 */
export async function getReviewAccess(
	user: { id: string; email: string },
	resumeId: string,
): Promise<"owner" | "staff"> {
	const [row] = await db
		.select({ userId: schema.resume.userId, ownerEmail: schema.user.email, ownerTenantId: schema.user.tenantId })
		.from(schema.resume)
		.innerJoin(schema.user, eq(schema.user.id, schema.resume.userId))
		.where(eq(schema.resume.id, resumeId))
		.limit(1);

	if (!row) throw new ORPCError("NOT_FOUND", { message: "Resume not found." });
	if (row.userId === user.id) return "owner";

	const { getEngLabsUserByEmail } = await import("@/integrations/eng-labs");
	const [reviewer, owner] = await Promise.all([
		getEngLabsUserByEmail(user.email),
		getEngLabsUserByEmail(row.ownerEmail),
	]);
	const reviewerType = reviewer?.userType ?? "LEARNER";

	if (reviewerType !== "LEARNER") {
		if (CROSS_TENANT_TYPES.has(reviewerType)) return "staff";
		if (reviewer?.tenantId && reviewer.tenantId === (owner?.tenantId ?? row.ownerTenantId)) return "staff";
	}

	throw new ORPCError("FORBIDDEN", { message: "You do not have access to this resume's feedback." });
}

/** The signed-in reviewer's eng-labs id and tenant; FORBIDDEN for students and unprovisioned users. */
export async function requireReviewer(email: string): Promise<{ id: string; tenantId: string }> {
	const { getEngLabsUserByEmail } = await import("@/integrations/eng-labs");
	const reviewer = await getEngLabsUserByEmail(email);
	if (!reviewer?.tenantId || (reviewer.userType ?? "LEARNER") === "LEARNER") {
		throw new ORPCError("FORBIDDEN", { message: "Only reviewers can do this." });
	}
	return { id: reviewer.id, tenantId: reviewer.tenantId };
}

export async function assertReviewStaff(user: { id: string; email: string }, resumeId: string) {
	if ((await getReviewAccess(user, resumeId)) !== "staff") {
		throw new ORPCError("FORBIDDEN", { message: "Only reviewers can do this." });
	}
}
