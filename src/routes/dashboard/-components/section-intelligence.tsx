import { plural, t } from "@lingui/core/macro";
import {
	ArrowRightIcon,
	BellRingingIcon,
	ClipboardTextIcon,
	SealCheckIcon,
	WarningCircleIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { cn } from "@/utils/style";
import { uiSurface } from "@/utils/ui-tokens";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
	if (score >= 4) return { bg: "bg-emerald-50", text: "text-emerald-700" };
	if (score >= 2.5) return { bg: "bg-amber-50", text: "text-amber-700" };
	return { bg: "bg-rose-50", text: "text-rose-700" };
}

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
		<div className="flex flex-wrap items-center gap-3">
			<span className="shrink-0 font-medium text-muted-foreground text-sm">{t`Group sections by`}</span>
			<div className="inline-flex gap-1 rounded-xl bg-muted p-1">
				{types.map((type) => (
					<button
						key={type}
						type="button"
						onClick={() => onSelect(type)}
						className={cn(
							"rounded-lg px-3 py-1 font-medium text-sm transition-colors duration-200",
							type === selectedType
								? "bg-card text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{type.charAt(0) + type.slice(1).toLowerCase()}
					</button>
				))}
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
			message: plural(pendingPO, { one: "# resume finalized by faculty is waiting for your review", other: "# resumes finalized by faculty are waiting for your review" }),
			accent: "border-l-primary",
			iconBg: "bg-primary/10 text-primary",
			tab: "inbox",
			cta: t`Go to inbox`,
		});

	if (resubmitted > 0)
		alerts.push({
			id: "resubmitted",
			icon: <BellRingingIcon weight="duotone" className="size-4" />,
			message: plural(resubmitted, { one: "# resume was resubmitted after your revision request", other: "# resumes were resubmitted after your revision request" }),
			accent: "border-l-amber-500",
			iconBg: "bg-amber-50 text-amber-600",
			tab: "inbox",
			cta: t`Go to Inbox`,
		});

	if (noResume > 0)
		alerts.push({
			id: "no_resume",
			icon: <WarningCircleIcon weight="duotone" className="size-4" />,
			message: plural(noResume, { one: "# student hasn't created a resume yet", other: "# students haven't created a resume yet" }),
			accent: "border-l-rose-500",
			iconBg: "bg-rose-50 text-rose-600",
			tab: "students",
			cta: t`View Students`,
		});

	if (noSubmission > 0)
		alerts.push({
			id: "no_submission",
			icon: <WarningIcon weight="duotone" className="size-4" />,
			message: plural(noSubmission, { one: "# section has no submissions yet", other: "# sections have no submissions yet" }),
			accent: "border-l-rose-400",
			iconBg: "bg-rose-50 text-rose-500",
			tab: "sections",
			cta: t`View Sections`,
		});

	if (fullyApproved > 0)
		alerts.push({
			id: "fully_approved",
			icon: <SealCheckIcon weight="duotone" className="size-4" />,
			message: plural(fullyApproved, { one: "# section is fully approved", other: "# sections are fully approved" }),
			accent: "border-l-emerald-500",
			iconBg: "bg-emerald-50 text-emerald-600",
			tab: "sections",
			cta: t`View Sections`,
		});

	if (alerts.length === 0) return null;

	return (
		<div className={cn(uiSurface.card, "space-y-3 p-5")}>
			<div className="mb-1 flex items-center gap-2">
				<BellRingingIcon weight="duotone" className="size-4 text-muted-foreground" />
				<h3 className="font-semibold text-base text-foreground">{t`Needs attention`}</h3>
			</div>
			<div className="space-y-2">
				{alerts.map((alert) => (
					<div
						key={alert.id}
						className={cn(
							"flex items-center gap-3 rounded-xl border border-border border-l-4 bg-muted/40 px-4 py-3",
							alert.accent,
						)}
					>
						<div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-xl", alert.iconBg)}>
							{alert.icon}
						</div>
						<p className="flex-1 text-foreground text-sm">{alert.message}</p>
						<button
							type="button"
							onClick={() => onNavigateToTab(alert.tab)}
							className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 font-semibold text-foreground text-xs shadow-sm transition-[transform,colors,box-shadow] duration-200 hover:bg-muted/50 active:scale-[0.97]"
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
// Block 3: Top Performing Sections
// ─────────────────────────────────────────────────────────────────────────────

function TopPerformingSections({ sections }: { sections: UnitStat[] }) {
	const ranked = [...sections]
		.filter((s) => s.stats.averageScore !== null && s.stats.totalStudents > 0)
		.sort((a, b) => (b.stats.averageScore ?? 0) - (a.stats.averageScore ?? 0))
		.slice(0, 3);

	if (ranked.length === 0) return null;

	return (
		<div className={cn(uiSurface.card, "p-5")}>
			<h3 className="mb-4 font-semibold text-base text-foreground">{t`Highest average scores`}</h3>
			<div className="grid gap-3 sm:grid-cols-3">
				{ranked.map((section, i) => {
					const score = section.stats.averageScore!;
					return (
						<div key={section.id} className="flex flex-col gap-1 rounded-xl border border-border bg-surface-inset p-4">
							<span className="font-medium text-muted-foreground text-xs">#{i + 1}</span>
							<p className="line-clamp-2 font-semibold text-foreground text-sm leading-snug">{section.name}</p>
							<p className="mt-1 flex items-baseline justify-between gap-2">
								<span className="font-semibold text-2xl text-foreground tabular-nums">
									{score.toFixed(1)}
									<span className="ml-0.5 font-medium text-base text-muted-foreground">/5</span>
								</span>
								<span className="text-muted-foreground text-xs">
									{plural(section.stats.totalStudents, { one: "# student", other: "# students" })}
								</span>
							</p>
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

	const sorted = [...active].sort((a, b) => b.stats.totalStudents - a.stats.totalStudents);

	return (
		<div className={cn(uiSurface.card, "overflow-hidden p-0 shadow-sm")}>
			<div className="flex items-center gap-2 px-5 pt-5 pb-4">
				<h3 className="font-semibold text-base text-foreground">{t`Section health`}</h3>
				<span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground text-xs">{active.length}</span>
			</div>

			{/* Desktop table */}
			<div className="hidden overflow-x-auto md:block">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-border border-t bg-muted/40 text-left">
							<th className="px-5 py-2.5 font-medium text-muted-foreground text-xs">{t`Section`}</th>
							<th className="px-4 py-2.5 text-center font-medium text-muted-foreground text-xs">{t`Students`}</th>
							<th className="px-4 py-2.5 text-center font-medium text-muted-foreground text-xs">{t`Resumes`}</th>
							<th className="w-48 px-4 py-2.5 font-medium text-muted-foreground text-xs">{t`Pipeline`}</th>
							<th className="px-4 py-2.5 text-center font-medium text-muted-foreground text-xs">{t`Avg Score`}</th>
							<th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">{t`Stage`}</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{sorted.map((section) => {
							const st = section.stats;
							const total = st.totalResumes;
							const approved = st.approvedResumes;
							const remaining = Math.max(0, total - approved);

							let stageText = "";
							if (total === 0) stageText = t`No resumes`;
							else if (approved === total) stageText = t`All Approved`;
							else if (st.passedFaculty - approved > 0) stageText = t`${st.passedFaculty - approved} pending PO`;
							else if (st.submittedResumes > 0) stageText = t`${st.submittedResumes} with Faculty`;
							else stageText = t`${total} in Draft`;

							return (
								<tr key={section.id} className="transition-colors duration-200 hover:bg-muted/40">
									<td className="px-5 py-3">
										<p className="line-clamp-1 font-semibold text-foreground text-sm">{section.name}</p>
										<p className="text-muted-foreground text-xs">{section.unitType}</p>
									</td>
									<td className="px-4 py-3 text-center font-semibold text-foreground text-sm">{st.totalStudents}</td>
									<td className="px-4 py-3 text-center font-semibold text-foreground text-sm">{total}</td>
									<td className="px-4 py-3">
										{total > 0 ? (
											<div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
												{approved > 0 && (
													<div className="h-full bg-emerald-500" style={{ width: `${(approved / total) * 100}%` }} />
												)}
												{remaining > 0 && (
													<div className="h-full bg-muted-foreground/30" style={{ width: `${(remaining / total) * 100}%` }} />
												)}
											</div>
										) : (
											<div className="h-2 w-full rounded-full bg-muted" />
										)}
										<p className="mt-1 text-[10px] text-muted-foreground">
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
											<span className="text-muted-foreground/40 text-xs">—</span>
										)}
									</td>
									<td className="px-4 py-3">
										<span className="text-muted-foreground text-xs">{stageText}</span>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{/* Mobile cards */}
			<div className="divide-y divide-border md:hidden">
				{sorted.map((section) => {
					const st = section.stats;
					const total = st.totalResumes;
					const approved = st.approvedResumes;
					return (
						<div key={section.id} className="space-y-2 px-5 py-4">
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="font-semibold text-foreground text-sm">{section.name}</p>
									<p className="text-muted-foreground text-xs">{section.unitType}</p>
								</div>
							</div>
							<div className="flex items-center gap-4 text-muted-foreground text-xs">
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
									<div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
										{approved > 0 && (
											<div className="h-full bg-emerald-500" style={{ width: `${(approved / total) * 100}%` }} />
										)}
									</div>
									<p className="text-[10px] text-muted-foreground">
										{approved}/{total} {t`approved`}
									</p>
								</>
							)}
						</div>
					);
				})}
			</div>

			<div className="border-border border-t px-5 py-3">
				<button
					type="button"
					onClick={() => onNavigateToTab("sections")}
					className="flex items-center gap-1.5 font-semibold text-primary text-xs transition-colors duration-200 hover:text-primary/80"
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
			<div className="pt-2">
				<h2 className="font-bold text-foreground text-xl tracking-tight">{t`How each section is doing`}</h2>
				<p className="text-muted-foreground text-sm">{t`Where reviews are stuck, and which sections are ahead.`}</p>
			</div>

			{/* Unit type selector — controls ALL blocks below */}
			<UnitTypeSelector types={availableTypes} selectedType={effectiveType} onSelect={setSelectedType} />

			<ActionAlerts sections={activeSections} students={activeStudents} onNavigateToTab={onNavigateToTab} />

			<TopPerformingSections sections={activeSections} />

			<SectionHealthTable sections={activeSections} onNavigateToTab={onNavigateToTab} />
		</div>
	);
}
