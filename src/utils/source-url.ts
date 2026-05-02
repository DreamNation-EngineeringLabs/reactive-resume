import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

/**
 * Strips a URL down to its origin (scheme + host + port), discarding any path/query.
 * Returns empty string if the input isn't a valid absolute URL.
 */
function toOrigin(value: string | null | undefined): string {
	if (!value) return "";
	try {
		return new URL(value).origin;
	} catch {
		return "";
	}
}

/**
 * Returns the origin of the main app the user came from — scheme + host + port only.
 * Never includes a path (so we don't accidentally produce `/resume/placements`).
 *
 * Tenant-aware: prefers the source URL captured during SSO; otherwise falls back to
 * the current request/page origin so the redirect stays on the right tenant subdomain.
 */
export const getSourceUrl = createIsomorphicFn()
	.client((): string => {
		// 1. SSO context written by /api/auth/sso during the handoff
		try {
			const raw = localStorage.getItem("sso_context");
			if (raw) {
				const ctx = JSON.parse(raw);
				const origin = toOrigin(ctx?.source_url);
				if (origin) return origin;
			}
		} catch {
			// fall through
		}

		// 2. Legacy cookie fallback
		const match = document.cookie.split("; ").find((row) => row.startsWith("source_url="));
		if (match) {
			const origin = toOrigin(decodeURIComponent(match.split("=")[1]!));
			if (origin) return origin;
		}

		// 3. Tenant-aware fallback: same origin as the resume app
		return window.location.origin;
	})
	.server((): string => {
		// Tenant-aware: derive the origin from the incoming request so SSR redirects
		// (e.g. dashboard route guard) target the right tenant subdomain.
		try {
			const url = getRequestUrl({ xForwardedHost: true, xForwardedProto: true });
			return url.origin;
		} catch {
			// Last resort: APP_URL env var so we always have a full URL in server-side
			// redirects (a relative path would get the resume basepath prepended).
			return toOrigin(process.env.APP_URL);
		}
	});

/**
 * URL of the main app's placements landing page (Services tab).
 * Always returns an absolute URL with origin — never a relative path — so
 * TanStack Router's `redirect({ href })` won't prepend the `/resume` basepath.
 */
export function getPlacementsUrl(): string {
	return `${getSourceUrl()}/placements?tab=services`;
}
