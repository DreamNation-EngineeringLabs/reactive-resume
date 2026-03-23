import { env } from "@/utils/env";

type ServiceType = "RESUME_CREATE" | "ATS_SCORE";

interface AccessCheckResult {
	allowed: boolean;
	remaining: number;
	total: number;
	used: number;
}

interface ConsumeResult {
	success: boolean;
	remaining: number;
}

/**
 * Checks if a user has available placement credits for a service type.
 * Calls the main app API using the user's email as identifier.
 */
export async function checkPlacementCredit(email: string, serviceType: ServiceType): Promise<AccessCheckResult> {
	const apiUrl = env.MAIN_APP_API_URL;
	const secret = env.INTERNAL_API_SECRET;

	if (!apiUrl) {
		// If main app API URL not configured, allow access (no placement checks)
		return { allowed: true, remaining: -1, total: -1, used: 0 };
	}

	try {
		const params = new URLSearchParams({
			email,
			serviceType,
		});

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (secret) {
			headers["x-internal-secret"] = secret;
		}

		const response = await fetch(`${apiUrl}/placements/access-check?${params}`, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			console.error(`Placement access check failed: ${response.status} ${response.statusText}`);
			// Strict mode: block access on API failure
			return { allowed: false, remaining: 0, total: 0, used: 0 };
		}

		const data = await response.json();
		return data.responseData || data;
	} catch (error) {
		console.error("Placement access check error:", error);
		// Strict mode: block access on network failure
		return { allowed: false, remaining: 0, total: 0, used: 0 };
	}
}

/**
 * Consumes one placement credit for a service type.
 * Called after a successful action (resume create, ATS score, etc).
 */
export async function consumePlacementCredit(email: string, serviceType: ServiceType): Promise<ConsumeResult> {
	const apiUrl = env.MAIN_APP_API_URL;
	const secret = env.INTERNAL_API_SECRET;

	if (!apiUrl) {
		return { success: true, remaining: -1 };
	}

	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (secret) {
			headers["x-internal-secret"] = secret;
		}

		const response = await fetch(`${apiUrl}/placements/consume-credit`, {
			method: "POST",
			headers,
			body: JSON.stringify({ email, serviceType }),
		});

		if (!response.ok) {
			console.error(`Placement credit consumption failed: ${response.status} ${response.statusText}`);
			return { success: false, remaining: 0 };
		}

		const data = await response.json();
		return data.responseData || data;
	} catch (error) {
		console.error("Placement credit consumption error:", error);
		return { success: false, remaining: 0 };
	}
}
