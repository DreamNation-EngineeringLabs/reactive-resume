import { plural, t } from "@lingui/core/macro";
import { cn } from "@/utils/style";
import { uiSurface } from "@/utils/ui-tokens";
import type { StudentWithResumes } from "./student-resume-table";

function PanelTitle({ title, hint }: { title: string; hint: string }) {
	return (
		<div className="mb-4">
			<h3 className="font-semibold text-foreground">{title}</h3>
			<p className="text-muted-foreground text-xs">{hint}</p>
		</div>
	);
}

/** Each student counts once, by how far their furthest resume got. */
export function ResumeStatusPanel({ students }: { students: StudentWithResumes[] }) {
	const counts = { evaluated: 0, waiting: 0, drafting: 0, none: 0 };
	for (const s of students) {
		if (s.resumes.some((r) => r.evaluationScore !== null)) counts.evaluated++;
		else if (s.resumes.some((r) => r.isSubmitted)) counts.waiting++;
		else if (s.resumes.length > 0) counts.drafting++;
		else counts.none++;
	}

	const rows = [
		{ key: "evaluated", label: t`Evaluated with a score`, bar: "bg-emerald-500" },
		{ key: "waiting", label: t`Submitted, not evaluated yet`, bar: "bg-primary" },
		{ key: "drafting", label: t`Resume started, not submitted`, bar: "bg-primary/30" },
		{ key: "none", label: t`No resume yet`, bar: "bg-border" },
	] as const;
	const total = students.length;

	return (
		<div className={cn(uiSurface.card, "p-6")}>
			<PanelTitle title={t`Where resumes stand`} hint={t`Each student is counted once, at their furthest resume.`} />
			<div className="flex h-3 overflow-hidden rounded-full bg-muted">
				{rows.map((r) => (
					<div
						key={r.key}
						className={cn("h-full transition-[width] duration-500", r.bar)}
						style={{ width: `${total ? (counts[r.key] / total) * 100 : 0}%` }}
					/>
				))}
			</div>
			<ul className="mt-5 space-y-3">
				{rows.map((r) => (
					<li key={r.key} className="flex items-center gap-3 text-sm">
						<span className={cn("size-2.5 shrink-0 rounded-full", r.bar)} />
						<span className="flex-1 text-foreground">{r.label}</span>
						<span className="font-semibold text-foreground tabular-nums">{counts[r.key]}</span>
						<span className="w-10 text-right text-muted-foreground text-xs tabular-nums">
							{total ? Math.round((counts[r.key] / total) * 100) : 0}%
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

const BUCKETS = [
	{ label: "0–1", min: 0, max: 1 },
	{ label: "1–2", min: 1, max: 2 },
	{ label: "2–3", min: 2, max: 3 },
	{ label: "3–4", min: 3, max: 4 },
	{ label: "4–5", min: 4, max: 5 },
];

/** Evaluation scores out of 5, one bar per point of the scale. */
export function ScoreSpreadPanel({ students }: { students: StudentWithResumes[] }) {
	const scores = students.flatMap((s) =>
		s.resumes.filter((r) => r.evaluationScore !== null).map((r) => r.evaluationScore as number),
	);
	const counts = BUCKETS.map((b) => scores.filter((v) => v >= b.min && (b.max === 5 ? v <= b.max : v < b.max)).length);
	const peak = Math.max(...counts, 1);

	return (
		<div className={cn(uiSurface.card, "flex flex-col p-6")}>
			<PanelTitle title={t`Score spread`} hint={t`Evaluation scores out of 5.`} />
			{scores.length === 0 ? (
				<p className="my-auto py-8 text-center text-muted-foreground text-sm">{t`No resume has been evaluated yet.`}</p>
			) : (
				<>
					<div className="flex h-32 items-end gap-3">
						{BUCKETS.map((b, i) => (
							<div
								key={b.label}
								className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
								title={plural(counts[i], { one: `# resume scored ${b.label}`, other: `# resumes scored ${b.label}` })}
							>
								<span className="font-medium text-muted-foreground text-xs tabular-nums">{counts[i] || ""}</span>
								<div
									className="w-full max-w-10 rounded-t-lg bg-primary"
									style={{
										height: `${Math.max(4, (counts[i] / peak) * 100)}%`,
										opacity: counts[i] ? 0.35 + 0.65 * (counts[i] / peak) : 0.12,
									}}
								/>
							</div>
						))}
					</div>
					<div className="mt-2 flex gap-3 border-border border-t pt-2">
						{BUCKETS.map((b) => (
							<span key={b.label} className="flex-1 text-center text-muted-foreground text-xs">
								{b.label}
							</span>
						))}
					</div>
				</>
			)}
			<p className="mt-4 text-muted-foreground text-xs">
				{scores.length > 0
					? plural(scores.length, { one: "Based on # evaluated resume", other: "Based on # evaluated resumes" })
					: ""}
			</p>
		</div>
	);
}
