import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { client } from "@/integrations/orpc/client";
import { derror, dlog } from "@/utils/debug";
import { auth } from "./config";
import type { AuthSession } from "./types";

/**
 * Extract names of cookies present on the incoming request without leaking values to logs.
 * Returns names only (e.g. `["__Secure-better-auth.session_token", "source_url"]`), which is
 * enough to diagnose whether the auth cookie made it through any proxy in front of Cloud Run.
 */
function cookieNamesFromHeader(cookieHeader: string | undefined): string[] {
	if (!cookieHeader) return [];
	return cookieHeader
		.split(";")
		.map((c) => c.trim().split("=")[0])
		.filter(Boolean);
}

export const getSession = createIsomorphicFn()
	.client(async (): Promise<AuthSession | null> => {
		try {
			// In production behind Firebase Hosting, /api/auth/get-session requests can
			// intermittently arrive without cookies, while /api/rpc requests remain stable.
			// Fetch session through ORPC so it uses the same credentialed transport path.
			const session = await client.auth.session.get();
			dlog("auth:getSession:client", "result", {
				hasUser: !!session?.user,
				userEmail: session?.user?.email ?? null,
			});
			return session;
		} catch (err) {
			derror("auth:getSession:client", "exception", err);
			return null;
		}
	})
	.server(async (): Promise<AuthSession | null> => {
		const headers = await getRequestHeaders();
		// `getRequestHeaders()` returns a Web `Headers` object — values are accessed via `.get()`,
		// NOT property access. Without this, `cookieHeader`, `host`, etc. would all be `undefined`
		// and the dlog below would lie about what's actually on the request.
		const h = headers as Headers;
		const cookieHeader = h.get("cookie") ?? "";
		const cookieNames = cookieNamesFromHeader(cookieHeader);
		const hasBetterAuthSession = cookieNames.some((n) => n.includes("better-auth.session_token"));

		// This log answers the single diagnostic question: did the auth cookie reach Cloud Run?
		// If `hasBetterAuthSession` is false, the cookie was stripped or never sent by the browser.
		// If true but `better-auth-result` returns hasUser=false, Better Auth rejected the cookie
		// (AUTH_SECRET mismatch, session row gone, or expired).
		dlog("auth:getSession:server", "incoming-request", {
			hasCookieHeader: !!cookieHeader,
			cookieHeaderLength: cookieHeader.length,
			cookieNames,
			hasBetterAuthSession,
			host: h.get("host") ?? null,
			forwardedHost: h.get("x-forwarded-host") ?? null,
			forwardedFor: h.get("x-forwarded-for") ?? null,
			forwardedProto: h.get("x-forwarded-proto") ?? null,
		});

		try {
			const result = await auth.api.getSession({ headers });
			dlog("auth:getSession:server", "better-auth-result", {
				hasUser: !!result?.user,
				userEmail: result?.user?.email ?? null,
				sessionId: (result as { session?: { id?: string } } | null)?.session?.id ?? null,
			});
			return result as AuthSession | null;
		} catch (err) {
			derror("auth:getSession:server", "exception", err, { hasBetterAuthSession });
			return null;
		}
	});
