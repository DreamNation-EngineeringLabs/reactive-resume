import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { FileTextIcon, LockSimpleIcon, StarIcon, TargetIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";
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
							onSelect={() =>
								navigate({ to: "/dashboard/ats-score/$resumeId", params: { resumeId: resume.id } })
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

const PALETTES = [
	{ header: "bg-slate-800", body: "bg-slate-50", name: "text-slate-800", tag: "bg-white/20 text-white" },
	{ header: "bg-indigo-700", body: "bg-indigo-50", name: "text-indigo-900", tag: "bg-white/20 text-white" },
	{ header: "bg-emerald-700", body: "bg-emerald-50", name: "text-emerald-900", tag: "bg-white/20 text-white" },
	{ header: "bg-rose-700", body: "bg-rose-50", name: "text-rose-900", tag: "bg-white/20 text-white" },
	{ header: "bg-amber-600", body: "bg-amber-50", name: "text-amber-900", tag: "bg-white/20 text-white" },
	{ header: "bg-cyan-700", body: "bg-cyan-50", name: "text-cyan-900", tag: "bg-white/20 text-white" },
	{ header: "bg-violet-700", body: "bg-violet-50", name: "text-violet-900", tag: "bg-white/20 text-white" },
	{ header: "bg-sky-700", body: "bg-sky-50", name: "text-sky-900", tag: "bg-white/20 text-white" },
	{ header: "bg-teal-700", body: "bg-teal-50", name: "text-teal-900", tag: "bg-white/20 text-white" },
	{ header: "bg-pink-700", body: "bg-pink-50", name: "text-pink-900", tag: "bg-white/20 text-white" },
] as const;

function getPalette(id: string) {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = ((hash * 31) + id.charCodeAt(i)) & 0xffff_ffff;
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

	return (
		<button
			type="button"
			onClick={onSelect}
			className="group flex w-full flex-col overflow-hidden rounded-2xl text-start shadow-sm transition-all hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
		>
			{/* Main area: aspect-[3/4] to match resume card height */}
			<div className="relative aspect-[3/4] w-full flex-1">
				{/* Top 15%: coloured header band */}
				<div className={cn("absolute inset-x-0 top-0 flex h-[15%] items-start justify-end p-3", palette.header)}>
					<div className="flex flex-wrap items-center gap-1.5">
						{resume.isPrimary && (
							<span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest", palette.tag)}>
								<StarIcon weight="fill" className="size-3 text-amber-300" />
								Master
							</span>
						)}
						{resume.isLocked && (
							<span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest", palette.tag)}>
								<LockSimpleIcon weight="bold" className="size-3" />
								Locked
							</span>
						)}
					</div>
				</div>

				{/* Bottom 85%: body with resume name + hover overlay */}
				<div className={cn("absolute inset-x-0 bottom-0 flex h-[85%] flex-col items-center justify-center px-5 py-6", palette.body)}>
					<p className={cn("text-center font-bold text-xl leading-snug", palette.name)}>
						{resume.name}
					</p>
				</div>

				{/* Hover overlay with CTA */}
				<div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/20 group-hover:opacity-100">
					<div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-lg">
						<TargetIcon weight="duotone" className="size-4 text-emerald-600" />
						<span className="font-semibold text-slate-900 text-sm">
							<Trans>Analyze</Trans>
						</span>
					</div>
				</div>
			</div>

			{/* Footer: last updated */}
			<div className={cn("border-t border-black/5 px-4 py-3", palette.body)}>
				<p className="w-full truncate text-center text-muted-foreground text-xs">
					Last updated on {updatedAt}
				</p>
			</div>
		</button>
	);
}
