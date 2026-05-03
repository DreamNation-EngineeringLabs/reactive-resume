import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getOrganisationUnits, getTenantId } from "@/utils/sso-context";
import type { DashboardTab } from "../-components/section-metrics-view";
import { SectionMetricsView } from "../-components/section-metrics-view";

export const Route = createFileRoute("/dashboard/faculty/")({
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
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
	},
});

function RouteComponent() {
	const { tab, packageId, unitType, unitId, sectionId } = Route.useSearch();
	const [orgUnits, setOrgUnits] = useState<string[]>([]);
	const [tenantId, setTenantId] = useState<string>("default");

	useEffect(() => {
		setOrgUnits(getOrganisationUnits() ?? []);
		setTenantId(getTenantId() ?? "default");
	}, []);

	const initialFilter = useMemo(() => ({ packageId, unitType, unitId }), [packageId, unitType, unitId]);

	return (
		<SectionMetricsView
			scope="faculty"
			sectionIds={orgUnits}
			tenantId={tenantId}
			initialTab={tab as DashboardTab}
			initialFilter={initialFilter}
			sectionId={sectionId}
		/>
	);
}
