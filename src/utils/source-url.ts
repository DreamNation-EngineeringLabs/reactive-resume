import { env } from "./env";

/**
 * Get the source URL (dashboard origin) from the cookie set during SSO.
 * Falls back to VITE_MAIN_APP_URL env var or localhost.
 *
 * This allows the resume app (shared resource) to redirect back
 * to the correct tenant subdomain that the user came from.
 */
export function getSourceUrl(): string {
	if (typeof document !== "undefined") {
		console.log("[getSourceUrl] document.cookie:", document.cookie);
		const match = document.cookie.split("; ").find((row) => row.startsWith("source_url="));
		console.log("[getSourceUrl] cookie match:", match);
		if (match) {
			const value = decodeURIComponent(match.split("=")[1]!);
			console.log("[getSourceUrl] decoded value:", value);
			return value;
		}
	} else {
		console.log("[getSourceUrl] document is undefined (SSR)");
	}
	const fallback = env.VITE_MAIN_APP_URL ?? "http://localhost:3000";
	console.log("[getSourceUrl] using fallback:", fallback);
	return fallback;
}
