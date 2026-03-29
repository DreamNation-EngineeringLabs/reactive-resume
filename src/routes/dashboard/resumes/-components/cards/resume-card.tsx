import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { FileTextIcon, LockSimpleIcon, StarIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { cn } from "@/utils/style";
import type { RouterOutput } from "@/integrations/orpc/client";
import { BaseCard } from "./base-card";
import { ResumeContextMenu } from "../menus/context-menu";

type ResumeCardProps = {
	resume: RouterOutput["resume"]["list"][number];
};

const PALETTES = [
	{ bg: "bg-blue-50/50", iconBg: "bg-blue-100", iconColor: "text-blue-600", accent: "text-blue-900/5" },
	{ bg: "bg-indigo-50/50", iconBg: "bg-indigo-100", iconColor: "text-indigo-600", accent: "text-indigo-900/5" },
	{ bg: "bg-violet-50/50", iconBg: "bg-violet-100", iconColor: "text-violet-600", accent: "text-violet-900/5" },
	{ bg: "bg-emerald-50/50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", accent: "text-emerald-900/5" },
	{ bg: "bg-rose-50/50", iconBg: "bg-rose-100", iconColor: "text-rose-600", accent: "text-rose-900/5" },
	{ bg: "bg-amber-50/50", iconBg: "bg-amber-100", iconColor: "text-amber-600", accent: "text-amber-900/5" },
] as const;

function getPalette(id: string) {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = ((hash * 31) + id.charCodeAt(i)) & 0xffff_ffff;
	}
	return PALETTES[Math.abs(hash) % PALETTES.length]!;
}

export function ResumeCard({ resume }: ResumeCardProps) {
	const { i18n } = useLingui();
	const palette = getPalette(resume.id);

	const updatedAt = useMemo(
		() => Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(resume.updatedAt),
		[i18n.locale, resume.updatedAt],
	);

	return (
		<ResumeContextMenu resume={resume}>
			<Link to="/builder/$resumeId" params={{ resumeId: resume.id }} className="cursor-default">
				<BaseCard
					title={resume.name}
					description={t`Last updated on ${updatedAt}`}
					className="h-full"
					customBg={palette.bg}
				>
					{/* Status Badges */}
					<div className="absolute right-4 top-4 flex flex-wrap items-center gap-1.5 z-10 transition-transform group-hover:scale-105">
						{resume.isPrimary && (
							<span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 shadow-sm border border-amber-100">
								<StarIcon weight="fill" className="size-3" />
								Master
							</span>
						)}
						{resume.isLocked && (
							<span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm border border-slate-200">
								<LockSimpleIcon weight="bold" className="size-3" />
								Locked
							</span>
						)}
					</div>

					{/* Icon Container (Squaricle) */}
					<div className="flex size-full flex-col items-center justify-center p-6">
						<div className={cn("mb-6 flex size-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:rotate-6", palette.iconBg, palette.iconColor)}>
							<FileTextIcon weight="duotone" className="size-8" />
						</div>
						
						{/* Hover Action Highlight */}
						<div className="mt-2 flex items-center text-[10px] font-bold uppercase tracking-widest text-primary opacity-0 transition-all group-hover:opacity-100 group-hover:translate-y-0 translate-y-2">
							Open Builder →
						</div>
					</div>

					{/* Background Decoration */}
					<FileTextIcon
						weight="duotone"
						className={cn("absolute -bottom-10 -right-10 size-52 rotate-12 transition-transform duration-700 group-hover:rotate-0 group-hover:scale-110", palette.accent)}
					/>
				</BaseCard>
			</Link>
		</ResumeContextMenu>
	);
}
