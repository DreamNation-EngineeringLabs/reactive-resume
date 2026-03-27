import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CircleNotchIcon, FileTextIcon, TargetIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { DashboardHeader } from "../-components/header";
import { MiniResumePreview } from "../resumes/-components/cards/mini-resume-preview";

type Resume = RouterOutput["resume"]["list"][number];

export const Route = createFileRoute("/dashboard/ats-score/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data: resumes } = useQuery(orpc.resume.list.queryOptions({ input: { tags: [], sort: "lastUpdatedAt" } }));
	const navigate = useNavigate();

	return (
		<div className="space-y-8">
			<DashboardHeader icon={TargetIcon} title={t`ATS Score`} />

			<div className="space-y-4">
				<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
					<Trans>Select a resume to score</Trans>
				</p>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{resumes?.map((resume) => (
						<ResumePickerCard
							key={resume.id}
							resume={resume}
							onSelect={() =>
								navigate({ to: "/builder/$resumeId", params: { resumeId: resume.id }, search: { openAts: true } })
							}
						/>
					))}
				</div>
				{resumes?.length === 0 && (
					<div className="rounded-2xl bg-white p-10 text-center shadow-sm">
						<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
							<FileTextIcon weight="duotone" className="size-7" />
						</div>
						<p className="font-medium text-slate-500">
							<Trans>No resumes found. Create a resume first to use ATS scoring.</Trans>
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

const templateColors: Record<string, { header: string; accent: string }> = {
	azurill: { header: "bg-blue-600", accent: "text-blue-600" },
	bronzor: { header: "bg-slate-600", accent: "text-slate-600" },
	chikorita: { header: "bg-green-600", accent: "text-green-600" },
	ditgar: { header: "bg-purple-600", accent: "text-purple-600" },
	ditto: { header: "bg-pink-600", accent: "text-pink-600" },
	gengar: { header: "bg-indigo-600", accent: "text-indigo-600" },
	glalie: { header: "bg-cyan-600", accent: "text-cyan-600" },
	kakuna: { header: "bg-yellow-600", accent: "text-yellow-600" },
	lapras: { header: "bg-blue-500", accent: "text-blue-500" },
	leafish: { header: "bg-emerald-600", accent: "text-emerald-600" },
	onyx: { header: "bg-slate-700", accent: "text-slate-700" },
	pikachu: { header: "bg-amber-500", accent: "text-amber-500" },
	rhyhorn: { header: "bg-orange-600", accent: "text-orange-600" },
};

type ResumePickerCardProps = {
	resume: Resume;
	onSelect: () => void;
};

function ResumePickerCard({ resume, onSelect }: ResumePickerCardProps) {
	const { data: screenshotData, isLoading } = useQuery(
		orpc.printer.getResumeScreenshot.queryOptions({ input: { id: resume.id } }),
	);

	const template = resume.data?.metadata?.template ?? "onyx";
	const templateColor = templateColors[template] || templateColors.onyx;

	return (
		<button
			type="button"
			onClick={onSelect}
			className="group flex flex-col overflow-hidden rounded-2xl bg-white text-start shadow-sm transition-all hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
		>
			{/* Preview thumbnail */}
			<div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-50">
				{isLoading && (
					<div className="relative size-full">
						<div className="flex size-full flex-col">
							<MiniResumePreview resume={resume} />
						</div>
						<div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm">
							<CircleNotchIcon weight="thin" className="size-10 animate-spin text-slate-400" />
						</div>
					</div>
				)}
				{!isLoading && screenshotData?.url && (
					<img
						src={screenshotData.url}
						alt={resume.name}
						className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
					/>
				)}
				{!isLoading && !screenshotData?.url && (
					<div className="size-full overflow-hidden">
						<MiniResumePreview resume={resume} />
					</div>
				)}

				{/* Hover overlay with CTA */}
				<div className="absolute inset-0 flex items-center justify-center bg-emerald-900/0 opacity-0 transition-all duration-200 group-hover:bg-emerald-900/30 group-hover:opacity-100">
					<div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-lg">
						<TargetIcon weight="duotone" className="size-4 text-emerald-600" />
						<span className="text-sm font-semibold text-slate-900">
							<Trans>Analyze</Trans>
						</span>
					</div>
				</div>
			</div>

			{/* Card footer */}
			<div className={cn("border-t border-slate-100 px-4 py-3")}>
				<p className="truncate text-slate-400 text-xs">{resume.slug}</p>
			</div>
		</button>
	);
}
