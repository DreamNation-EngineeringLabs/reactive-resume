import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { dlog } from "@/utils/debug";
import { getUserRole } from "@/utils/sso-context";

export const Route = createFileRoute("/dashboard/")({
	beforeLoad: () => {
		dlog("route:dashboard-index", "beforeLoad", { isServer: typeof window === "undefined" });
		// SSR: localStorage unavailable, fall back to resumes — client component overrides this
		if (typeof window === "undefined") {
			throw redirect({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] }, replace: true });
		}
	},
	component: DashboardIndex,
});

// Client-side role-based redirect — runs after localStorage is populated by SSO
function DashboardIndex() {
	const navigate = useNavigate();
	dlog("route:dashboard-index", "component:render");

	useEffect(() => {
		const role = getUserRole()?.toUpperCase();
		dlog("route:dashboard-index", "useEffect:start", { role });
		const fired = (() => {
			if (role === "INSTRUCTOR") {
				void navigate({ to: "/dashboard/faculty", search: { tab: "overview" } as any, replace: true });
				return "/dashboard/faculty";
			}
			if (role === "PLACEMENT_OFFICER") {
				void navigate({ to: "/dashboard/placement-officer", search: { tab: "overview" } as any, replace: true });
				return "/dashboard/placement-officer";
			}
			if (role === "ADMIN") {
				void navigate({ to: "/dashboard/admin", search: { tab: "overview" } as any, replace: true });
				return "/dashboard/admin";
			}
			void navigate({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] }, replace: true });
			return "/dashboard/resumes";
		})();
		dlog("route:dashboard-index", "useEffect:navigate-called", { destination: fired, role });
	}, [navigate]);

	return null;
}
