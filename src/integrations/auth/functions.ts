import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { client } from "@/integrations/orpc/client";
import { auth } from "./config";
import type { AuthSession } from "./types";

export const getSession = createIsomorphicFn()
	.client(async (): Promise<AuthSession | null> => {
		try {
			// In production behind Firebase Hosting, /api/auth/get-session requests can
			// intermittently arrive without cookies, while /api/rpc requests remain stable.
			// Fetch session through ORPC so it uses the same credentialed transport path.
			const session = await client.auth.session.get();
			return session;
		} catch {
			return null;
		}
	})
	.server(async (): Promise<AuthSession | null> => {
		const headers = await getRequestHeaders();
		try {
			const result = await auth.api.getSession({ headers });
			return result as AuthSession | null;
		} catch {
			return null;
		}
	});
