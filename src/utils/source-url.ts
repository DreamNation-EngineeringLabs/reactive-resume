import { redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie, getRequestUrl } from "@tanstack/react-start/server";

const SOURCE_URL_COOKIE = "source_url";

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
 * Origin to use when sending the user back to the main (eng-labs) app — e.g. placements / Services tab.
 *
 * Order:
 * - **Client:** `VITE_MAIN_APP_URL` (when resume runs on a different port/host than main), then {@link getSourceUrl}.
 * - **Server:** `MAIN_APP_PUBLIC_URL`, then `APP_URL`, then {@link getSourceUrl} (cookie `source_url`
 *   from SSO, then request origin).
 *
 * Important: this must never degrade to a path-only value. If SSR produced `/placements` without a host,
 * TanStack Router would treat it as an in-app path and prepend the `/resume` base — leaving users inside
 * the resume app at `/resume/placements` instead of the real main app.
 */
export const getMainAppOriginForExitLinks = createIsomorphicFn()
	.client((): string => {
		const fromVite = toOrigin(import.meta.env.VITE_MAIN_APP_URL);
		if (fromVite) return fromVite;
		return getSourceUrl();
	})
	.server((): string => {
		const explicit = toOrigin(process.env.MAIN_APP_PUBLIC_URL);
		if (explicit) return explicit;
		const fromAppUrl = toOrigin(process.env.APP_URL);
		if (fromAppUrl) return fromAppUrl;
		return getSourceUrl();
	});

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
			const value = match.split("=").slice(1).join("=");
			if (value) {
				const origin = toOrigin(decodeURIComponent(value));
				if (origin) return origin;
			}
		}

		// 3. Tenant-aware fallback: same origin as the resume app
		return window.location.origin;
	})
	.server((): string => {
		// Mirror client order where possible: SSO hands off `source_url` in localStorage on the
		// client; SSR reads the same value from the cookie set on SSO (see api/auth/sso).
		try {
			const raw = getCookie(SOURCE_URL_COOKIE);
			if (raw) {
				const origin = toOrigin(decodeURIComponent(raw));
				if (origin) return origin;
			}
		} catch {
			// No request context (e.g. module init)
		}
		try {
			const url = getRequestUrl({ xForwardedHost: true, xForwardedProto: true });
			return url.origin;
		} catch {
			return toOrigin(process.env.APP_URL);
		}
	});

const PLACEMENTS_PATH = "/placements?tab=services";

/**
 * URL of the main app's placements landing page (Services tab).
 *
 * **Same host + port as the resume app:** If both run on e.g. `http://localhost:3003`, a full-page
 * navigation to `http://localhost:3003/placements` is still handled by the **resume** dev server / SPA.
 * The server falls through to the resume shell and the address bar often ends up as
 * `/resume/placements` — not the real eng-labs route. Fix by either:
 * - running the main app on a **different port** and setting `MAIN_APP_PUBLIC_URL` / `VITE_MAIN_APP_URL`, or
 * - setting `MAIN_APP_PLACEMENTS_URL` / `VITE_MAIN_APP_PLACEMENTS_URL` to a URL that actually hits the
 *   main-app server (or production), or
 * - fixing your reverse proxy so `/placements` is routed to the main app, not the resume bundle.
 *
 * Always returns an absolute `http(s)://…` URL when built from origin so `redirect({ href })` is not
 * treated as an in-app path under `/resume`.
 */
export function getPlacementsUrl(): string {
	let explicit: string | undefined;
	if (typeof window !== "undefined") {
		const v = import.meta.env.VITE_MAIN_APP_PLACEMENTS_URL;
		explicit = typeof v === "string" ? v : undefined;
	} else {
		explicit = process.env.MAIN_APP_PLACEMENTS_URL;
	}
	if (explicit?.trim() && /^https?:\/\//i.test(explicit.trim())) {
		return explicit.trim();
	}

	const origin = getMainAppOriginForExitLinks().replace(/\/$/, "");
	if (!origin || !/^https?:\/\//i.test(origin)) {
		if (typeof window !== "undefined") {
			return `${window.location.origin.replace(/\/$/, "")}${PLACEMENTS_PATH}`;
		}
		const last = toOrigin(process.env.APP_URL);
		if (last) return `${last.replace(/\/$/, "")}${PLACEMENTS_PATH}`;
		throw new Error(
			"getPlacementsUrl: could not resolve main app origin. Set MAIN_APP_PUBLIC_URL or APP_URL on the server.",
		);
	}
	return `${origin}${PLACEMENTS_PATH}`;
}

/**
 * Exit to the main app Services / placements tab with a **full document load**.
 *
 * If you only use `throw redirect({ href: getPlacementsUrl() })`, TanStack Router can still handle
 * the navigation as **in-app** when `base` is `/resume/`, and combine the path with that base — so
 * you end up on `/resume/placements?...` **inside this app** instead of leaving for the real main app.
 * `reloadDocument: true` forces a normal browser navigation to the absolute `href`.
 *
 * **Still seeing `/resume/placements` on the same port as this dev server?** That URL is then being
 * served by this app’s server (see {@link getPlacementsUrl}). Run the main app on another port and set
 * `MAIN_APP_PUBLIC_URL` / `VITE_MAIN_APP_URL`, or set `MAIN_APP_PLACEMENTS_URL`.
 */
export function redirectToPlacements(): never {
	const href = getPlacementsUrl();
	throw redirect({
		href,
		reloadDocument: true,
	});
}
