import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo } from "react";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";
import { dlog } from "@/utils/debug";
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
		dlog("route:admin", "beforeLoad", { hasSession: !!context.session });
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
	},
	loaderDeps: ({ search }) => ({ unitId: search.unitId }),
	// Prefetch the dashboard query on the server so SectionMetricsView's useQuery returns
	// synchronously with data already in cache — no SSR suspension, no streaming dependency.
	// Without this, useQuery suspends under `wrapQueryClient: true` and the resolved chunk
	// can fail to flush through Firebase Hosting → Cloud Run, leaving the Outlet blank.
	loader: async ({ context, deps }) => {
		const queryOpts = orpc.resume.dashboard.sections.queryOptions({
			input: { sectionIds: [], tenantId: "default", scope: "po", activeUnitId: deps.unitId },
		});
		try {
			await context.queryClient.prefetchQuery(queryOpts);
			dlog("route:admin", "loader:prefetch:ok", { unitId: deps.unitId });
		} catch (err) {
			dlog("route:admin", "loader:prefetch:failed", { error: (err as Error).message });
		}
	},
});

function RouteComponent() {
	const { tab, packageId, unitType, unitId, sectionId } = Route.useSearch();
	const initialFilter = useMemo(() => ({ packageId, unitType, unitId }), [packageId, unitType, unitId]);

	dlog("route:admin", "render", { tab, packageId, unitType, unitId, sectionId });

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
