import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowSquareOutIcon, TargetIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/utils/style";
import { DashboardHeader } from "../-components/header";

type Resume = RouterOutput["resume"]["list"][number];

export const Route = createFileRoute("/dashboard/ats-score/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data: resumes } = useQuery(orpc.resume.list.queryOptions({ input: { tags: [], sort: "lastUpdatedAt" } }));
	const navigate = useNavigate();

	return (
		<div className="space-y-4">
			<DashboardHeader icon={TargetIcon} title={t`ATS Score`} />
			<Separator />

			<div className="space-y-4">
				<div>
					<h3 className="mb-2 font-medium text-sm">
						<Trans>Select a resume to score</Trans>
					</h3>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{resumes?.map((resume) => (
							<ResumePickerCard
								key={resume.id}
								resume={resume}
								onSelect={() => navigate({ to: "/builder/$resumeId", params: { resumeId: resume.id }, search: { openAts: true } })}
							/>
						))}
					</div>
					{resumes?.length === 0 && (
						<p className="text-muted-foreground text-sm">
							<Trans>No resumes found. Create a resume first to use ATS scoring.</Trans>
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

type ResumePickerCardProps = {
	resume: Resume;
	onSelect: () => void;
};

function ResumePickerCard({ resume, onSelect }: ResumePickerCardProps) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"flex flex-col gap-1 rounded-lg border p-3 text-start transition-colors hover:bg-muted/50",
			)}
		>
			<div className="flex items-center justify-between">
				<h4 className="line-clamp-1 font-medium text-sm">{resume.name}</h4>
				<ArrowSquareOutIcon className="size-4 text-muted-foreground" />
			</div>
			<p className="line-clamp-1 text-muted-foreground text-xs">{resume.slug}</p>
		</button>
	);
}