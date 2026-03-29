import { cn } from "@/utils/style";
import { getScoreColor } from "./score-helpers";

type StatCardProps = {
	icon: React.ReactNode;
	iconBg: string;
	iconColor: string;
	label: string;
	value: number | string;
};

export function StatCard({ icon, iconBg, iconColor, label, value }: StatCardProps) {
	return (
		<div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]">
			<div className={cn("mb-4 flex h-10 w-10 items-center justify-center rounded-2xl", iconBg, iconColor)}>{icon}</div>
			<p className="font-semibold text-slate-400 text-xs uppercase tracking-widest">{label}</p>
			<p className="mt-1 font-bold text-3xl text-slate-900">{value}</p>
			<div className={cn("pointer-events-none absolute -right-3 -bottom-3 size-20 rotate-12 opacity-5", iconColor)}>
				{icon}
			</div>
		</div>
	);
}

type CompletionRateCardProps = {
	icon: React.ReactNode;
	iconBg: string;
	iconColor: string;
	label: string;
	value: number;
};

export function CompletionRateCard({ icon, iconBg, iconColor, label, value }: CompletionRateCardProps) {
	return (
		<div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]">
			<div className={cn("mb-4 flex h-10 w-10 items-center justify-center rounded-2xl", iconBg, iconColor)}>{icon}</div>
			<p className="font-semibold text-slate-400 text-xs uppercase tracking-widest">{label}</p>
			<p className="mt-1 font-bold text-3xl text-slate-900">{value}%</p>
			<div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
				<div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${value}%` }} />
			</div>
		</div>
	);
}

type ScoreCardProps = {
	icon: React.ReactNode;
	iconBg: string;
	iconColor: string;
	label: string;
	value: number | null;
};

export function ScoreCard({ icon, iconBg, iconColor, label, value }: ScoreCardProps) {
	if (value === null) {
		return <div className="rounded-2xl bg-slate-50 p-6" />;
	}

	return (
		<div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]">
			<div className={cn("mb-4 flex h-10 w-10 items-center justify-center rounded-2xl", iconBg, iconColor)}>{icon}</div>
			<p className="font-semibold text-slate-400 text-xs uppercase tracking-widest">{label}</p>
			<p className={cn("mt-1 font-bold text-3xl", getScoreColor(value))}>{value.toFixed(1)}/5</p>
		</div>
	);
}
