import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { env } from "@/utils/env";
import { authClient } from "./client";
import { auth } from "./config";
import type { AuthSession } from "./types";

export const getSession = createIsomorphicFn()
	.client(async (): Promise<AuthSession | null> => {
		try {
			// Use explicit credentialed fetch so cookies are always attached even when
			// authClient defaults behave differently behind Firebase Hosting proxies.
			const response = await fetch("/api/auth/get-session", {
				method: "GET",
				credentials: "include",
				headers: {
					Accept: "application/json",
				},
			});

			if (!response.ok) return null;
			const data = (await response.json()) as AuthSession | null;
			return data;
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
