import { randomBytes } from "node:crypto";
import { withEngLabsClient } from "@/integrations/drizzle/eng-labs-client";

export type ServiceType = "RESUME_CREATE" | "ATS_SCORE";

export interface CreditStatus {
	allowed: boolean;
	/** Remaining credits. -1 means unlimited (no quota row / eng-labs not configured). */
	remaining: number;
	total: number;
	used: number;
	/** True when access is unlimited rather than balance-limited. See isUnlimitedForUser. */
	unlimited?: boolean;
}

interface ConsumeResult {
	success: boolean;
	remaining: number;
}

/**
 * Maps resume-app service types to the PlacementServiceType enum used in eng-labs.
 * Both values are direct 1:1 matches with the eng-labs PlacementServiceType enum.
 */
const ENG_LABS_SERVICE_TYPE: Record<ServiceType, string> = {
	RESUME_CREATE: "RESUME_CREATE",
	ATS_SCORE: "ATS_SCORE",
};

/** Generates a 21-character URL-safe random ID matching the eng-labs nanoid format. */
function generateEngLabsId(): string {
	return randomBytes(16).toString("base64url").slice(0, 21);
}

/**
 * Looks up the eng-labs user for the given email.
 * Returns null if the user doesn't exist in eng-labs.
 *
 * tenant_id comes back too because unlimited access can be configured tenant-wide,
 * not just per grant — see isUnlimitedForUser.
 */
async function getEngLabsUser(
	client: import("pg").PoolClient,
	email: string,
): Promise<{ id: string; tenantId: string | null } | null> {
	const result = await client.query<{ id: string; tenant_id: string | null }>(
		"SELECT id, tenant_id FROM users WHERE email = $1 LIMIT 1",
		[email],
	);
	const row = result.rows[0];
	return row ? { id: row.id, tenantId: row.tenant_id } : null;
}

/**
 * True when the user holds an unexpired grant flagged `unlimited` for this service.
 *
 * `unlimited` grants carry quantity 0 by design — the flag, not the number, is the
 * authoritative signal. Treating quantity as the balance denies the user outright,
 * which is what happened to the whole VNRVJIET cohort before this was handled.
 */
async function hasUnlimitedGrant(
	client: import("pg").PoolClient,
	userId: string,
	engServiceType: string,
): Promise<boolean> {
	const { rows } = await client.query(
		`SELECT 1
		   FROM user_quota_grants
		  WHERE user_id = $1
		    AND service_type = $2
		    AND unlimited = true
		    AND (expiry_date IS NULL OR expiry_date > NOW())
		  LIMIT 1`,
		[userId, engServiceType],
	);
	return rows.length > 0;
}

/**
 * True when the tenant configures this service as UNLIMITED for every student.
 * Mirrors AccessResolverService.getUnlimitedServices + parseUnlimitedServices in
 * packages/placements: the placements_module feature must be enabled for the tenant,
 * and its configuration.unlimitedServices must list the service.
 */
async function isTenantUnlimitedService(
	client: import("pg").PoolClient,
	tenantId: string | null,
	engServiceType: string,
): Promise<boolean> {
	if (!tenantId) return false;
	const { rows } = await client.query<{ configuration: unknown }>(
		`SELECT ef.configuration
		   FROM entity_features ef
		   JOIN feature_registry fr ON fr.id = ef.feature_registry_id
		  WHERE fr.key = 'placements_module'
		    AND ef.tenant_id = $1
		    AND ef.enabled = true
		  LIMIT 1`,
		[tenantId],
	);
	const configuration = rows[0]?.configuration;
	if (!configuration || typeof configuration !== "object") return false;
	const raw = (configuration as Record<string, unknown>).unlimitedServices;
	if (!Array.isArray(raw)) return false;
	return raw.some((entry) => typeof entry === "string" && entry.trim().toUpperCase() === engServiceType);
}

/**
 * True when the service is unlimited for this user — either configured UNLIMITED for
 * their tenant or because they hold an unlimited grant. Same two sources, and the same
 * precedence, as AccessCheckService.isUnlimited in eng-labs.
 */
async function isUnlimitedForUser(
	client: import("pg").PoolClient,
	userId: string,
	tenantId: string | null,
	engServiceType: string,
): Promise<boolean> {
	if (await hasUnlimitedGrant(client, userId, engServiceType)) return true;
	return await isTenantUnlimitedService(client, tenantId, engServiceType);
}

/**
 * Checks whether a user has available credits for a service type.
 *
 * - If ENG_LABS_DATABASE_URL is not set → unlimited (allowed = true, remaining = -1).
 * - If the user has no eng-labs account → unlimited (not yet subject to quotas).
 * - If the service is unlimited for the user (tenant config or an unlimited grant) →
 *   allowed, remaining/total = -1. Checked BEFORE the balance, because unlimited grants
 *   carry quantity 0 and would otherwise read as an exhausted balance.
 * - If the user has no grants for this service type → denied (remaining = 0).
 * - Otherwise enforces strictly based on sum(grants.quantity) − sum(usage_logs.amount).
 */
