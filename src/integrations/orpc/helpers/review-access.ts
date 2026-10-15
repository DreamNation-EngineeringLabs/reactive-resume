import { ORPCError } from "@orpc/client";
import { eq, inArray } from "drizzle-orm";
import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";

const CROSS_TENANT_TYPES = new Set(["PLATFORM_ADMIN", "SUPER_ADMIN"]);

export const forbidden = () => new ORPCError("FORBIDDEN", { message: "Only reviewers can do this." });

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
		.select({ userId: schema.resume.userId })
		.from(schema.resume)
		.where(eq(schema.resume.id, resumeId))
		.limit(1);

	if (!row) throw new ORPCError("NOT_FOUND", { message: "Resume not found." });
	if (row.userId === user.id) return "owner";

	await assertReviewStaff(user, resumeId);
	return "staff";
}

/**
 * Staff of every listed resume's student tenant (one check for a whole bulk action). A staff member belongs
 * to a tenant through their own users row, or through user_mappings / unit assignments when that row has
 * no tenant — the same staff the faculty, PO and admin dashboards already let in.
 */
export async function assertReviewStaff(user: { id: string; email: string }, resumeIds: string | string[]) {
	const ids = [...new Set([resumeIds].flat())];
	const rows = await db
		.select({ userId: schema.resume.userId, ownerEmail: schema.user.email, ownerTenantId: schema.user.tenantId })
		.from(schema.resume)
		.innerJoin(schema.user, eq(schema.user.id, schema.resume.userId))
		.where(inArray(schema.resume.id, ids));

	if (rows.length !== ids.length) throw new ORPCError("NOT_FOUND", { message: "Resume not found." });
	if (rows.some((r) => r.userId === user.id)) throw forbidden();

	const { getEngLabsTenantsByEmails, getEngLabsUserByEmail, getStaffTenantIds } = await import(
		"@/integrations/eng-labs"
	);
	const reviewer = await getEngLabsUserByEmail(user.email);
	const reviewerType = reviewer?.userType ?? "LEARNER";
	if (!reviewer || reviewerType === "LEARNER") throw forbidden();
	if (CROSS_TENANT_TYPES.has(reviewerType)) return;

	const ownerTenants = await getEngLabsTenantsByEmails(rows.map((r) => r.ownerEmail));
	const studentTenants = rows.map((r) => ownerTenants.get(r.ownerEmail.trim().toLowerCase()) ?? r.ownerTenantId);
	const inTenant = (tenants: (string | undefined)[]) => studentTenants.every((t) => !!t && tenants.includes(t));

	if (inTenant([reviewer.tenantId])) return;
	if (inTenant([reviewer.tenantId, ...(await getStaffTenantIds(reviewer.id))])) return;
	throw forbidden();
}

/** The signed-in reviewer's eng-labs id and tenant; FORBIDDEN for students and unprovisioned users. */
export async function requireReviewer(email: string): Promise<{ id: string; tenantId: string }> {
	const { getEngLabsUserByEmail, getStaffTenantIds } = await import("@/integrations/eng-labs");
	const reviewer = await getEngLabsUserByEmail(email);
	if (!reviewer || (reviewer.userType ?? "LEARNER") === "LEARNER") throw forbidden();
	const tenantId = reviewer.tenantId ?? (await getStaffTenantIds(reviewer.id))[0];
	if (!tenantId) throw forbidden();
	return { id: reviewer.id, tenantId };
}
