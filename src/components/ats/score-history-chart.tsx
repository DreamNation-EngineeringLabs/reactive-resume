import { Trans } from "@lingui/react/macro";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

type HistoryEntry = {
	id: string;
	overallScore: number;
	deltaScore: number | null;
	majorImprovements: Array<{ category: string; label: string; delta: number }>;
	jobDescriptionProvided: boolean;
	createdAt: Date | string;
};

// ---------------------------------------------------------------------------
// Pure SVG sparkline chart
// ---------------------------------------------------------------------------

const CHART_W = 560;
const CHART_H = 120;
const PAD = { top: 16, right: 20, bottom: 28, left: 32 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

function ScoreSparkline({
	entries,
	activeIndex,
	onHover,
}: {
	entries: HistoryEntry[];
	activeIndex: number | null;
	onHover: (i: number | null) => void;
}) {
	if (entries.length < 1) return null;

	const scores = entries.map((e) => e.overallScore);
	const minScore = Math.max(0, Math.min(...scores) - 5);
	const maxScore = Math.min(100, Math.max(...scores) + 5);
	const range = Math.max(maxScore - minScore, 10);

	const toX = (i: number) => (entries.length === 1 ? INNER_W / 2 : (i / (entries.length - 1)) * INNER_W);
	const toY = (s: number) => INNER_H - ((s - minScore) / range) * INNER_H;

	// Build polyline points
	const points = entries.map((e, i) => `${toX(i)},${toY(e.overallScore)}`).join(" ");

	// Area fill path
	const areaPath = `M ${toX(0)},${toY(entries[0].overallScore)} ${entries
		.slice(1)
		.map((e, i) => `L ${toX(i + 1)},${toY(e.overallScore)}`)
		.join(" ")} L ${toX(entries.length - 1)},${INNER_H} L ${toX(0)},${INNER_H} Z`;

	// Y-axis tick values
	const yTicks = [minScore, Math.round((minScore + maxScore) / 2), maxScore];

	return (
		<svg
			viewBox={`0 0 ${CHART_W} ${CHART_H}`}
			className="w-full"
			style={{ height: CHART_H, overflow: "visible" }}
			onMouseLeave={() => onHover(null)}
		>
			<g transform={`translate(${PAD.left},${PAD.top})`}>
				{/* Grid lines */}
				{yTicks.map((tick) => (
					<g key={tick}>
						<line
							x1={0}
							y1={toY(tick)}
							x2={INNER_W}
							y2={toY(tick)}
							stroke="currentColor"
							strokeOpacity={0.08}
							strokeWidth={1}
						/>
						<text
							x={-6}
							y={toY(tick)}
							textAnchor="end"
							dominantBaseline="middle"
							fontSize={9}
							fill="currentColor"
							opacity={0.4}
						>
							{tick}
						</text>
					</g>
				))}

				{/* Area fill */}
				<path d={areaPath} fill="currentColor" fillOpacity={0.06} />

				{/* Line */}
				<polyline
					points={points}
					fill="none"
					stroke="currentColor"
					strokeOpacity={0.6}
					strokeWidth={2}
					strokeLinejoin="round"
					strokeLinecap="round"
				/>

				{/* X-axis labels (only first and last for readability) */}
				{entries.map((e, i) => {
					if (i !== 0 && i !== entries.length - 1 && entries.length > 2) return null;
					const d = new Date(e.createdAt);
					const label = `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
					return (
						<text
							key={e.id}
							x={toX(i)}
							y={INNER_H + 16}
							textAnchor={i === 0 ? "start" : i === entries.length - 1 ? "end" : "middle"}
							fontSize={9}
							fill="currentColor"
							opacity={0.4}
						>
							{label}
						</text>
					);
				})}

				{/* Dots + hover targets */}
				{entries.map((e, i) => {
					const x = toX(i);
					const y = toY(e.overallScore);
					const isActive = activeIndex === i;
					return (
						<g key={e.id}>
							{/* Invisible large hit area */}
							<rect
								x={x - 18}
								y={0}
								width={36}
								height={INNER_H}
								fill="transparent"
								onMouseEnter={() => onHover(i)}
								style={{ cursor: "pointer" }}
							/>
							{/* Dot */}
							<circle
								cx={x}
								cy={y}
								r={isActive ? 6 : 4}
								fill={isActive ? "hsl(var(--primary))" : "currentColor"}
								fillOpacity={isActive ? 1 : 0.7}
								stroke="hsl(var(--background))"
								strokeWidth={2}
								style={{ transition: "r 0.1s" }}
							/>
							{/* Score label (always visible on active, on last point otherwise) */}
							{(isActive || i === entries.length - 1) && (
								<text
									x={x}
									y={y - 10}
									textAnchor="middle"
									fontSize={10}
									fontWeight={600}
									fill={isActive ? "hsl(var(--primary))" : "currentColor"}
									opacity={isActive ? 1 : 0.6}
								>
									{e.overallScore}
								</text>
							)}
						</g>
					);
				})}
			</g>
		</svg>
	);
}

// ---------------------------------------------------------------------------
// Tooltip card — shown beside the hovered point
// ---------------------------------------------------------------------------

function ImprovementTooltip({ entry }: { entry: HistoryEntry }) {
	const date = new Date(entry.createdAt);
	const dateStr = date.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	const deltaAbs = entry.deltaScore != null ? Math.abs(entry.deltaScore) : null;
	const deltaPositive = (entry.deltaScore ?? 0) > 0;
	const deltaZero = entry.deltaScore === 0 || entry.deltaScore == null;

	return (
		<div className="min-w-[240px] space-y-3 rounded-xl border bg-background p-4 text-sm shadow-lg">
			<div className="flex items-center justify-between gap-4">
				<div>
					<p className="font-semibold text-base">{entry.overallScore}/100</p>
					<p className="text-muted-foreground text-xs">{dateStr}</p>
				</div>
				{!deltaZero && deltaAbs != null && (
					<div
						className={cn(
							"flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-xs",
							deltaPositive
								? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
								: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
						)}
					>
						{deltaPositive ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
						{deltaPositive ? "+" : "-"}
						{deltaAbs} pts
					</div>
				)}
				{deltaZero && entry.deltaScore === 0 && (
					<div className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
						<MinusIcon className="size-3" />
						<Trans>No change</Trans>
					</div>
				)}
				{entry.deltaScore == null && (
					<span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700 text-xs dark:bg-blue-950/40 dark:text-blue-400">
						<Trans>First check</Trans>
					</span>
				)}
			</div>

			{entry.majorImprovements.length > 0 && (
				<div className="space-y-1.5">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						<Trans>Improvements vs previous</Trans>
					</p>
					<div className="space-y-1">
						{entry.majorImprovements.map((imp) => (
							<div key={imp.category} className="flex items-center justify-between gap-2">
								<span className="text-foreground text-xs">{imp.label}</span>
								<span className="font-semibold text-green-600 text-xs dark:text-green-400">+{imp.delta}%</span>
							</div>
						))}
					</div>
				</div>
			)}

			{entry.majorImprovements.length === 0 && entry.deltaScore != null && entry.deltaScore > 0 && (
				<p className="text-muted-foreground text-xs">
					<Trans>Score improved — check individual categories for details.</Trans>
				</p>
			)}

			<div className="border-t pt-1">
				<span
					className={cn(
						"rounded-full px-1.5 py-0.5 text-[10px]",
						entry.jobDescriptionProvided
							? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
							: "bg-muted text-muted-foreground",
					)}
				>
					{entry.jobDescriptionProvided ? <Trans>Job Match</Trans> : <Trans>General ATS</Trans>}
				</span>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function AtsScoreHistoryChart({ resumeId }: { resumeId: string }) {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);

	const { data: history, isLoading } = useQuery(orpc.ats.getHistory.queryOptions({ input: { resumeId } }));

	if (isLoading) {
		return <div className="h-32 animate-pulse rounded-xl bg-muted/40" />;
	}

	if (!history || history.length === 0) {
		return (
			<p className="rounded-xl border border-dashed py-6 text-center text-muted-foreground text-xs">
				<Trans>No score history yet — run your first ATS check above.</Trans>
			</p>
		);
	}

	if (history.length === 1) {
		const entry = history[0];
		return (
			<div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
				<div className="flex items-center justify-between">
					<div>
						<span className="font-semibold text-lg">{entry.overallScore}</span>
						<span className="ml-1 text-muted-foreground text-xs">/100</span>
					</div>
					<span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
						<Trans>First check</Trans>
					</span>
				</div>
				<p className="mt-1 text-muted-foreground text-xs">
					<Trans>Score more to see progression over time.</Trans>
				</p>
			</div>
		);
	}

	const activeEntry = activeIndex != null ? history[activeIndex] : null;
	const first = history[0].overallScore;
	const last = history[history.length - 1].overallScore;
	const totalGain = last - first;

	return (
		<div className="space-y-3">
			{/* Summary row */}
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">
					<Trans>Score Progression</Trans>
					<span className="ml-2 font-normal text-muted-foreground text-xs">({history.length} checks)</span>
				</p>
				{totalGain !== 0 && (
					<div
						className={cn(
							"flex items-center gap-1 font-semibold text-xs",
							totalGain > 0 ? "text-green-600" : "text-red-500",
						)}
					>
						{totalGain > 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
						{totalGain > 0 ? "+" : ""}
						{totalGain} pts overall
					</div>
				)}
			</div>

			{/* Chart + tooltip layout */}
			<div className="relative">
				<div className="overflow-hidden rounded-xl border bg-muted/20 p-3">
					<ScoreSparkline entries={history as HistoryEntry[]} activeIndex={activeIndex} onHover={setActiveIndex} />
				</div>

				{/* Tooltip shown below chart on mobile, beside on desktop */}
				{activeEntry && (
					<div className="z-10 mt-2 lg:absolute lg:top-2 lg:right-2 lg:mt-0">
						<ImprovementTooltip entry={activeEntry as HistoryEntry} />
					</div>
				)}
			</div>

			{/* Hint */}
			<p className="text-center text-[10px] text-muted-foreground">
				<Trans>Hover a point to see what improved</Trans>
			</p>
		</div>
	);
}
