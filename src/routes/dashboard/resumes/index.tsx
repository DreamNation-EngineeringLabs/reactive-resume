import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { FilesIcon } from "@phosphor-icons/react";
import { FileUp, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useDialogStore } from "@/dialogs/store";
import { orpc } from "@/integrations/orpc/client";
import { CreditUsageBanner } from "../-components/credit-usage-banner";
import { DashboardHeader } from "../-components/header";
import { GridView } from "./-components/grid-view";

export const Route = createFileRoute("/dashboard/resumes/")({
	component: RouteComponent,
	// Prefetch the resume list on the server so useQuery returns synchronously with data already
	// in cache — no SSR suspension, no streaming-chunk-flush dependency. Failures fall through
	// silently to the existing `resumes ?? []` handling in the component.
	loader: async ({ context }) => {
		try {
			await context.queryClient.prefetchQuery(
				orpc.resume.list.queryOptions({ input: { tags: [], sort: "lastUpdatedAt" } }),
			);
		} catch {
			// non-fatal
		}
	},
});

function RouteComponent() {
	const { openDialog } = useDialogStore();
	const { data: resumes } = useQuery(
		orpc.resume.list.queryOptions({ input: { tags: [], sort: "lastUpdatedAt" } }),
	);

	const handleImport = () => openDialog("resume.import", undefined);
	const handleCreate = () => openDialog("resume.create", undefined);

	return (
		<div className="space-y-6">
			<DashboardHeader
				icon={FilesIcon}
				title={t`Resume Portfolio`}
				description={t`One resume per kind of role you're applying for. Duplicate one to tailor it.`}
			>
				<Button variant="outline" size="lg" onClick={handleImport}>
					<FileUp strokeWidth={2} className="size-4" />
					<Trans>Import PDF</Trans>
				</Button>
				<Button size="lg" onClick={handleCreate}>
					<Plus strokeWidth={2.5} className="size-4" />
					<Trans>Create New Resume</Trans>
				</Button>
			</DashboardHeader>

			<CreditUsageBanner />

			<GridView resumes={resumes ?? []} />
		</div>
	);
}
