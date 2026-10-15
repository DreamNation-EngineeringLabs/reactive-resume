import { InfoIcon } from "@phosphor-icons/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils/style";

function InfoTooltip({ text }: { text: string }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label="What this means"
					className="flex size-5 items-center justify-center rounded-full text-muted-foreground/60 transition-colors duration-200 hover:text-foreground"
				>
					<InfoIcon weight="fill" className="size-3.5" />
				</button>
			</TooltipTrigger>
			<TooltipContent className="max-w-60 leading-relaxed">{text}</TooltipContent>
		</Tooltip>
	);
}

// ─── Stat strip ─────────────────────────────────────────────────────────────

/** One panel, hairline dividers between the figures: stacked on narrow screens, one row from `lg`. */
export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div
			className={cn(
				"grid overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm lg:auto-cols-fr lg:grid-flow-col",
				className,
			)}
		>
			{children}
		</div>
	);
}

type StatProps = {
	label: string;
	/** `null` = nothing to show yet: a grey dash. */
	value: React.ReactNode | null;
	/** One short line of context under the figure, e.g. the counts behind a rate. */
	hint?: string;
	tooltip?: string;
	/** 0–100: draws a slim bar under the figure (rates). */
	progress?: number | null;
};

export function Stat({ label, value, hint, tooltip, progress }: StatProps) {
	return (
		<div className="flex flex-col gap-1 border-border not-last:border-b p-5 lg:not-last:border-r lg:not-last:border-b-0">
			<div className="flex items-center gap-1 font-medium text-muted-foreground text-sm">
				{label}
				{tooltip && <InfoTooltip text={tooltip} />}
			</div>
			<p
				className={cn(
					"font-semibold text-3xl tabular-nums tracking-tight",
					value === null ? "text-muted-foreground/40" : "text-foreground",
				)}
			>
				{value ?? "—"}
			</p>
			{progress != null && (
				<div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full rounded-full bg-primary transition-[width] duration-500"
						style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
					/>
				</div>
			)}
			{hint && <p className="text-muted-foreground text-xs">{hint}</p>}
		</div>
	);
}
