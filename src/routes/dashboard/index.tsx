import { createFileRoute, redirect } from "@tanstack/react-router";
import { dlog } from "@/utils/debug";
import { getUserRole } from "@/utils/sso-context";

/**
 * Index route for `/dashboard`. Its sole purpose is to redirect to the role-specific dashboard.
 *
 * The redirect MUST happen in `beforeLoad` (atomic with route resolution), not in a `useEffect +
 * navigate()` chain inside the rendered component. Reasons we learned the hard way:
 *
 *   1. `useEffect + navigate()` is async and can be canceled by concurrent `router.invalidate()`
 *      calls. Locally this finishes in <10ms so cancellation never wins; in deployed (Firebase
 *      Hosting → Cloud Run with ~300ms orpc round-trips), the dashboard parent route re-invalidates
 *      multiple times before the navigate completes, canceling it every cycle. The user stays
 *      stuck at `/dashboard` with an empty Outlet forever.
 *
 *   2. `throw redirect()` inside `beforeLoad` is part of route resolution itself. The router
 *      processes the throw before any component mounts, so there's no race for an invalidation
 *      to cancel.
 *
 * The previous version was the canonical "client-side redirect" anti-pattern: it works under zero
 * latency, breaks under real latency. Diagnostic logs (commit history) showed `useEffect:navigate-
 * called` firing exactly once but `[dashboard:client:route:admin]` never firing — proof the
 * navigate was being canceled mid-flight.
 */
export const Route = createFileRoute("/dashboard/")({
	beforeLoad: () => {
		const isServer = typeof window === "undefined";
		dlog("route:dashboard-index", "beforeLoad", { isServer });

		// SSR: localStorage isn't available, so we can't read the role. Fall back to /dashboard/resumes;
		// once the client hydrates and we re-run beforeLoad with localStorage available, the role-based
		// branch below will pick the right destination.
		if (isServer) {
			throw redirect({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] }, replace: true });
		}

		const role = getUserRole()?.toUpperCase();
		dlog("route:dashboard-index", "beforeLoad:role-resolved", { role });

		if (role === "INSTRUCTOR") {
			throw redirect({ to: "/dashboard/faculty", search: { tab: "overview" } as never, replace: true });
		}
		if (role === "PLACEMENT_OFFICER") {
			throw redirect({ to: "/dashboard/placement-officer", search: { tab: "overview" } as never, replace: true });
		}
		if (role === "ADMIN") {
			throw redirect({ to: "/dashboard/admin", search: { tab: "overview" } as never, replace: true });
		}
		// Default: students or roles without a dedicated dashboard land on the resumes list.
		throw redirect({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] }, replace: true });
	},
	// `component` intentionally omitted — beforeLoad always throws a redirect, so nothing ever
	// renders for this route.
});
