import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { client } from "@/integrations/orpc/client";
import { env } from "@/utils/env";
import { auth } from "./config";
import type { AuthSession } from "./types";

export const getSession = createIsomorphicFn()
	.client(async (): Promise<AuthSession | null> => {
		try {
			// In production behind Firebase Hosting, /api/auth/get-session requests can
			// intermittently arrive without cookies, while /api/rpc requests remain stable.
			// Fetch session through ORPC so it uses the same credentialed transport path.
			return await client.auth.session.get();
		} catch {
			return null;
		}
	})
	.server(async (): Promise<AuthSession | null> => {
		const headers = await getRequestHeaders();
		try {
			console.log("[AuthDebug] Request Headers (Raw):", Object.fromEntries(headers.entries()));
			console.log("[AuthDebug] Host Header:", headers.get("host"));
			console.log("[AuthDebug] X-Forwarded-Host:", headers.get("x-forwarded-host"));
			console.log("[AuthDebug] APP_URL Env:", env.APP_URL);
			console.log("[AuthDebug] TRUSTED_ORIGINS Env:", env.TRUSTED_ORIGINS);

			const result = await auth.api.getSession({ headers });
			console.log("[AuthDebug] Session Result:", result ? "Found" : "Null");

			return result as AuthSession | null;
		} catch (e) {
			console.error("[AuthDebug] Session Error:", e);
			return null;
		}
	});
