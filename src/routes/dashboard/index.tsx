import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getUserRole } from "@/utils/sso-context";

export const Route = createFileRoute("/dashboard/")({
	beforeLoad: () => {
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

	useEffect(() => {
		const role = getUserRole()?.toUpperCase();
		if (role === "INSTRUCTOR") {
			void navigate({ to: "/dashboard/faculty", search: { tab: "overview" } as any, replace: true });
		} else if (role === "PLACEMENT_OFFICER") {
			void navigate({ to: "/dashboard/placement-officer", search: { tab: "overview" } as any, replace: true });
		} else if (role === "ADMIN") {
			void navigate({ to: "/dashboard/admin", search: { tab: "overview" } as any, replace: true });
		} else {
			void navigate({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] }, replace: true });
		}
	}, [navigate]);

	return null;
}
