import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ChartLineUpIcon, TargetIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
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
							<span className="text-[8px] text-muted-foreground tabular-nums">{d.value > 0 ? d.value : ""}</span>
							<div
								className={cn("w-full rounded-t transition-all", d.color ?? "bg-primary/60")}
								style={{ height: Math.max(2, heightPct) }}
							/>
						</div>
					);
				})}
			</div>
			<div className="flex gap-1">
				{data.map((d, i) => (
					<div key={i} className="flex-1 text-center">
						<span className="block truncate text-[8px] text-muted-foreground">{d.label}</span>
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

	const distributionBars = stats.scoreDistribution.map((b) => ({
		label: b.bucket,
		value: b.count,
		color:
			b.bucket.startsWith("81") || b.bucket.startsWith("61")
				? "bg-green-400/70"
				: b.bucket.startsWith("41")
					? "bg-amber-400/70"
					: "bg-red-400/70",
	}));

	const improvementBars = stats.topImprovedCategories.map((c) => ({
		label: c.label.split(" ")[0], // Shortened label
		value: c.avgDelta,
	}));

	return (
		<div className="space-y-6">
			{/* KPI row */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatCard
					title={t`Total ATS Checks`}
					value={stats.totalChecks.toLocaleString()}
					icon={<TargetIcon className="size-5" />}
					color="text-blue-600"
				/>
				<StatCard
					title={t`Avg Score`}
					value={String(stats.avgCurrentScore)}
					suffix="/100"
					icon={<TargetIcon className="size-5" />}
					color="text-purple-600"
				/>
				<StatCard
					title={t`Avg Improvement`}
					value={stats.avgScoreImprovement >= 0 ? `+${stats.avgScoreImprovement}` : String(stats.avgScoreImprovement)}
					suffix=" pts / check"
					icon={<ChartLineUpIcon className="size-5" />}
					color={stats.avgScoreImprovement >= 0 ? "text-green-600" : "text-red-500"}
				/>
				<StatCard
					title={t`Top Category Gained`}
					value={stats.topImprovedCategories[0]?.label.split(" ")[0] ?? "—"}
					suffix={stats.topImprovedCategories[0] ? ` +${stats.topImprovedCategories[0].avgDelta}%` : ""}
					icon={<ChartLineUpIcon className="size-5" />}
					color="text-amber-600"
				/>
			</div>

			{/* Charts row */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{/* Score distribution */}
				<div className="space-y-2 rounded-xl border p-4">
					<p className="font-semibold text-sm">
						<Trans>Score Distribution</Trans>
					</p>
					<MiniBarChart data={distributionBars} label={t`Number of scoring runs by score range`} />
				</div>

				{/* Top improved categories */}
				<div className="space-y-2 rounded-xl border p-4">
					<p className="font-semibold text-sm">
						<Trans>Most Improved Categories</Trans>
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
				<div className="space-y-2 rounded-xl border p-4">
					<p className="font-semibold text-sm">
						<Trans>Daily ATS Checks (14 days)</Trans>
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
				<div className="space-y-3 rounded-xl border p-4">
					<p className="font-semibold text-sm">
						<Trans>Category Improvement Breakdown</Trans>
					</p>
					<div className="space-y-2">
						{stats.topImprovedCategories.map((cat) => (
							<div key={cat.category} className="flex items-center gap-3">
								<span className="w-40 truncate font-medium text-xs">{cat.label}</span>
								<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-green-500/70 transition-all"
										style={{ width: `${Math.min(100, cat.avgDelta * 2)}%` }}
									/>
								</div>
								<span className="w-12 text-right font-semibold text-green-600 text-xs dark:text-green-400">
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

function StatCard({
	title,
	value,
	suffix,
	icon,
	color,
}: {
	title: string;
	value: string;
	suffix?: string;
	icon: React.ReactNode;
	color: string;
}) {
	return (
		<div className="space-y-2 rounded-xl border p-4">
			<div className={cn("flex size-8 items-center justify-center rounded-lg bg-muted/50", color)}>{icon}</div>
			<div>
				<p className="font-bold text-2xl tabular-nums">
					{value}
					{suffix && <span className="font-normal text-muted-foreground text-sm">{suffix}</span>}
				</p>
				<p className="text-muted-foreground text-xs">{title}</p>
			</div>
		</div>
	);
}
