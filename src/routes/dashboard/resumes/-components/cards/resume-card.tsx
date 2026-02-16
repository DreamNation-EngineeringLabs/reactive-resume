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

type ResumeCardProps = {
	resume: RouterOutput["resume"]["list"][number];
};

export function ResumeCard({ resume }: ResumeCardProps) {
	const { i18n } = useLingui();

	const { data: screenshotData, isLoading } = useQuery(
		orpc.printer.getResumeScreenshot.queryOptions({ input: { id: resume.id } }),
	);

	const updatedAt = useMemo(() => {
		return Intl.DateTimeFormat(i18n.locale, { dateStyle: "long", timeStyle: "short" }).format(resume.updatedAt);
	}, [i18n.locale, resume.updatedAt]);

	return (
		<ResumeContextMenu resume={resume}>
			<Link to="/builder/$resumeId" params={{ resumeId: resume.id }} className="cursor-default">
				<BaseCard title={resume.name} description={t`Last updated on ${updatedAt}`} tags={resume.tags}>
					{match({ isLoading, imageSrc: screenshotData?.url })
						.with({ isLoading: true }, () => (
							<div className="flex size-full items-center justify-center bg-slate-50">
								<CircleNotchIcon weight="thin" className="size-12 animate-spin text-slate-400" />
							</div>
						))
						.with({ imageSrc: P.string }, ({ imageSrc }) => (
							<img
								src={imageSrc}
								alt={resume.name}
								className={cn("size-full object-cover transition-all", resume.isLocked && "blur-sm")}
							/>
						))
						.otherwise(() => null)}

					<ResumeLockOverlay isLocked={resume.isLocked} />
				</BaseCard>
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
