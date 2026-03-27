import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { CircleNotchIcon, LockSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { match, P } from "ts-pattern";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { ResumeContextMenu } from "../menus/context-menu";
import { BaseCard } from "./base-card";
import { MiniResumePreview } from "./mini-resume-preview";

type ResumeCardProps = {
	resume: RouterOutput["resume"]["list"][number];
};

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

export function ResumeCard({ resume }: ResumeCardProps) {
	const { i18n } = useLingui();

	const { data: screenshotData, isLoading } = useQuery(
		orpc.printer.getResumeScreenshot.queryOptions({ input: { id: resume.id } }),
	);

	const template = resume.data?.metadata?.template ?? "onyx";
	const templateColor = templateColors[template] || templateColors.onyx;

	const updatedAt = useMemo(() => {
		return Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(resume.updatedAt);
	}, [i18n.locale, resume.updatedAt]);

	return (
		<ResumeContextMenu resume={resume}>
			<Link to="/builder/$resumeId" params={{ resumeId: resume.id }} className="cursor-default">
				<button
					type="button"
					className="group flex w-full flex-col overflow-hidden rounded-2xl bg-white text-start shadow-sm transition-all hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
				>
					{/* Preview thumbnail */}
					<div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-50">
						{match({ isLoading, imageSrc: screenshotData?.url })
							.with({ isLoading: true }, () => (
								<div className="relative size-full">
									<div className="flex size-full flex-col">
										<MiniResumePreview resume={resume} />
									</div>
									<div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm">
										<CircleNotchIcon weight="thin" className="size-10 animate-spin text-slate-400" />
									</div>
								</div>
							))
							.with({ imageSrc: P.string }, ({ imageSrc }) => (
								<img
									src={imageSrc}
									alt={resume.name}
									className={cn("size-full object-cover object-top transition-transform duration-300 group-hover:scale-105", resume.isLocked && "blur-sm")}
								/>
							))
							.otherwise(() => (
								<div className={cn("size-full overflow-hidden", resume.isLocked && "blur-sm")}>
									<MiniResumePreview resume={resume} />
								</div>
							))}

						<ResumeLockOverlay isLocked={resume.isLocked} />
					</div>

					{/* Card footer */}
					<div className={cn("border-t border-slate-100 px-4 py-3")}>
						<p className="truncate text-slate-400 text-xs">Last updated on {updatedAt}</p>
					</div>
				</button>
			</Link>
		</ResumeContextMenu>
	);
}

function ResumeLockOverlay({ isLocked }: { isLocked: boolean }) {
	return (
		<AnimatePresence>
			{isLocked && (
				<motion.div
					key="resume-lock-overlay"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
				>
					<div className="flex items-center justify-center rounded-full bg-white p-6 shadow-lg">
						<LockSimpleIcon weight="thin" className="size-12 text-slate-600" />
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
