import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo } from "react";
import { z } from "zod";
import type { DashboardTab } from "../-components/section-metrics-view";
import { SectionMetricsView } from "../-components/section-metrics-view";

export const Route = createFileRoute("/dashboard/admin/")({
	component: RouteComponent,
	validateSearch: zodValidator(
		z.object({
			tab: z.enum(["overview", "sections", "students", "checklists"]).catch("overview"),
			packageId: z.string().optional(),
			unitType: z.string().optional(),
			unitId: z.string().optional(),
			sectionId: z.string().optional(),
		}),
	),
	beforeLoad: async ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
	},
});

function RouteComponent() {
	const { tab, packageId, unitType, unitId, sectionId } = Route.useSearch();
	const initialFilter = useMemo(() => ({ packageId, unitType, unitId }), [packageId, unitType, unitId]);

	// tenantId is intentionally hardcoded as "default". The orpc handler resolves the real tenantId
	// from the authenticated user's eng-labs profile (dashboard.ts L299-300), so reading it from
	// localStorage on the client just causes a key-mismatch refetch after hydration — which under
	// real network latency (Cloud Run + Firebase Hosting streaming SSR) leaves the page blank
	// until the user clicks something to force a re-render.
	return (
		<SectionMetricsView
			scope="admin"
			sectionIds={[]}
			tenantId="default"
			initialTab={tab as DashboardTab}
			initialFilter={initialFilter}
			sectionId={sectionId}
		/>
	);
}
