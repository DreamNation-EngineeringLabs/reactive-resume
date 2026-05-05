import { Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Trans } from "@lingui/react/macro";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

type CreditMeterProps = {
	label: string;
	used: number;
	total: number;
	remaining: number;
};

function CreditMeter({ label, used, total, remaining }: CreditMeterProps) {
	const isUnlimited = total === -1;
	const pct = isUnlimited ? 100 : total > 0 ? Math.min(100, (used / total) * 100) : 100;
	const isLow = !isUnlimited && remaining >= 0 && remaining <= 2;
	const isOut = !isUnlimited && remaining === 0;

	const barColor = isOut ? "bg-rose-500" : isLow ? "bg-amber-400" : "bg-primary";
	const valueColor = isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900";

	return (
		<div className="flex min-w-[160px] flex-col gap-1.5">
			<div className="flex items-center justify-between gap-3">
				<span className="font-semibold text-[11px] text-slate-500 uppercase tracking-wider">{label}</span>
				<span className={cn("font-bold text-sm tabular-nums", valueColor)}>
					{isUnlimited ? "∞" : `${used} / ${total}`}
				</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
				<div
					className={cn("h-full rounded-full transition-all duration-500", barColor)}
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

export function CreditUsageBanner() {
	const { data, isLoading } = useQuery(orpc.quota.myCredits.queryOptions());

	if (isLoading || !data) return null;

	const { resumeCreate, atsScore } = data;

	const hasAnyFiniteQuota =
		resumeCreate.total !== -1 ||
		atsScore.total !== -1 ||
		resumeCreate.used > 0 ||
		atsScore.used > 0;

	if (!hasAnyFiniteQuota) return null;

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:gap-6">
			<div className="flex flex-1 items-center gap-3">
				<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<Zap fill="currentColor" strokeWidth={0} className="size-5" />
				</div>
				<div className="min-w-0">
					<p className="font-bold text-slate-900 text-base"><Trans>Credits</Trans></p>
					<p className="text-slate-500 text-xs">
						<Trans>Credits replenish at the start of each cycle.</Trans>
					</p>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
				<CreditMeter
					label="AI Generations"
					used={resumeCreate.used}
					total={resumeCreate.total}
					remaining={resumeCreate.remaining}
				/>
				<div className="hidden h-10 w-px bg-border sm:block" />
				<CreditMeter
					label="ATS Analyses"
					used={atsScore.used}
					total={atsScore.total}
					remaining={atsScore.remaining}
				/>
			</div>
		</div>
	);
}