export async function checkPlacementCredit(email: string, serviceType: ServiceType): Promise<CreditStatus> {
	const result = await withEngLabsClient(async (client) => {
		const engLabsUser = await getEngLabsUser(client, email);
		if (!engLabsUser) {
			return { allowed: true, remaining: -1, total: -1, used: 0 };
		}

		const engServiceType = ENG_LABS_SERVICE_TYPE[serviceType];

		if (await isUnlimitedForUser(client, engLabsUser.id, engLabsUser.tenantId, engServiceType)) {
			return { allowed: true, remaining: -1, total: -1, used: 0, unlimited: true };
		}

		const { rows } = await client.query<{ quantity: number; used: string }>(
			`SELECT g.quantity,
			        COALESCE(SUM(u.amount), 0) AS used
			   FROM user_quota_grants g
			   LEFT JOIN quota_usage_logs u ON u.grant_id = g.id
			  WHERE g.user_id = $1
			    AND g.service_type = $2
			    AND (g.expiry_date IS NULL OR g.expiry_date > NOW())
			  GROUP BY g.id, g.quantity`,
			[engLabsUser.id, engServiceType],
		);

		if (rows.length === 0) {
			// No grants found for this service type → deny
			return { allowed: false, remaining: 0, total: 0, used: 0 };
		}

		let totalGranted = 0;
		let totalUsed = 0;
		for (const row of rows) {
			totalGranted += row.quantity;
			totalUsed += Number(row.used);
		}

		const remaining = totalGranted - totalUsed;
		return {
			allowed: remaining > 0,
			remaining: Math.max(0, remaining),
			total: totalGranted,
			used: totalUsed,
		};
	});

	// ENG_LABS_DATABASE_URL not configured → treat as unlimited
	return result ?? { allowed: true, remaining: -1, total: -1, used: 0 };
}

/**
 * Consumes one credit in eng-labs quota_usage_logs.
 * Picks the grant with the earliest expiry that still has capacity.
 * Does nothing (returns success) when eng-labs is not configured or the user isn't found.
 *
 * When the service is unlimited no balance is decremented, but the usage is still metered
 * with grant_id = null for analytics — matching AccessCheckService.consumeCredit /
 * QuotaService.logUnlimitedUsage in eng-labs.
 */
export async function consumePlacementCredit(email: string, serviceType: ServiceType): Promise<ConsumeResult> {
	const result = await withEngLabsClient(async (client) => {
		const engLabsUser = await getEngLabsUser(client, email);
		if (!engLabsUser) {
			return { success: true, remaining: -1 };
		}
		const engLabsUserId = engLabsUser.id;

		const engServiceType = ENG_LABS_SERVICE_TYPE[serviceType];

		if (await isUnlimitedForUser(client, engLabsUserId, engLabsUser.tenantId, engServiceType)) {
			await client.query(
				`INSERT INTO quota_usage_logs (id, user_id, grant_id, service_type, amount, timestamp, updated_at)
				      VALUES ($1, $2, NULL, $3, 1, NOW(), NOW())`,
				[generateEngLabsId(), engLabsUserId, engServiceType],
			);
			return { success: true, remaining: -1 };
		}

		// Pick the best grant (earliest expiry first, then oldest grant)
		const { rows } = await client.query<{ id: string; quantity: number; used: string }>(
			`SELECT g.id,
			        g.quantity,
			        COALESCE(SUM(u.amount), 0) AS used
			   FROM user_quota_grants g
			   LEFT JOIN quota_usage_logs u ON u.grant_id = g.id
			  WHERE g.user_id = $1
			    AND g.service_type = $2
			    AND (g.expiry_date IS NULL OR g.expiry_date > NOW())
			  GROUP BY g.id, g.quantity
			 HAVING g.quantity > COALESCE(SUM(u.amount), 0)
			  ORDER BY g.expiry_date ASC NULLS LAST, g.created_at ASC
			  LIMIT 1`,
			[engLabsUserId, engServiceType],
		);

		if (rows.length === 0) {
			return { success: false, remaining: 0 };
		}

		const grant = rows[0];
		const usedAfter = Number(grant.used) + 1;
		const remaining = Math.max(0, grant.quantity - usedAfter);

		await client.query(
			`INSERT INTO quota_usage_logs (id, user_id, grant_id, service_type, amount, timestamp, updated_at)
			      VALUES ($1, $2, $3, $4, 1, NOW(), NOW())`,
			[generateEngLabsId(), engLabsUserId, grant.id, engServiceType],
		);

		return { success: true, remaining };
	});

	return result ?? { success: true, remaining: -1 };
}

/**
 * Returns the credit status for all service types for a given user.
 */
export async function getAllCreditStatus(email: string): Promise<Record<ServiceType, CreditStatus>> {
	const [resumeCreate, atsScore] = await Promise.all([
		checkPlacementCredit(email, "RESUME_CREATE"),
		checkPlacementCredit(email, "ATS_SCORE"),
	]);
	return { RESUME_CREATE: resumeCreate, ATS_SCORE: atsScore };
}
