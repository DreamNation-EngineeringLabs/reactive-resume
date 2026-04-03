import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { FileTextIcon, TargetIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { BaseCard } from "../resumes/-components/cards/base-card";
import { DashboardHeader } from "../-components/header";

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
				<p className="font-semibold text-slate-400 text-xs uppercase tracking-widest">
					<Trans>Select a resume to score</Trans>
				</p>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{resumes?.map((resume) => (
						<ResumePickerCard
							key={resume.id}
							resume={resume}
							onSelect={() => navigate({ to: "/dashboard/ats-score/$resumeId", params: { resumeId: resume.id } })}
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

const PALETTES = [
	{ bg: "bg-blue-50/50", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
	{ bg: "bg-indigo-50/50", iconBg: "bg-indigo-100", iconColor: "text-indigo-600" },
	{ bg: "bg-violet-50/50", iconBg: "bg-violet-100", iconColor: "text-violet-600" },
	{ bg: "bg-emerald-50/50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
	{ bg: "bg-rose-50/50", iconBg: "bg-rose-100", iconColor: "text-rose-600" },
	{ bg: "bg-amber-50/50", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
] as const;

function getPalette(id: string) {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) & 0xffff_ffff;
	}
	return PALETTES[Math.abs(hash) % PALETTES.length]!;
}

type ResumePickerCardProps = {
	resume: Resume;
	onSelect: () => void;
};

function ResumePickerCard({ resume, onSelect }: ResumePickerCardProps) {
	const { i18n } = useLingui();
	const palette = getPalette(resume.id);

	const updatedAt = useMemo(
		() => Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(resume.updatedAt),
		[i18n.locale, resume.updatedAt],
	);

	const tags: string[] = [];
	if (resume.isPrimary) tags.push("Master");
	if (resume.isLocked) tags.push("Locked");

	return (
		<button type="button" onClick={onSelect} className="h-full w-full cursor-pointer text-start">
			<BaseCard
				title={resume.name}
				description={t`Last updated on ${updatedAt}`}
				tags={tags}
				customBg={palette.bg}
				className="h-full"
			>
				{/* Icon container */}
				<div className="flex size-full flex-col items-center justify-center p-6">
					<div
						className={cn(
							"mb-6 flex size-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:rotate-6 group-hover:bg-primary group-hover:text-white",
							palette.iconBg,
							palette.iconColor,
						)}
					>
						<TargetIcon weight="duotone" className="size-8" />
					</div>

					{/* Hover CTA */}
					<div className="mt-2 flex translate-y-2 items-center font-bold text-[10px] text-primary uppercase tracking-widest opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
						<Trans>Analyze →</Trans>
					</div>
				</div>

				{/* Background decoration */}
				<TargetIcon
					weight="duotone"
					className={cn(
						"absolute -right-10 -bottom-10 size-52 rotate-12 transition-transform duration-700 group-hover:rotate-0 group-hover:scale-110 opacity-5",
						palette.iconColor,
					)}
				/>
			</BaseCard>
		</button>
	);
}
