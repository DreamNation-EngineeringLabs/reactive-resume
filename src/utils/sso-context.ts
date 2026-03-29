interface SsoContext {
	source_url: string | null;
	role: string | null;
	engLabsUserId: string | null;
	tenantId: string | null;
	organisationId: string | null;
	organisationUnits: string[];
	trace: string | null;
}

function getSsoContext(): SsoContext | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem("sso_context");
		if (!raw) return null;
		return JSON.parse(raw) as SsoContext;
	} catch {
		return null;
	}
}

export function getUserRole(): string | null {
	return getSsoContext()?.role ?? null;
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
