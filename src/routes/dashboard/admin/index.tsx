import { t } from "@lingui/core/macro";
import { ChartBarIcon } from "@phosphor-icons/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getTenantId } from "@/utils/sso-context";
import { DashboardHeader } from "../-components/header";
import type { DashboardTab } from "../-components/section-metrics-view";
import { SectionMetricsView } from "../-components/section-metrics-view";

export const Route = createFileRoute("/dashboard/admin/")({
	component: RouteComponent,
	validateSearch: zodValidator(
		z.object({
			tab: z.enum(["overview", "students", "checklists"]).catch("overview"),
			packageId: z.string().optional(),
			unitType: z.string().optional(),
			unitId: z.string().optional(),
		}),
	),
	beforeLoad: async ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
	},
});

function RouteComponent() {
	const { tab, packageId, unitType, unitId } = Route.useSearch();
	const [tenantId, setTenantId] = useState<string>("default");

	useEffect(() => {
		setTenantId(getTenantId() ?? "default");
	}, []);

	return (
		<div className="space-y-6">
			<DashboardHeader icon={ChartBarIcon} title={t`Admin Metrics Dashboard`} />
			<SectionMetricsView
				scope="admin"
				sectionIds={[]}
				tenantId={tenantId}
				title=""
				initialTab={tab as DashboardTab}
				initialFilter={{ packageId, unitType, unitId }}
			/>
		</div>
	);
}
