import { InfoIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/style";
import { getScoreColor } from "./score-helpers";

// ─── Tooltip ────────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
	const [visible, setVisible] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

	const updatePos = useCallback(() => {
		if (!triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		setPos({
			top: rect.top + window.scrollY - 8,
			left: rect.right + window.scrollX - 220,
		});
	}, []);

	useEffect(() => {
		if (visible) updatePos();
	}, [visible, updatePos]);

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				className="flex items-center justify-center rounded-full p-0.5 text-slate-300 transition-colors hover:text-slate-500"
				onMouseEnter={() => setVisible(true)}
				onMouseLeave={() => setVisible(false)}
				onFocus={() => setVisible(true)}
				onBlur={() => setVisible(false)}
				aria-label="Info"
			>
				<InfoIcon weight="fill" className="size-3.5" />
			</button>
			{visible &&
				pos &&
				createPortal(
					<div
						className="pointer-events-none fixed z-[9999]"
						style={{ top: pos.top, left: pos.left, width: 220, transform: "translateY(-100%)" }}
					>
						<div
							className="rounded-md text-left text-white leading-relaxed shadow-lg"
							style={{
								backgroundColor: "#1a3a5c",
								borderRadius: 6,
								padding: "8px 10px",
								fontSize: 12,
								lineHeight: 1.5,
							}}
						>
							{text}
						</div>
						<div
							className="absolute right-2"
							style={{
								width: 0,
								height: 0,
								borderLeft: "5px solid transparent",
								borderRight: "5px solid transparent",
								borderTop: "5px solid #1a3a5c",
							}}
						/>
					</div>,
					document.body,
				)}
		</>
	);
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

type StatCardProps = {
	icon: React.ReactNode;
	iconBg: string;
	iconColor: string;
	label: string;
	value: number | string;
	tooltip?: string;
};

export function StatCard({ icon, iconBg, iconColor, label, value, tooltip }: StatCardProps) {
	return (
		<div className="relative rounded-2xl bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5">
			<div className="mb-3 flex items-center justify-between">
				<div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconBg, iconColor)}>{icon}</div>
				{tooltip && <InfoTooltip text={tooltip} />}
			</div>
			<p className="font-medium text-[10px] text-slate-400 uppercase tracking-widest">{label}</p>
			<p className="mt-0.5 font-bold text-2xl text-slate-900">{value}</p>
		</div>
	);
}

// ─── Completion Rate Card (legacy, kept for compat) ─────────────────────────

type CompletionRateCardProps = {
	icon: React.ReactNode;
	iconBg: string;
	iconColor: string;
	label: string;
	value: number;
};

export function CompletionRateCard({ icon, iconBg, iconColor, label, value }: CompletionRateCardProps) {
	return (
		<div className="relative rounded-2xl bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5">
			<div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl", iconBg, iconColor)}>{icon}</div>
			<p className="font-medium text-[10px] text-slate-400 uppercase tracking-widest">{label}</p>
			<p className="mt-0.5 font-bold text-2xl text-slate-900">{value}%</p>
			<div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
				<div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${value}%` }} />
			</div>
		</div>
	);
}

// ─── Rate Card (Submission Rate / Evaluation Rate) ──────────────────────────

type RateCardProps = {
	icon: React.ReactNode;
	iconBg: string;
	iconColor: string;
	label: string;
	value: number;
	tooltip?: string;
};

export function RateCard({ icon, iconBg, iconColor, label, value, tooltip }: RateCardProps) {
	const barColor = value > 75 ? "bg-emerald-500" : value >= 25 ? "bg-amber-500" : "bg-rose-500";
	const textColor = value > 75 ? "text-emerald-600" : value >= 25 ? "text-amber-600" : "text-rose-600";

	return (
		<div className="relative rounded-2xl bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5">
			<div className="mb-3 flex items-center justify-between">
				<div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconBg, iconColor)}>{icon}</div>
				{tooltip && <InfoTooltip text={tooltip} />}
			</div>
			<p className="font-medium text-[10px] text-slate-400 uppercase tracking-widest">{label}</p>
			<p className={cn("mt-0.5 font-bold text-2xl", textColor)}>{value.toFixed(1)}%</p>
			<div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
				<div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${value}%` }} />
			</div>
		</div>
	);
}

// ─── Score Card ─────────────────────────────────────────────────────────────

type ScoreCardProps = {
	icon: React.ReactNode;
	iconBg: string;
	iconColor: string;
	label: string;
	value: number | null;
};

export function ScoreCard({ icon, iconBg, iconColor, label, value }: ScoreCardProps) {
	if (value === null) {
		return (
			<div className="rounded-2xl bg-white p-5 shadow-sm">
				<div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl", iconBg, iconColor)}>{icon}</div>
				<p className="font-medium text-[10px] text-slate-400 uppercase tracking-widest">{label}</p>
				<p className="mt-0.5 font-bold text-2xl text-slate-300">—</p>
			</div>
		);
	}

	return (
		<div className="relative rounded-2xl bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5">
			<div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl", iconBg, iconColor)}>{icon}</div>
			<p className="font-medium text-[10px] text-slate-400 uppercase tracking-widest">{label}</p>
			<p className={cn("mt-0.5 font-bold text-2xl", getScoreColor(value))}>{value.toFixed(1)}/5</p>
		</div>
	);
}

// ─── Detail Stat Card (for submission breakdown column) ─────────────────────

type DetailStatCardProps = {
	icon: React.ReactNode;
	iconBg: string;
	value: number;
	label: string;
};

export function DetailStatCard({ icon, iconBg, value, label }: DetailStatCardProps) {
	return (
		<div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
			<div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", iconBg)}>{icon}</div>
			<div className="min-w-0">
				<p className="font-bold text-lg text-slate-900 leading-none">{value}</p>
				<p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
			</div>
		</div>
	);
}
