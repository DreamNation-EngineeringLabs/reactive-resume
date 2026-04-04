import {
	apiKeyClient,
	genericOAuthClient,
	inferAdditionalFields,
	twoFactorClient,
	usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./config";

const getAuthClient = () => {
	return createAuthClient({
		// Match ORPC client: always send cookies on auth API calls (get-session, sign-in, etc.).
		// Without this, some environments (e.g. behind Firebase Hosting → Cloud Run) can send
		// cookies on fetch calls that set credentials explicitly (flags/get) but omit them on
		// Better Auth's internal get-session request → session stays null in router context.
		basePath: "/resume/api/auth",
		fetchOptions: {
			credentials: "include",
		},
		plugins: [
			apiKeyClient(),
			usernameClient(),
			twoFactorClient({
				onTwoFactorRedirect() {
					// Redirect to 2FA verification page
					if (typeof window !== "undefined") {
						window.location.href = "/resume/auth/verify-2fa";
					}
				},
			}),
			genericOAuthClient(),
			inferAdditionalFields<typeof auth>(),
		],
	});
};

export const authClient = getAuthClient();
