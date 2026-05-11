import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo } from "react";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";
import { dlog } from "@/utils/debug";
import type { DashboardTab } from "../-components/section-metrics-view";
import { SectionMetricsView } from "../-components/section-metrics-view";

export const Route = createFileRoute("/dashboard/placement-officer/")({
	component: RouteComponent,
	validateSearch: zodValidator(
		z.object({
			tab: z.enum(["overview", "inbox", "sections", "students", "checklists"]).catch("overview"),
			packageId: z.string().optional(),
			unitType: z.string().optional(),
			unitId: z.string().optional(),
			sectionId: z.string().optional(),
		}),
	),
	beforeLoad: async ({ context }) => {
		dlog("route:placement-officer", "beforeLoad", { hasSession: !!context.session });
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
	},
	loaderDeps: ({ search }) => ({ unitId: search.unitId }),
	// See admin/index.tsx — prefetch on the server to avoid SSR suspension on useQuery.
	loader: async ({ context, deps }) => {
		const queryOpts = orpc.resume.dashboard.sections.queryOptions({
			input: { sectionIds: [], tenantId: "default", scope: "po", activeUnitId: deps.unitId },
		});
		try {
			await context.queryClient.prefetchQuery(queryOpts);
			dlog("route:placement-officer", "loader:prefetch:ok", { unitId: deps.unitId });
		} catch (err) {
			dlog("route:placement-officer", "loader:prefetch:failed", { error: (err as Error).message });
		}
	},
});

function RouteComponent() {
	const { tab, packageId, unitType, unitId, sectionId } = Route.useSearch();
	const initialFilter = useMemo(() => ({ packageId, unitType, unitId }), [packageId, unitType, unitId]);

	dlog("route:placement-officer", "render", { tab, packageId, unitType, unitId, sectionId });

	// See admin/index.tsx — tenantId is server-resolved from auth; client value would just trigger
	// a refetch on mount that blanks the page under deployed-env latency.
	return (
		<SectionMetricsView
			scope="po"
			sectionIds={[]}
			tenantId="default"
			initialTab={tab as DashboardTab}
			initialFilter={initialFilter}
			sectionId={sectionId}
		/>
	);
}
