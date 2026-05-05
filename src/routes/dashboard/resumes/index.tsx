import { Trans } from "@lingui/react/macro";
import { FileUp, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useDialogStore } from "@/dialogs/store";
import { orpc } from "@/integrations/orpc/client";
import { CreditUsageBanner } from "../-components/credit-usage-banner";
import { GridView } from "./-components/grid-view";

export const Route = createFileRoute("/dashboard/resumes/")({
	component: RouteComponent,
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
			<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div className="max-w-2xl">
					<h1 className="font-black text-3xl text-slate-900 tracking-tight">
						<Trans>Resume Portfolio</Trans>
					</h1>
					<p className="mt-1 font-medium text-slate-500 text-sm">
						<Trans>
							Manage your professional narratives. Create tailored versions for specific roles or import existing
							documents.
						</Trans>
					</p>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<Button variant="outline" size="lg" onClick={handleImport}>
						<FileUp strokeWidth={2} className="size-4" />
						<Trans>Import PDF</Trans>
					</Button>
					<Button size="lg" onClick={handleCreate}>
						<Plus strokeWidth={2.5} className="size-4" />
						<Trans>Create New Resume</Trans>
					</Button>
				</div>
			</div>

			<CreditUsageBanner />

			<GridView resumes={resumes ?? []} />
		</div>
	);
}
