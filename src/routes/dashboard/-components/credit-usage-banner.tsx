import { ReadCvLogoIcon, SparkleIcon, WarningIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

type CreditBarProps = {
	label: string;
	icon: React.ReactNode;
	iconBg: string;
	iconColor: string;
	used: number;
	total: number;
	remaining: number;
};

function CreditBar({ label, icon, iconBg, iconColor, used, total, remaining }: CreditBarProps) {
	const isUnlimited = total === -1;
	const pct = isUnlimited ? 0 : total > 0 ? Math.min(100, (used / total) * 100) : 100;
	const isLow = !isUnlimited && remaining >= 0 && remaining <= 2;
	const isOut = !isUnlimited && remaining === 0;

	const barColor = isOut ? "bg-rose-500" : isLow ? "bg-amber-400" : "bg-emerald-500";
	const textColor = isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-700";

	return (
		<div className="flex flex-1 min-w-0 flex-col gap-1.5 rounded-2xl bg-white px-4 py-3 shadow-sm">
			<div className="flex items-center gap-2">
				<div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", iconBg, iconColor)}>
					{icon}
				</div>
				<span className="font-semibold text-[11px] text-slate-500 uppercase tracking-wider truncate">{label}</span>
				{isLow && !isOut && (
					<WarningIcon weight="fill" className="ml-auto shrink-0 size-4 text-amber-400" />
				)}
				{isOut && (
					<WarningIcon weight="fill" className="ml-auto shrink-0 size-4 text-rose-500" />
				)}
			</div>

			<div className="flex items-baseline gap-1">
				<span className={cn("font-bold text-xl leading-none", textColor)}>
					{isUnlimited ? "∞" : remaining}
				</span>
				{!isUnlimited && (
					<span className="text-[11px] text-slate-400">/ {total} remaining</span>
				)}
				{isUnlimited && (
					<span className="text-[11px] text-slate-400">unlimited</span>
				)}
			</div>

			{!isUnlimited && (
				<div className="h-1 overflow-hidden rounded-full bg-slate-100">
					<div
						className={cn("h-full rounded-full transition-all duration-500", barColor)}
						style={{ width: `${pct}%` }}
					/>
				</div>
			)}

			{!isUnlimited && (
				<p className="text-[10px] text-slate-400">{used} used</p>
			)}
		</div>
	);
}

export function CreditUsageBanner() {
	const { data, isLoading } = useQuery(orpc.quota.myCredits.queryOptions());

	if (isLoading || !data) return null;

	const { resumeCreate, atsScore } = data;

	// If both are unlimited and no credits have been consumed, don't show the banner at all
	// (avoids noise for users who aren't on a quota plan)
	const hasAnyFiniteQuota =
		resumeCreate.total !== -1 || atsScore.total !== -1 ||
		resumeCreate.used > 0 || atsScore.used > 0;

	if (!hasAnyFiniteQuota) return null;

	return (
		<div className="flex flex-wrap gap-3">
			<CreditBar
				label="Resume Credits"
				icon={<ReadCvLogoIcon weight="duotone" className="size-4" />}
				iconBg="bg-blue-50"
				iconColor="text-blue-500"
				used={resumeCreate.used}
				total={resumeCreate.total}
				remaining={resumeCreate.remaining}
			/>
			<CreditBar
				label="ATS Score Credits"
				icon={<SparkleIcon weight="duotone" className="size-4" />}
				iconBg="bg-violet-50"
				iconColor="text-violet-500"
				used={atsScore.used}
				total={atsScore.total}
				remaining={atsScore.remaining}
			/>
		</div>
	);
}
