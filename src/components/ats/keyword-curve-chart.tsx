import { Trans } from "@lingui/react/macro";

interface KeywordCurveChartProps {
	currentCount: number;
}

const MAX_SCORE = 25;
const CURVE_MAX_COUNT = 30;

function curveScore(count: number): number {
	if (count < 5) return 0;
	return Math.round(Math.min(MAX_SCORE, (Math.max(0, count - 4) / 21) ** 0.9 * MAX_SCORE));
}

const CHART_W = 320;
const CHART_H = 160;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;

const INNER_W = CHART_W - PAD_L - PAD_R;
const INNER_H = CHART_H - PAD_T - PAD_B;

function toX(count: number): number {
	return PAD_L + (count / CURVE_MAX_COUNT) * INNER_W;
}

function toY(score: number): number {
	return PAD_T + INNER_H - (score / MAX_SCORE) * INNER_H;
}

// Precompute polyline points for the curve
const curvePoints: string = Array.from({ length: CURVE_MAX_COUNT + 1 }, (_, i) => `${toX(i)},${toY(curveScore(i))}`).join(
	" ",
);

// Area fill path: curve + close back along bottom
const areaPath: string =
	`M ${toX(0)},${toY(0)} ` +
	Array.from({ length: CURVE_MAX_COUNT + 1 }, (_, i) => `L ${toX(i)},${toY(curveScore(i))}`).join(" ") +
	` L ${toX(CURVE_MAX_COUNT)},${toY(0)} Z`;

// Y-axis tick labels
const Y_TICKS = [0, 5, 10, 15, 20, 25];
// X-axis tick labels (every 5)
const X_TICKS = [0, 5, 10, 15, 20, 25, 30];

export function KeywordCurveChart({ currentCount }: KeywordCurveChartProps) {
	const clampedCount = Math.min(currentCount, CURVE_MAX_COUNT);
	const currentScore = curveScore(clampedCount);
	const cx = toX(clampedCount);
	const cy = toY(currentScore);

	const pct = Math.round((currentScore / MAX_SCORE) * 100);

	// Determine label/color for current position
	let statusColor = "#ef4444"; // red
	if (pct >= 80) statusColor = "#22c55e";
	else if (pct >= 60) statusColor = "#3b82f6";
	else if (pct >= 40) statusColor = "#f59e0b";

	// Next milestone
	const nextThreshold =
		clampedCount < 5
			? 5
			: clampedCount < 8
				? 8
				: clampedCount < 12
					? 12
					: clampedCount < 17
						? 17
						: clampedCount < 21
							? 21
							: clampedCount < 25
								? 25
								: null;

	return (
		<div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
			<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
				<Trans>Keyword Scoring Curve</Trans>
			</p>

			<svg
				viewBox={`0 0 ${CHART_W} ${CHART_H}`}
				className="w-full"
				style={{ maxWidth: CHART_W, display: "block" }}
				aria-label="Keyword scoring curve chart"
			>
				<defs>
					<linearGradient id="kwAreaGrad" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
						<stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
					</linearGradient>
					<clipPath id="kwClip">
						<rect x={PAD_L} y={PAD_T} width={INNER_W} height={INNER_H} />
					</clipPath>
				</defs>

				{/* Horizontal grid lines */}
				{Y_TICKS.map((v) => (
					<line
						key={v}
						x1={PAD_L}
						x2={PAD_L + INNER_W}
						y1={toY(v)}
						y2={toY(v)}
						stroke="currentColor"
						strokeWidth="0.5"
						className="text-zinc-200 dark:text-zinc-700"
					/>
				))}

				{/* Area fill */}
				<path d={areaPath} fill="url(#kwAreaGrad)" clipPath="url(#kwClip)" />

				{/* Curve polyline */}
				<polyline
					points={curvePoints}
					fill="none"
					stroke="#6366f1"
					strokeWidth="2"
					strokeLinejoin="round"
					clipPath="url(#kwClip)"
				/>

				{/* Vertical dashed line at current position */}
				<line
					x1={cx}
					x2={cx}
					y1={PAD_T}
					y2={PAD_T + INNER_H}
					stroke={statusColor}
					strokeWidth="1.5"
					strokeDasharray="3 3"
				/>

				{/* Current position dot */}
				<circle cx={cx} cy={cy} r={5} fill={statusColor} stroke="white" strokeWidth="2" />

				{/* Score label near dot */}
				<text
					x={cx + (clampedCount > CURVE_MAX_COUNT - 5 ? -8 : 8)}
					y={cy - 8}
					fontSize="10"
					fontWeight="600"
					fill={statusColor}
					textAnchor={clampedCount > CURVE_MAX_COUNT - 5 ? "end" : "start"}
				>
					{currentScore}/25
				</text>

				{/* Y-axis labels */}
				{Y_TICKS.map((v) => (
					<text key={v} x={PAD_L - 4} y={toY(v) + 3} fontSize="9" fill="currentColor" className="text-zinc-400" textAnchor="end">
						{v}
					</text>
				))}

				{/* X-axis labels */}
				{X_TICKS.map((v) => (
					<text
						key={v}
						x={toX(v)}
						y={PAD_T + INNER_H + 14}
						fontSize="9"
						fill="currentColor"
						className="text-zinc-400"
						textAnchor="middle"
					>
						{v}
					</text>
				))}

				{/* Axis lines */}
				<line
					x1={PAD_L}
					x2={PAD_L}
					y1={PAD_T}
					y2={PAD_T + INNER_H}
					stroke="currentColor"
					strokeWidth="1"
					className="text-zinc-300 dark:text-zinc-600"
				/>
				<line
					x1={PAD_L}
					x2={PAD_L + INNER_W}
					y1={PAD_T + INNER_H}
					y2={PAD_T + INNER_H}
					stroke="currentColor"
					strokeWidth="1"
					className="text-zinc-300 dark:text-zinc-600"
				/>

				{/* Axis titles */}
				<text x={PAD_L + INNER_W / 2} y={CHART_H - 2} fontSize="9" fill="currentColor" className="text-zinc-400" textAnchor="middle">
					<Trans>Tech terms detected</Trans>
				</text>
				<text
					x={10}
					y={PAD_T + INNER_H / 2}
					fontSize="9"
					fill="currentColor"
					className="text-zinc-400"
					textAnchor="middle"
					transform={`rotate(-90, 10, ${PAD_T + INNER_H / 2})`}
				>
					<Trans>Score</Trans>
				</text>
			</svg>

			{/* Summary row */}
			<div className="mt-2 flex items-center justify-between text-xs">
				<span className="text-zinc-500 dark:text-zinc-400">
					<Trans>You are at</Trans>{" "}
					<span className="font-semibold" style={{ color: statusColor }}>
						{clampedCount} <Trans>terms</Trans>
					</span>{" "}
					→{" "}
					<span className="font-semibold" style={{ color: statusColor }}>
						{currentScore}/25
					</span>
				</span>
				{nextThreshold !== null && (
					<span className="text-zinc-400 dark:text-zinc-500">
						<Trans>Next milestone:</Trans>{" "}
						<span className="font-medium text-indigo-500">{nextThreshold} terms</span>{" "}
						<span className="text-zinc-400">(~{curveScore(nextThreshold)}/25)</span>
					</span>
				)}
			</div>
		</div>
	);
}
