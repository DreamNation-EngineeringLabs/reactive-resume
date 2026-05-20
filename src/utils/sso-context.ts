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

/**
 * Read `sso_context` from the URL hash fragment (`#sso=…`), which the SSO callback appends to the
 * post-login redirect destination. This is the dev-mode fallback: in `pnpm dev`, the Vite response
 * pipeline drops all-but-one Set-Cookie on a single response, so the `sso_context` cookie may be
 * stripped. The hash fragment rides on the navigation regardless, lets us still recover the data.
 *
 * On first read we persist it to localStorage and strip it from the URL — subsequent reads find it
 * in the cookie (prod) or localStorage (dev) and never see the hash again.
 */
function consumeSsoContextFromHash(): string | null {
	if (typeof window === "undefined") return null;
	const hash = window.location.hash;
	if (!hash || hash.length < 2) return null;
	const params = new URLSearchParams(hash.slice(1));
	const raw = params.get("sso");
	if (!raw) return null;
	try {
		const decoded = decodeURIComponent(raw);
		try {
			localStorage.setItem("sso_context", decoded);
		} catch {
			// localStorage unavailable in some sandboxed contexts — still return the value.
		}
		// Strip `sso` from the hash, leave other fragments alone.
		params.delete("sso");
		const remaining = params.toString();
		const newHash = remaining ? `#${remaining}` : "";
		const newUrl = `${window.location.pathname}${window.location.search}${newHash}`;
		window.history.replaceState(window.history.state, "", newUrl);
		return decoded;
	} catch {
		return null;
	}
}

function getSsoContext(): SsoContext | null {
	if (typeof window === "undefined") return null;
	try {
		// 1. Cookie (prod path — SSO callback set it directly).
		const fromCookie = readSsoContextCookie();
		if (fromCookie) return JSON.parse(fromCookie) as SsoContext;

		// 2. URL hash (dev path — Vite drops the cookie, so SSO callback also encodes the context
		// in `#sso=…`. First read here persists it to localStorage and cleans the URL.)
		const fromHash = consumeSsoContextFromHash();
		if (fromHash) return JSON.parse(fromHash) as SsoContext;

		// 3. localStorage (set either by the hash-consumer above, or by the older HTML+script
		// version of the SSO callback for users mid-session).
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
