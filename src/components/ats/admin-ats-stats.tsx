import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Stat, StatStrip } from "@/components/ui/stat";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

// ---------------------------------------------------------------------------
// Mini bar chart (SVG, no deps)
// ---------------------------------------------------------------------------

function MiniBarChart({
	data,
	label,
}: {
	data: Array<{ label: string; value: number; color?: string }>;
	label?: string;
}) {
	const max = Math.max(...data.map((d) => d.value), 1);
	const BAR_H = 80;

	return (
		<div className="space-y-1">
			{label && <p className="font-medium text-muted-foreground text-xs">{label}</p>}
			<div className="flex h-20 items-end gap-1">
				{data.map((d, i) => {
					const heightPct = (d.value / max) * BAR_H;
					return (
						<div key={i} className="flex flex-1 flex-col items-center gap-0.5" title={`${d.label}: ${d.value}`}>
							<span className="text-[10px] text-muted-foreground tabular-nums">{d.value > 0 ? d.value : ""}</span>
							<div
								className={cn("w-full rounded-t transition-all", d.color ?? "bg-primary")}
								style={{ height: Math.max(2, heightPct) }}
							/>
						</div>
					);
				})}
			</div>
			<div className="flex gap-1">
				{data.map((d, i) => (
					<div key={i} className="flex-1 text-center">
						<span className="block truncate text-[10px] text-muted-foreground">{d.label}</span>
					</div>
				))}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Daily activity sparkline
// ---------------------------------------------------------------------------

function DailySparkline({ data }: { data: Array<{ date: string; count: number; avgScore: number }> }) {
	if (data.length < 2) return null;

	const W = 240;
	const H = 40;
	const counts = data.map((d) => d.count);
	const maxCount = Math.max(...counts, 1);
	const toX = (i: number) => (i / (data.length - 1)) * W;
	const toY = (v: number) => H - (v / maxCount) * H;
	const points = data.map((d, i) => `${toX(i)},${toY(d.count)}`).join(" ");

	return (
		<svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
			<polyline
				points={points}
				fill="none"
				stroke="currentColor"
				strokeOpacity={0.5}
				strokeWidth={1.5}
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			{data.map((d, i) => (
				<circle key={d.date} cx={toX(i)} cy={toY(d.count)} r={2} fill="currentColor" fillOpacity={0.7} />
			))}
		</svg>
	);
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function AdminAtsStats() {
	const { data: stats, isLoading } = useQuery(orpc.ats.adminStats.queryOptions({ input: {} }));

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[...Array(4)].map((_, i) => (
					<div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />
				))}
			</div>
		);
	}

	if (!stats) return null;

	const distributionBars = stats.scoreDistribution.map((b) => ({ label: b.bucket, value: b.count }));

	const improvementBars = stats.topImprovedCategories.map((c) => ({
		label: c.label.split(" ")[0], // Shortened label
		value: c.avgDelta,
	}));

	return (
		<div className="space-y-6">
			{/* KPI row */}
			<StatStrip className="bg-muted/50 shadow-none">
				<Stat label={t`Total ATS checks`} value={stats.totalChecks.toLocaleString()} />
				<Stat
					label={t`Average score`}
					value={
						<>
							{stats.avgCurrentScore}
							<span className="ml-0.5 font-medium text-base text-muted-foreground">/100</span>
						</>
					}
				/>
				<Stat
					label={t`Average improvement`}
					value={stats.avgScoreImprovement >= 0 ? `+${stats.avgScoreImprovement}` : String(stats.avgScoreImprovement)}
					hint={t`points per check`}
				/>
				<Stat
					label={t`Biggest gain`}
					value={stats.topImprovedCategories[0]?.label.split(" ")[0] ?? null}
					hint={stats.topImprovedCategories[0] ? `+${stats.topImprovedCategories[0].avgDelta}%` : undefined}
				/>
			</StatStrip>

			{/* Charts row */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{/* Score distribution */}
				<div className="space-y-2 rounded-xl border border-border bg-card p-4">
					<p className="font-semibold text-sm">
						<Trans>Score distribution</Trans>
					</p>
					<MiniBarChart data={distributionBars} label={t`Number of scoring runs by score range`} />
				</div>

				{/* Top improved categories */}
				<div className="space-y-2 rounded-xl border border-border bg-card p-4">
					<p className="font-semibold text-sm">
						<Trans>Most improved categories</Trans>
					</p>
					{improvementBars.length > 0 ? (
						<MiniBarChart data={improvementBars} label={t`Avg % gain per check`} />
					) : (
						<p className="py-4 text-center text-muted-foreground text-xs">
							<Trans>No improvement data yet</Trans>
						</p>
					)}
				</div>

				{/* Daily activity */}
				<div className="space-y-2 rounded-xl border border-border bg-card p-4">
					<p className="font-semibold text-sm">
						<Trans>Daily ATS checks (14 days)</Trans>
					</p>
					{stats.checksByDay.length >= 2 ? (
						<>
							<DailySparkline data={stats.checksByDay} />
							<div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
								<span>{stats.checksByDay[0]?.date?.slice(5)}</span>
								<span>{stats.checksByDay[stats.checksByDay.length - 1]?.date?.slice(5)}</span>
							</div>
						</>
					) : (
						<p className="py-4 text-center text-muted-foreground text-xs">
							<Trans>Not enough data yet</Trans>
						</p>
					)}
				</div>
			</div>

			{/* Top improvements detail */}
			{stats.topImprovedCategories.length > 0 && (
				<div className="space-y-3 rounded-xl border border-border bg-card p-4">
					<p className="font-semibold text-sm">
						<Trans>Category improvement breakdown</Trans>
					</p>
					<div className="space-y-2">
						{stats.topImprovedCategories.map((cat) => (
							<div key={cat.category} className="flex items-center gap-3">
								<span className="w-40 truncate font-medium text-xs">{cat.label}</span>
								<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-primary transition-all"
										style={{ width: `${Math.min(100, cat.avgDelta * 2)}%` }}
									/>
								</div>
								<span className="w-12 text-right font-semibold text-foreground text-xs tabular-nums">
									+{cat.avgDelta}%
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
