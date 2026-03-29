import { useLingui } from "@lingui/react";
import { LockSimpleIcon, StarIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { RouterOutput } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { ResumeContextMenu } from "../menus/context-menu";

type ResumeCardProps = {
	resume: RouterOutput["resume"]["list"][number];
};

// ---------------------------------------------------------------------------
// 10 colour palettes — header (top 15%) + body (remaining 85%)
// Text colours chosen for strong contrast on each background.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------

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
				<button
					type="button"
					className="group flex w-full flex-col overflow-hidden rounded-2xl text-start shadow-sm transition-all hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
				>
					{/* ── Main area: aspect-[3/4] to match base card height ── */}
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

						{/* Bottom 85%: body with resume name */}
						<div className={cn("absolute inset-x-0 bottom-0 flex h-[85%] flex-col items-center justify-center px-5 py-6", palette.body)}>
							<p className={cn("text-center font-bold text-xl leading-snug", palette.name)}>
								{resume.name}
							</p>
						</div>
					</div>

					{/* ── Footer: last updated ── */}
					<div className={cn("border-t border-black/5 px-4 py-3", palette.body)}>
						<p className="w-full truncate text-center text-muted-foreground text-xs">
							Last updated on {updatedAt}
						</p>
					</div>
				</button>
			</Link>
		</ResumeContextMenu>
	);
}
