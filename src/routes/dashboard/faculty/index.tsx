import { t } from "@lingui/core/macro";
import { ClipboardTextIcon } from "@phosphor-icons/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getOrganisationUnits, getTenantId } from "@/utils/sso-context";
import { DashboardHeader } from "../-components/header";
import type { DashboardTab } from "../-components/section-metrics-view";
import { SectionMetricsView } from "../-components/section-metrics-view";

export const Route = createFileRoute("/dashboard/faculty/")({
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
	const [orgUnits, setOrgUnits] = useState<string[]>([]);
	const [tenantId, setTenantId] = useState<string>("default");

	useEffect(() => {
		setOrgUnits(getOrganisationUnits() ?? []);
		setTenantId(getTenantId() ?? "default");
	}, []);

	return (
		<div className="space-y-6">
			<DashboardHeader icon={ClipboardTextIcon} title={t`Faculty Review Dashboard`} />
			<SectionMetricsView
				scope="faculty"
				sectionIds={orgUnits}
				tenantId={tenantId}
				title=""
				initialTab={tab as DashboardTab}
				initialFilter={{ packageId, unitType, unitId }}
			/>
		</div>
	);
}
