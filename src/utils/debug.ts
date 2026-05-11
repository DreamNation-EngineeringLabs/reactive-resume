/**
 * Dashboard debug logger.
 *
 * Prints structured, timestamped logs to:
 *   • stdout — when running inside SSR (Node)
 *   • browser console — when running client-side
 *
 * Activation rules (a single source wins; checked in order):
 *
 *   SERVER side:
 *     1. `process.env.VITE_FLAG_DEBUG_DASHBOARD === "true"` (runtime — set in Cloud Run env)
 *     2. `process.env.FLAG_DEBUG_DASHBOARD === "true"` (same idea, non-VITE name)
 *
 *   CLIENT side (any one of these turns it on):
 *     1. `localStorage.setItem("debug-dashboard", "true")` — set via DevTools, no rebuild needed.
 *        Persists per-origin until you `removeItem` it.
 *     2. URL param `?debug-dashboard=1` — appended to any dashboard URL for a one-off session.
 *     3. `window.__dashboardDebug = true` — set programmatically before any logging happens.
 *     4. `import.meta.env.VITE_FLAG_DEBUG_DASHBOARD === "true"` — baked at build time. Requires
 *        the env var to be present when `pnpm build` runs (Cloud Build substitution / Dockerfile
 *        build arg). Otherwise this is `undefined` in the deployed client bundle.
 *
 * Why so many sources: in deployed envs you often can't easily rebuild just to flip a debug flag.
 * The localStorage/URL paths let you turn logging on for one tab/session against a live build.
 */

function readClientFlag(): boolean {
	if (typeof window === "undefined") return false;
	try {
		// 1. localStorage (persists across reloads on the same origin)
		const fromLocal = window.localStorage.getItem("debug-dashboard");
		if (fromLocal === "true" || fromLocal === "1") return true;
		// 2. URL param (one-off, useful for sharing a debug link)
		if (window.location.search.includes("debug-dashboard=1") || window.location.search.includes("debug-dashboard=true")) {
			return true;
		}
		// 3. Programmatic toggle
		if ((window as unknown as { __dashboardDebug?: boolean }).__dashboardDebug === true) return true;
	} catch {
		// localStorage may throw in some sandboxed contexts; treat as not enabled.
	}
	return false;
}

function readBuildTimeFlag(): boolean {
	const viteVal = (import.meta as { env?: Record<string, unknown> }).env?.VITE_FLAG_DEBUG_DASHBOARD;
	if (viteVal === "true" || viteVal === true) return true;
	if (typeof process !== "undefined" && process.env) {
		if (process.env.VITE_FLAG_DEBUG_DASHBOARD === "true") return true;
		if (process.env.FLAG_DEBUG_DASHBOARD === "true") return true;
	}
	return false;
}

const isServer = typeof window === "undefined";
const side = isServer ? "ssr" : "client";

// SSR's enabled-state is fixed at module load (process.env is stable for the lifetime of the process).
// CLIENT's enabled-state is re-checked on each log call so that toggling localStorage / URL param
// during a session takes effect immediately without a page reload.
const SERVER_ENABLED = isServer ? readBuildTimeFlag() : false;

function isEnabled(): boolean {
	if (isServer) return SERVER_ENABLED;
	return readClientFlag() || readBuildTimeFlag();
}

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
	return isEnabled();
}

export function dlog(category: string, message: string, payload?: unknown): void {
	if (!isEnabled()) return;
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
	if (!isEnabled()) return;
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
