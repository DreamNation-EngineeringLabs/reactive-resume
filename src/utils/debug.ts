/**
 * Dashboard debug logger.
 *
 * Prints structured, timestamped logs to:
 *   • stdout — when running inside SSR (Node)
 *   • browser console — when running client-side
 *
 * Gated on `VITE_FLAG_DEBUG_DASHBOARD=true` in `.env`. Vite inlines the value at build time on the
 * client; on the server we read the same key from `process.env` (Vite still defines it there).
 *
 * Use it like:
 *   dlog("ssr:dashboard", "before-load:start", { hasSession: !!session });
 *
 * The `category` string is free-form; we conventionally use `<side>:<area>` so logs can be filtered
 * with a single grep (e.g. `grep "\[dashboard.*handler"`).
 */

const ENABLED: boolean = (() => {
	// On the server we may not have import.meta.env populated for VITE_ vars in all entry points,
	// so fall through to process.env. Either source is fine — Vite writes both.
	const viteVal = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_FLAG_DEBUG_DASHBOARD;
	if (viteVal !== undefined) return viteVal === "true" || viteVal === true.toString();
	if (typeof process !== "undefined" && process.env) {
		return process.env.VITE_FLAG_DEBUG_DASHBOARD === "true";
	}
	return false;
})();

const isServer = typeof window === "undefined";
const side = isServer ? "ssr" : "client";

/** Cheap, allocation-light timestamp prefix. ISO so it sorts and grep-merges cleanly. */
function ts(): string {
	return new Date().toISOString();
}

/** Truncate large arrays / strings in logs so we don't blow up stdout. */
function safe(value: unknown, depth = 0): unknown {
	if (depth > 4) return "[depth-cut]";
	if (value === null || value === undefined) return value;
	if (Array.isArray(value)) {
		if (value.length > 10) {
			return [...value.slice(0, 10).map((v) => safe(v, depth + 1)), `…(+${value.length - 10})`];
		}
		return value.map((v) => safe(v, depth + 1));
	}
	if (typeof value === "string") {
		return value.length > 500 ? `${value.slice(0, 500)}…(+${value.length - 500} chars)` : value;
	}
	if (value instanceof Error) {
		return { name: value.name, message: value.message, stack: value.stack?.split("\n").slice(0, 6).join("\n") };
	}
	if (typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = safe(v, depth + 1);
		}
		return out;
	}
	return value;
}

export function isDashboardDebugEnabled(): boolean {
	return ENABLED;
}

export function dlog(category: string, message: string, payload?: unknown): void {
	if (!ENABLED) return;
	const tag = `[dashboard:${side}:${category}] ${ts()} ${message}`;
	if (payload === undefined) {
		// biome-ignore lint/suspicious/noConsole: intentional debug logger
		console.log(tag);
	} else {
		// biome-ignore lint/suspicious/noConsole: intentional debug logger
		console.log(tag, safe(payload));
	}
}

export function derror(category: string, message: string, error: unknown, payload?: unknown): void {
	if (!ENABLED) return;
	const tag = `[dashboard:${side}:${category}] ${ts()} ERROR ${message}`;
	if (payload === undefined) {
		// biome-ignore lint/suspicious/noConsole: intentional debug logger
		console.error(tag, safe(error));
	} else {
		// biome-ignore lint/suspicious/noConsole: intentional debug logger
		console.error(tag, safe(error), safe(payload));
	}
}

/** Convenience helper: log only when value is true (boolean assertions / guards). */
export function dlogIf(condition: boolean, category: string, message: string, payload?: unknown): void {
	if (condition) dlog(category, message, payload);
}
