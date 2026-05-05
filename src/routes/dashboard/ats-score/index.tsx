import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { CaretRightIcon, FileTextIcon, TargetIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";

type Resume = RouterOutput["resume"]["list"][number];

export const Route = createFileRoute("/dashboard/ats-score/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data: resumes } = useQuery(orpc.resume.list.queryOptions({ input: { tags: [], sort: "lastUpdatedAt" } }));
	const navigate = useNavigate();

	return (
		<div className="-m-10 md:-m-12 min-h-full bg-slate-50 p-10 md:p-12">
			<div className="space-y-6">
				<div className="max-w-xl">
					<h1 className="font-black text-3xl text-slate-900 tracking-tight">
						<Trans>ATS Analysis</Trans>
					</h1>
					<p className="mt-1 font-medium text-slate-500 text-sm">
						<Trans>Pick a resume to score it against ATS criteria and get tailored improvement suggestions.</Trans>
					</p>
				</div>

				<div className="space-y-4">
					<p className="font-semibold text-slate-400 text-xs uppercase tracking-widest">
						<Trans>Select a resume to score</Trans>
					</p>

					{resumes?.length === 0 ? (
						<div className="rounded-2xl border border-slate-200/60 bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.03)]">
							<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
								<FileTextIcon weight="duotone" className="size-7" />
							</div>
							<p className="font-medium text-slate-500">
								<Trans>No resumes found. Create a resume first to use ATS scoring.</Trans>
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
	const { i18n } = useLingui();

	const updatedAt = useMemo(
		() => Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(resume.updatedAt),
		[i18n.locale, resume.updatedAt],
	);

	const tags: string[] = [];
	if (resume.isPrimary) tags.push("Master");
	if (resume.isLocked) tags.push("Locked");

	return (
		<button
			type="button"
			onClick={onSelect}
			className="group cursor-pointer rounded-2xl border border-slate-200/60 bg-white p-5 text-start shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.03)] transition-shadow hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<TargetIcon weight="duotone" className="size-5" />
				</div>
				<CaretRightIcon
					weight="bold"
					className="mt-2 size-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
				/>
			</div>

			<h3 className="mt-4 line-clamp-1 font-bold text-base text-slate-900">{resume.name}</h3>
			<p className="mt-1 line-clamp-1 font-medium text-slate-500 text-xs">
				<Trans>Last updated on {updatedAt}</Trans>
			</p>

			{tags.length > 0 && (
				<div className="mt-4 flex flex-wrap gap-1.5">
					{tags.map((tag) => (
						<span
							key={tag}
							className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-[10px] text-primary uppercase tracking-wider"
						>
							{tag}
						</span>
					))}
				</div>
			)}
		</button>
	);
}
