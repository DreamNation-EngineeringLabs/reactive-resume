interface SsoContext {
	source_url: string | null;
	role: string | null;
	engLabsUserId: string | null;
	tenantId: string | null;
	organisationId: string | null;
	organisationUnits: string[];
	trace: string | null;
}

/**
 * Read the `sso_context` cookie set by the SSO callback (src/routes/api/auth/sso.ts). Returns the
 * raw cookie value or null. Cookie is NOT HttpOnly precisely so this can read it.
 */
function readSsoContextCookie(): string | null {
	if (typeof document === "undefined") return null;
	const match = document.cookie.match(/(?:^|;\s*)sso_context=([^;]+)/);
	if (!match) return null;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return null;
	}
}

function getSsoContext(): SsoContext | null {
	if (typeof window === "undefined") return null;
	try {
		// Prefer the cookie set atomically by the SSO callback's 302 response — guaranteed to be
		// present on the very first dashboard render after SSO. localStorage was the previous
		// storage location (set by an inline script that raced with the navigation), kept as a
		// fallback for users whose entry was written by the older HTML+script version of the
		// SSO callback before this commit.
		const fromCookie = readSsoContextCookie();
		if (fromCookie) return JSON.parse(fromCookie) as SsoContext;
		const raw = localStorage.getItem("sso_context");
		if (!raw) return null;
		return JSON.parse(raw) as SsoContext;
	} catch {
		return null;
	}
}

export function getUserRole(): string | null {
	const role = getSsoContext()?.role;
	if (!role) return null;
	const r = role.toUpperCase().replace(/[- ]/g, "_");
	if (r === "PO" || r === "PLACEMENT_OFFICER" || r === "PLACEMENT_ADMIN") return "PLACEMENT_OFFICER";
	if (r === "FACULTY" || r === "INSTRUCTOR") return "INSTRUCTOR";
	if (r === "STUDENT" || r === "LEARNER") return "LEARNER";
	return r;
}

export function getOrganisationUnits(): string[] {
	return getSsoContext()?.organisationUnits ?? [];
}

export function getTenantId(): string | null {
	return getSsoContext()?.tenantId ?? null;
}

export function getOrganisationId(): string | null {
	return getSsoContext()?.organisationId ?? null;
}

export function getEngLabsUserId(): string | null {
	return getSsoContext()?.engLabsUserId ?? null;
}
