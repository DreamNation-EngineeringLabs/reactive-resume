import { scryptSync } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { auth } from "@/integrations/auth/config";
import { env } from "@/utils/env";

async function handler({ request }: { request: Request }) {
	const url = new URL(request.url);
	const token = url.searchParams.get("token");
	const traceId = url.searchParams.get("trace") ?? `sso-${Date.now().toString(36)}`;
	const log = (step: string, extra?: Record<string, unknown>) => {
		console.log(`[SSOTrace:${traceId}] ${step}`, extra ?? {});
	};

	const errorRedirect = (error: string) => {
		log("redirect:error", { error });
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/auth/login?error=${error}&trace=${encodeURIComponent(traceId)}`,
			},
		});
	};

	log("entry", {
		hasToken: Boolean(token),
		host: request.headers.get("host"),
		forwardedHost: request.headers.get("x-forwarded-host"),
		forwardedProto: request.headers.get("x-forwarded-proto"),
		referer: request.headers.get("referer"),
	});

	if (!token) {
		return errorRedirect("missing_token");
	}

	try {
		const secret = env.AUTH_SECRET;
		if (!secret) {
			console.error("Missing MAIN_APP_SECRET or AUTH_SECRET");
			return errorRedirect("server_configuration");
		}

		const decoded = jwt.verify(token, secret) as {
			email: string;
			name: string;
			username: string;
			userId: string;
			source_url?: string;
		};
		log("token:verified", {
			email: decoded.email,
			hasSourceUrl: Boolean(decoded.source_url),
		});

		if (!decoded.email) {
			return errorRedirect("invalid_token_payload");
		}

		// Generate deterministic password (32 bytes -> 64 hex chars, fitting maxPasswordLength: 64)
		const password = scryptSync(decoded.email, secret, 32).toString("hex");

		// Try to sign in
		let response = await auth.api.signInEmail({
			body: {
				email: decoded.email,
				password,
			},
			asResponse: true,
		});
		log("signin:attempt", { ok: response.ok, status: response.status });

		// If sign in fails, try to sign up
		if (!response.ok) {
			response = await auth.api.signUpEmail({
				body: {
					email: decoded.email,
					password,
					name: decoded.name,
					username: decoded.username || decoded.email.split("@")[0],
				},
				asResponse: true,
			});
			log("signup:fallback", { ok: response.ok, status: response.status });
		}

		if (!response.ok) {
			console.error("Failed to sign in/up user via SSO", await response.text());
			return errorRedirect("sso_failed");
		}

		// Forward the Set-Cookie headers
		const headers = new Headers();
		response.headers.forEach((value, key) => {
			if (key.toLowerCase() === "set-cookie") {
				headers.append(key, value);
			}
		});

		// Set source_url cookie so frontend can redirect back to correct tenant dashboard
		if (decoded.source_url) {
			headers.append(
				"Set-Cookie",
				`source_url=${encodeURIComponent(decoded.source_url)}; Path=/; SameSite=Lax; Max-Age=86400`,
			);
		}
		headers.append("Set-Cookie", `sso_trace=${encodeURIComponent(traceId)}; Path=/; SameSite=Lax; Max-Age=1800`);

		// Redirect to dashboard
		headers.set("Location", "/dashboard");
		log("redirect:dashboard", { location: "/dashboard" });
		return new Response(null, {
			status: 302,
			headers,
		});
	} catch (e) {
		console.error(`[SSOTrace:${traceId}] token:verify_failed`, e);
		return errorRedirect("invalid_token");
	}
}

export const Route = createFileRoute("/api/auth/sso")({
	server: {
		handlers: {
			GET: handler,
		},
	},
});
