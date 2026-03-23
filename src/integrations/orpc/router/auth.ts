import { protectedProcedure, publicProcedure } from "../context";
import { authService, type ProviderList } from "../services/auth";
import { auth } from "@/integrations/auth/config";
import type { AuthSession } from "@/integrations/auth/types";

export const authRouter = {
	session: {
		get: publicProcedure
			.route({
				method: "GET",
				path: "/auth/session",
				tags: ["Authentication"],
				operationId: "getCurrentSession",
				summary: "Get current session",
				description:
					"Returns the currently authenticated session when a valid session cookie is present, otherwise null.",
				successDescription: "The current session or null.",
			})
			.handler(async ({ context }): Promise<AuthSession | null> => {
				const headers = context.reqHeaders ?? new Headers();
				const cookieHeader = headers.get("cookie") ?? "";
				const sessionMatch = cookieHeader.match(/__Secure-better-auth\.session_token=([^;]+)/);
				const tokenPrefix = sessionMatch?.[1] ? decodeURIComponent(sessionMatch[1]).split(".")[0] : null;
				const trace = cookieHeader.match(/sso_trace=([^;]+)/)?.[1]
					? decodeURIComponent(cookieHeader.match(/sso_trace=([^;]+)/)?.[1] ?? "")
					: "none";
				console.log(`[SSOTrace:${trace}] orpc:auth/session:request`, {
					hasCookie: Boolean(cookieHeader),
					hasSessionCookie: Boolean(sessionMatch?.[1]),
					tokenPrefix,
					forwardedUrl: headers.get("x-forwarded-url"),
					host: headers.get("host"),
					forwardedHost: headers.get("x-forwarded-host"),
				});
				const result = await auth.api.getSession({ headers });
				console.log(`[SSOTrace:${trace}] orpc:auth/session:result`, {
					found: Boolean(result),
					userId: result?.user?.id ?? null,
				});
				return (result as AuthSession | null) ?? null;
			}),
	},

	providers: {
		list: publicProcedure
			.route({
				method: "GET",
				path: "/auth/providers",
				tags: ["Authentication"],
				operationId: "listAuthProviders",
				summary: "List authentication providers",
				description:
					"Returns a list of all authentication providers enabled on this Reactive Resume instance, along with their display names. Possible providers include password-based credentials, Google, GitHub, and custom OAuth. No authentication required.",
				successDescription: "A map of enabled authentication provider identifiers to their display names.",
			})
			.handler((): ProviderList => {
				return authService.providers.list();
			}),
	},

	deleteAccount: protectedProcedure
		.route({
			method: "DELETE",
			path: "/auth/account",
			tags: ["Authentication"],
			operationId: "deleteAccount",
			summary: "Delete user account",
			description:
				"Permanently deletes the authenticated user's account, including all resumes, uploaded files (profile pictures, screenshots, PDFs), and associated data. This action is irreversible. Requires authentication.",
			successDescription: "The user account and all associated data have been successfully deleted.",
		})
		.handler(async ({ context }): Promise<void> => {
			return await authService.deleteAccount({ userId: context.user.id });
		}),
};
