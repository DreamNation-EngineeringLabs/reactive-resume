import { t } from "@lingui/core/macro";
import {
	ArrowRightIcon,
	BellRingingIcon,
	ClipboardTextIcon,
	MedalIcon,
	SealCheckIcon,
	UsersIcon,
	WarningCircleIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { cn } from "@/utils/style";
import type { DashboardTab } from "./section-metrics-view";
import type { StudentWithResumes } from "./student-resume-table";

// ─── Types ────────────────────────────────────────────────────────────────────

type UnitStat = {
	id: string;
	name: string;
	unitType: string;
	stats: {
		totalStudents: number;
		totalResumes: number;
		evaluatedResumes: number;
		submittedResumes: number;
		passedFaculty: number;
		poVerifiedResumes: number;
		approvedResumes: number;
		completionRate: number;
		averageScore: number | null;
	};
};

type OrgUnit = { id: string; name: string; type: string; parentId: string | null };

type SectionIntelligenceProps = {
	sections: UnitStat[];
	students: StudentWithResumes[];
	allOrgUnits: OrgUnit[];
	onNavigateToTab: (tab: DashboardTab, search?: Record<string, string>) => void;
};

// ─── Pipeline stage definitions ──────────────────────────────────────────────

const PIPELINE_STAGES = [
	{ key: "DRAFT", label: t`Draft`, color: "bg-slate-300" },
	{ key: "SUBMITTED_TO_FACULTY", label: t`With Faculty`, color: "bg-blue-400" },
	{ key: "FACULTY_REVISION_REQUESTED", label: t`Revision Req.`, color: "bg-amber-400" },
	{ key: "FACULTY_VERIFIED", label: t`Faculty Verified`, color: "bg-violet-400" },
	{ key: "FINALIZED_BY_FACULTY", label: t`Pending PO`, color: "bg-indigo-400" },
	{ key: "RESUBMITTED_TO_PO", label: t`Resubmitted`, color: "bg-orange-400" },
	{ key: "PO_REVISION_REQUESTED", label: t`PO Revision`, color: "bg-rose-400" },
	{ key: "APPROVED", label: t`Approved`, color: "bg-emerald-500" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
	if (score >= 4) return { bg: "bg-emerald-50", text: "text-emerald-700" };
	if (score >= 2.5) return { bg: "bg-amber-50", text: "text-amber-700" };
	return { bg: "bg-rose-50", text: "text-rose-700" };
}

type HealthStatus = "on_track" | "needs_attention" | "no_submissions";

function sectionHealth(s: UnitStat["stats"]): HealthStatus {
	if (s.totalResumes === 0 || s.submittedResumes === 0) return "no_submissions";
	if (s.approvedResumes > 0 && s.approvedResumes / Math.max(s.totalResumes, 1) >= 0.5) return "on_track";
	if (s.passedFaculty / Math.max(s.totalResumes, 1) >= 0.5) return "on_track";
	if (s.submittedResumes > 0) return "needs_attention";
	return "no_submissions";
}

const healthConfig: Record<HealthStatus, { label: string; dot: string; badge: string; text: string }> = {
	on_track: { label: t`On Track`, dot: "bg-emerald-500", badge: "bg-emerald-50", text: "text-emerald-700" },
	needs_attention: { label: t`Needs Attention`, dot: "bg-amber-500", badge: "bg-amber-50", text: "text-amber-700" },
	no_submissions: { label: t`No Submissions`, dot: "bg-rose-500", badge: "bg-rose-50", text: "text-rose-700" },
};

/**
 * Returns unit types sorted from highest level to lowest (leaf types last).
 * Leaf = a type whose units never appear as anyone's parentId.
 */
function sortedUnitTypes(allOrgUnits: OrgUnit[], availableSections: UnitStat[]): string[] {
	const parentIds = new Set(allOrgUnits.map((u) => u.parentId).filter(Boolean) as string[]);
	const leafIds = new Set(allOrgUnits.filter((u) => !parentIds.has(u.id)).map((u) => u.id));
	const leafTypes = new Set(allOrgUnits.filter((u) => leafIds.has(u.id)).map((u) => u.type));

	const types = [
		...new Set(
			availableSections
				.filter((s) => s.stats.totalStudents > 0 && s.unitType.toUpperCase() !== "ROOT")
				.map((s) => s.unitType),
		),
	];
	// Sort: non-leaf (higher-level) types first, leaf types last
	return types.sort((a, b) => {
		const aLeaf = leafTypes.has(a) ? 1 : 0;
		const bLeaf = leafTypes.has(b) ? 1 : 0;
		return aLeaf - bLeaf;
	});
}

/** Derive the leaf (lowest level) type from allOrgUnits. */
function deriveLowestLevelType(allOrgUnits: OrgUnit[]): string | null {
	if (allOrgUnits.length === 0) return null;
	const parentIds = new Set(allOrgUnits.map((u) => u.parentId).filter(Boolean) as string[]);
	const leafUnits = allOrgUnits.filter((u) => !parentIds.has(u.id));
	if (leafUnits.length === 0) return allOrgUnits[0]?.type ?? null;

	const typeCount = new Map<string, number>();
	for (const u of leafUnits) typeCount.set(u.type, (typeCount.get(u.type) ?? 0) + 1);

	let bestType = leafUnits[0].type;
	let bestCount = 0;
	for (const [type, count] of typeCount) {
		if (count > bestCount) {
			bestCount = count;
			bestType = type;
		}
	}
	return bestType;
}

/**
 * Filter students down to only those whose leaf sectionId is a descendant
 * of a unit with the given type (or all students when type is the leaf level).
 */
function filterStudentsByUnitType(
	students: StudentWithResumes[],
	selectedType: string,
	lowestLevelType: string | null,
	allOrgUnits: OrgUnit[],
): StudentWithResumes[] {
	// If the selected type IS the leaf type, no further filtering needed
	if (selectedType === lowestLevelType) return students;

	// Build a set of all leaf section IDs that are descendants of units of selectedType
	const selectedTypeUnitIds = allOrgUnits.filter((u) => u.type === selectedType).map((u) => u.id);

	const descendantLeafIds = new Set<string>();
	for (const startId of selectedTypeUnitIds) {
		// BFS to collect all descendants
		const queue = [startId];
		while (queue.length > 0) {
			const current = queue.shift()!;
			const children = allOrgUnits.filter((u) => u.parentId === current);
			if (children.length === 0) {
				// This is a leaf
				descendantLeafIds.add(current);
			} else {
				for (const child of children) queue.push(child.id);
			}
		}
	}

	return students.filter((s) => descendantLeafIds.has(s.sectionId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit Type Selector (shared at root level)
// ─────────────────────────────────────────────────────────────────────────────

function UnitTypeSelector({
	types,
	selectedType,
	onSelect,
}: {
	types: string[];
	selectedType: string | null;
	onSelect: (type: string) => void;
}) {
	if (types.length <= 1) return null;

	return (
		<div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-sm">
			<span className="shrink-0 font-semibold text-slate-500 text-xs uppercase tracking-wider">{t`View by unit`}</span>
			<div className="flex flex-wrap gap-1.5">
				{types.map((type) => {
					const isSelected = type === selectedType;
					return (
						<button
							key={type}
							type="button"
							onClick={() => onSelect(type)}
							className={cn(
								"rounded-lg px-3 py-1.5 font-bold text-xs uppercase tracking-wide transition-all active:scale-[0.97]",
								isSelected ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
							)}
						>
							{type}
						</button>
					);
				})}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Block 4: Action Alerts
// ─────────────────────────────────────────────────────────────────────────────

function ActionAlerts({
	students,
	sections,
	onNavigateToTab,
}: {
	students: StudentWithResumes[];
	sections: UnitStat[];
	onNavigateToTab: SectionIntelligenceProps["onNavigateToTab"];
}) {
	const allResumes = students.flatMap((s) => s.resumes);

	const pendingPO = allResumes.filter((r) => r.reviewStatus === "FINALIZED_BY_FACULTY").length;
	const resubmitted = allResumes.filter((r) => r.reviewStatus === "RESUBMITTED_TO_PO").length;
	const noResume = students.filter((s) => s.resumes.length === 0).length;
	const noSubmission = sections.filter((s) => s.stats.totalStudents > 0 && s.stats.submittedResumes === 0).length;
	const fullyApproved = sections.filter(
		(s) => s.stats.totalResumes > 0 && s.stats.approvedResumes === s.stats.totalResumes,
	).length;

	type Alert = {
		id: string;
		icon: React.ReactNode;
		message: string;
		accent: string;
		iconBg: string;
		tab: DashboardTab;
		cta: string;
	};

	const alerts: Alert[] = [];

	if (pendingPO > 0)
		alerts.push({
			id: "pending_po",
			icon: <ClipboardTextIcon weight="duotone" className="size-4" />,
			message: t`${pendingPO} resume${pendingPO !== 1 ? "s" : ""} finalized by faculty and waiting for your review`,
			accent: "border-l-indigo-500",
			iconBg: "bg-indigo-50 text-indigo-600",
			tab: "inbox",
			cta: t`Go to Inbox`,
		});

	if (resubmitted > 0)
		alerts.push({
			id: "resubmitted",
			icon: <BellRingingIcon weight="duotone" className="size-4" />,
			message: t`${resubmitted} resume${resubmitted !== 1 ? "s" : ""} resubmitted by students after your revision request`,
			accent: "border-l-amber-500",
			iconBg: "bg-amber-50 text-amber-600",
			tab: "inbox",
			cta: t`Go to Inbox`,
		});

	if (noResume > 0)
		alerts.push({
			id: "no_resume",
			icon: <WarningCircleIcon weight="duotone" className="size-4" />,
			message: t`${noResume} student${noResume !== 1 ? "s" : ""} haven't created a resume yet`,
			accent: "border-l-rose-500",
			iconBg: "bg-rose-50 text-rose-600",
			tab: "students",
			cta: t`View Students`,
		});

	if (noSubmission > 0)
		alerts.push({
			id: "no_submission",
			icon: <WarningIcon weight="duotone" className="size-4" />,
			message: t`${noSubmission} section${noSubmission !== 1 ? "s" : ""} have no submissions yet`,
			accent: "border-l-rose-400",
			iconBg: "bg-rose-50 text-rose-500",
			tab: "sections",
			cta: t`View Sections`,
		});

	if (fullyApproved > 0)
		alerts.push({
			id: "fully_approved",
			icon: <SealCheckIcon weight="duotone" className="size-4" />,
			message: t`${fullyApproved} section${fullyApproved !== 1 ? "s" : ""} are fully approved`,
			accent: "border-l-emerald-500",
			iconBg: "bg-emerald-50 text-emerald-600",
			tab: "sections",
			cta: t`View Sections`,
		});

	if (alerts.length === 0) return null;

	return (
		<div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
			<div className="mb-1 flex items-center gap-2">
				<BellRingingIcon weight="duotone" className="size-4 text-slate-500" />
				<h3 className="font-bold text-base text-slate-900">{t`Action Alerts`}</h3>
			</div>
			<div className="space-y-2">
				{alerts.map((alert) => (
					<div
						key={alert.id}
						className={cn(
							"flex items-center gap-3 rounded-xl border border-slate-100 border-l-4 bg-slate-50 px-4 py-3",
							alert.accent,
						)}
					>
						<div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", alert.iconBg)}>
							{alert.icon}
						</div>
						<p className="flex-1 text-slate-700 text-sm">{alert.message}</p>
						<button
							type="button"
							onClick={() => onNavigateToTab(alert.tab)}
							className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-1.5 font-semibold text-slate-700 text-xs shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 active:scale-[0.97]"
						>
							{alert.cta}
							<ArrowRightIcon weight="bold" className="size-3" />
						</button>
					</div>
				))}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Block 1: Pipeline Funnel
// ─────────────────────────────────────────────────────────────────────────────

function PipelineFunnel({ students }: { students: StudentWithResumes[] }) {
	const allResumes = students.flatMap((s) => s.resumes);
	const total = allResumes.length;

	if (total === 0) return null;

	const counts = Object.fromEntries(
		PIPELINE_STAGES.map((stage) => [
			stage.key,
			allResumes.filter((r) => (r.reviewStatus ?? "DRAFT") === stage.key).length,
		]),
	);

	const stagesWithCount = PIPELINE_STAGES.map((s) => ({ ...s, count: counts[s.key] ?? 0 })).filter((s) => s.count > 0);

	return (
		<div className="rounded-2xl bg-white p-5 shadow-sm">
			<div className="mb-5 flex items-center gap-2">
				<h3 className="font-bold text-base text-slate-900">{t`Resume Pipeline`}</h3>
				<span className="font-medium text-slate-400 text-xs">{t`${total} total`}</span>
			</div>

			<div className="mb-5 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
				{stagesWithCount.map((stage) => (
					<div
						key={stage.key}
						className={cn("h-full transition-all", stage.color)}
						style={{ width: `${(stage.count / total) * 100}%` }}
						title={`${stage.label}: ${stage.count}`}
					/>
				))}
			</div>

			<div className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
				{stagesWithCount.map((stage) => (
					<div key={stage.key} className="flex items-center gap-2">
						<div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", stage.color)} />
						<div className="min-w-0">
							<p className="truncate font-semibold text-slate-900 text-xs">{stage.count}</p>
							<p className="truncate text-[10px] text-slate-400">{stage.label}</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Block 3: Top Performing Sections
// ─────────────────────────────────────────────────────────────────────────────

function TopPerformingSections({ sections }: { sections: UnitStat[] }) {
	const ranked = [...sections]
		.filter((s) => s.stats.averageScore !== null && s.stats.totalStudents > 0)
		.sort((a, b) => (b.stats.averageScore ?? 0) - (a.stats.averageScore ?? 0))
		.slice(0, 3);

	if (ranked.length === 0) return null;

	const medals = ["🥇", "🥈", "🥉"];
	const medalColors = [
		{ ring: "ring-amber-200", bg: "bg-amber-50" },
		{ ring: "ring-slate-200", bg: "bg-slate-50" },
		{ ring: "ring-orange-200", bg: "bg-orange-50" },
	];

	return (
		<div className="rounded-2xl bg-white p-5 shadow-sm">
			<div className="mb-4 flex items-center gap-2">
				<MedalIcon weight="duotone" className="size-4 text-amber-500" />
				<h3 className="font-bold text-base text-slate-900">{t`Top Performing`}</h3>
			</div>
			<div className="grid gap-3 sm:grid-cols-3">
				{ranked.map((section, i) => {
					const score = section.stats.averageScore!;
					const sc = scoreColor(score);
					return (
						<div
							key={section.id}
							className={cn("flex flex-col gap-2 rounded-xl p-4 ring-2", medalColors[i].bg, medalColors[i].ring)}
						>
							<div className="flex items-start justify-between gap-2">
								<span className="text-xl leading-none">{medals[i]}</span>
								<span className={cn("rounded-full px-2.5 py-0.5 font-bold text-sm", sc.bg, sc.text)}>
									{score.toFixed(1)}/5
								</span>
							</div>
							<p className="line-clamp-2 font-semibold text-slate-900 text-sm leading-snug">{section.name}</p>
							<div className="flex items-center gap-1 text-slate-500 text-xs">
								<UsersIcon weight="duotone" className="size-3" />
								<span>
									{section.stats.totalStudents} {t`students`}
								</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Block 2: Section Health Table
// ─────────────────────────────────────────────────────────────────────────────

function SectionHealthTable({
	sections,
	onNavigateToTab,
}: {
	sections: UnitStat[];
	onNavigateToTab: SectionIntelligenceProps["onNavigateToTab"];
}) {
	const active = sections.filter((s) => s.stats.totalStudents > 0);
	if (active.length === 0) return null;

	const healthOrder: Record<HealthStatus, number> = { needs_attention: 0, no_submissions: 1, on_track: 2 };
	const sorted = [...active].sort((a, b) => {
		const ha = sectionHealth(a.stats);
		const hb = sectionHealth(b.stats);
		if (ha !== hb) return healthOrder[ha] - healthOrder[hb];
		return b.stats.totalStudents - a.stats.totalStudents;
	});

	return (
		<div className="overflow-hidden rounded-2xl bg-white shadow-sm">
			<div className="flex items-center gap-2 px-5 pt-5 pb-4">
				<h3 className="font-bold text-base text-slate-900">{t`Section Health`}</h3>
				<span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-500 text-xs">{active.length}</span>
			</div>

			{/* Desktop table */}
			<div className="hidden overflow-x-auto md:block">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-slate-100 border-t bg-slate-50/60 text-left">
							<th className="px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">{t`Section`}</th>
							<th className="px-4 py-2.5 text-center font-semibold text-slate-500 text-xs uppercase tracking-wider">{t`Students`}</th>
							<th className="px-4 py-2.5 text-center font-semibold text-slate-500 text-xs uppercase tracking-wider">{t`Resumes`}</th>
							<th className="w-48 px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">{t`Pipeline`}</th>
							<th className="px-4 py-2.5 text-center font-semibold text-slate-500 text-xs uppercase tracking-wider">{t`Avg Score`}</th>
							<th className="px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">{t`Stage`}</th>
							<th className="px-4 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">{t`Health`}</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{sorted.map((section) => {
							const st = section.stats;
							const health = sectionHealth(st);
							const hc = healthConfig[health];
							const total = st.totalResumes;
							const approved = st.approvedResumes;

							const withFaculty =
								st.evaluatedResumes > 0
									? Math.max(0, st.submittedResumes - st.passedFaculty)
									: Math.max(0, total - approved - st.passedFaculty);
							const pendingPO = Math.max(0, st.passedFaculty - approved);

							const bands = [
								{ w: Math.max(0, total - st.submittedResumes), color: "bg-slate-200" },
								{ w: withFaculty, color: "bg-blue-400" },
								{ w: pendingPO, color: "bg-indigo-400" },
								{ w: approved, color: "bg-emerald-500" },
							];

							let stageText = "";
							if (total === 0) stageText = t`No resumes`;
							else if (approved === total) stageText = t`All Approved`;
							else if (st.passedFaculty - approved > 0) stageText = t`${st.passedFaculty - approved} pending PO`;
							else if (st.submittedResumes > 0) stageText = t`${st.submittedResumes} with Faculty`;
							else stageText = t`${total} in Draft`;

							return (
								<tr key={section.id} className="transition-colors hover:bg-slate-50/50">
									<td className="px-5 py-3">
										<p className="line-clamp-1 font-semibold text-slate-900 text-sm">{section.name}</p>
										<p className="text-slate-400 text-xs">{section.unitType}</p>
									</td>
									<td className="px-4 py-3 text-center font-semibold text-slate-900 text-sm">{st.totalStudents}</td>
									<td className="px-4 py-3 text-center font-semibold text-slate-900 text-sm">{total}</td>
									<td className="px-4 py-3">
										{total > 0 ? (
											<div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
												{bands.map((band, i) =>
													band.w > 0 ? (
														<div
															key={i}
															className={cn("h-full", band.color)}
															style={{ width: `${(band.w / total) * 100}%` }}
														/>
													) : null,
												)}
											</div>
										) : (
											<div className="h-2 w-full rounded-full bg-slate-100" />
										)}
										<p className="mt-1 text-[10px] text-slate-400">
											{approved}/{total} {t`approved`}
										</p>
									</td>
									<td className="px-4 py-3 text-center">
										{st.averageScore !== null ? (
											<span
												className={cn(
													"rounded-full px-2.5 py-0.5 font-semibold text-xs",
													scoreColor(st.averageScore).bg,
													scoreColor(st.averageScore).text,
												)}
											>
												{st.averageScore.toFixed(1)}/5
											</span>
										) : (
											<span className="text-slate-300 text-xs">—</span>
										)}
									</td>
									<td className="px-4 py-3">
										<span className="text-slate-600 text-xs">{stageText}</span>
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-1.5">
											<div className={cn("h-2 w-2 shrink-0 rounded-full", hc.dot)} />
											<span className={cn("rounded-full px-2 py-0.5 font-medium text-[10px]", hc.badge, hc.text)}>
												{hc.label}
											</span>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* Mobile cards */}
			<div className="divide-y divide-slate-100 md:hidden">
				{sorted.map((section) => {
					const st = section.stats;
					const health = sectionHealth(st);
					const hc = healthConfig[health];
					const total = st.totalResumes;
					const approved = st.approvedResumes;
					return (
						<div key={section.id} className="space-y-2 px-5 py-4">
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="font-semibold text-slate-900 text-sm">{section.name}</p>
									<p className="text-slate-400 text-xs">{section.unitType}</p>
								</div>
								<div className="flex shrink-0 items-center gap-1.5">
									<div className={cn("h-2 w-2 rounded-full", hc.dot)} />
									<span className={cn("rounded-full px-2 py-0.5 font-medium text-[10px]", hc.badge, hc.text)}>
										{hc.label}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-4 text-slate-500 text-xs">
								<span>
									{st.totalStudents} {t`students`}
								</span>
								<span>
									{total} {t`resumes`}
								</span>
								{st.averageScore !== null && (
									<span className={cn("font-semibold", scoreColor(st.averageScore).text)}>
										{st.averageScore.toFixed(1)}/5
									</span>
								)}
							</div>
							{total > 0 && (
								<>
									<div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
										{approved > 0 && (
											<div className="h-full bg-emerald-500" style={{ width: `${(approved / total) * 100}%` }} />
										)}
									</div>
									<p className="text-[10px] text-slate-400">
										{approved}/{total} {t`approved`}
									</p>
								</>
							)}
						</div>
					);
				})}
			</div>

			<div className="border-slate-100 border-t px-5 py-3">
				<button
					type="button"
					onClick={() => onNavigateToTab("sections")}
					className="flex items-center gap-1.5 font-semibold text-indigo-600 text-xs transition-colors hover:text-indigo-700"
				>
					{t`View all sections`}
					<ArrowRightIcon weight="bold" className="size-3" />
				</button>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────────

export function SectionIntelligence({ sections, students, allOrgUnits, onNavigateToTab }: SectionIntelligenceProps) {
	const lowestLevelType = useMemo(() => deriveLowestLevelType(allOrgUnits), [allOrgUnits]);

	const availableTypes = useMemo(() => sortedUnitTypes(allOrgUnits, sections), [allOrgUnits, sections]);

	// Default to lowest level (leaf); user can override
	const [selectedType, setSelectedType] = useState<string | null>(null);
	const effectiveType = selectedType ?? lowestLevelType ?? availableTypes[availableTypes.length - 1] ?? null;

	// All metrics derive from these two filtered collections
	const activeSections = useMemo(
		() => (effectiveType ? sections.filter((s) => s.unitType === effectiveType) : sections),
		[sections, effectiveType],
	);

	const activeStudents = useMemo(
		() => (effectiveType ? filterStudentsByUnitType(students, effectiveType, lowestLevelType, allOrgUnits) : students),
		[students, effectiveType, lowestLevelType, allOrgUnits],
	);

	const hasSections = activeSections.some((s) => s.stats.totalStudents > 0);
	if (!hasSections && activeStudents.length === 0) return null;

	return (
		<div className="space-y-4">
			{/* Section label */}
			<div className="flex items-center gap-3">
				<div className="h-px flex-1 bg-slate-200" />
				<span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">
					{t`Section Intelligence`}
				</span>
				<div className="h-px flex-1 bg-slate-200" />
			</div>

			{/* Unit type selector — controls ALL blocks below */}
			<UnitTypeSelector types={availableTypes} selectedType={effectiveType} onSelect={setSelectedType} />

			<ActionAlerts sections={activeSections} students={activeStudents} onNavigateToTab={onNavigateToTab} />
			<PipelineFunnel students={activeStudents} />

			<div className="grid gap-4 lg:grid-cols-2">
				<TopPerformingSections sections={activeSections} />
				<div className="hidden lg:block" />
			</div>

			<SectionHealthTable sections={activeSections} onNavigateToTab={onNavigateToTab} />
		</div>
	);
}
