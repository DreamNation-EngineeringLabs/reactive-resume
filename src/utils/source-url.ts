import { env } from "./env";

export function getSourceUrl(): string {
	if (typeof window !== "undefined") {
		// Try sso_context from localStorage
		try {
			const raw = localStorage.getItem("sso_context");
			if (raw) {
				const ctx = JSON.parse(raw);
				if (ctx.source_url) return ctx.source_url;
			}
		} catch {
			// fall through
		}

		// Legacy: try source_url cookie
		if (typeof document !== "undefined") {
			const match = document.cookie.split("; ").find((row) => row.startsWith("source_url="));
			if (match) {
				return decodeURIComponent(match.split("=")[1]!);
			}
		}
	}
	return env.VITE_MAIN_APP_URL ?? "http://localhost:3000";
}
