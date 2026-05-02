import { t } from "@lingui/core/macro";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	BuildingsIcon,
	ChartBarIcon,
	CheckCircleIcon,
	FileTextIcon,
	FunnelSimpleIcon,
	HourglassIcon,
	ListChecksIcon,
	MagnifyingGlassIcon,
	TargetIcon,
	TrayIcon,
	UsersIcon,
	WarningIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminAtsStats } from "@/components/ats/admin-ats-stats";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { ChecklistCreator } from "./checklist-creator";
import { ChecklistsTab } from "./checklists-tab";
import { DashboardHeader } from "./header";
import { InboxView } from "./inbox-view";
import type { OrgUnitFilterValue } from "./org-unit-filter";
import { OrgUnitFilter } from "./org-unit-filter";
import { POSectionCardActions } from "./po-section-card-actions";
import { POSectionFeedbackBanner } from "./po-section-feedback-banner";
import { POSectionReviewDialog } from "./po-section-review-dialog";
import { RecentActivity } from "./recent-activity";
import { SectionIntelligence } from "./section-intelligence";
import { DetailStatCard, RateCard, ScoreCard, StatCard } from "./stat-card";
import { StudentDetailPanel } from "./student-detail-panel";
import type { StudentWithResumes } from "./student-resume-table";
import { StudentResumeTable } from "./student-resume-table";

const sectionsTabPackageDropdownClass =
	"h-8 min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-none hover:bg-slate-50";

export type DashboardTab = "overview" | "inbox" | "sections" | "students" | "checklists";

type SectionMetricsViewProps = {
	scope: "faculty" | "po" | "admin";
	sectionIds: string[];
	tenantId: string;
	initialTab?: DashboardTab;
	initialFilter?: OrgUnitFilterValue;
	sectionId?: string;
};

export function SectionMetricsView({
	scope,
	sectionIds,
	tenantId,
	initialTab = "overview",
	initialFilter = {},
	sectionId,
}: SectionMetricsViewProps) {
	const navigate = useNavigate() as any;
	const activeTab = initialTab;
	const [filter, setFilter] = useState<OrgUnitFilterValue>(initialFilter);
	const queryClient = useQueryClient();

	useEffect(() => {
		setFilter(initialFilter);
	}, [initialFilter]);
	const [selectedStudent, setSelectedStudent] = useState<StudentWithResumes | null>(null);
	const [showChecklistCreator, setShowChecklistCreator] = useState(false);
	const [viewLevel, setViewLevel] = useState<string | null>(null);
	const [sectionsTabSearch, setSectionsTabSearch] = useState("");
	const [poReviewDialog, setPoReviewDialog] = useState<{
		sectionId: string;
		sectionName: string;
		resumes: Array<{ id: string; studentId: string }>;
	} | null>(null);

	const {
		data: dashboard,
		isLoading,
		error,
	} = useQuery(
		orpc.resume.dashboard.sections.queryOptions({
			input: {
				sectionIds,
				tenantId,
				scope: scope === "admin" ? "po" : scope,
				activeUnitId: filter.unitId,
			},
		}),
	);

	const bulkUpdateMutation = useMutation({
		...orpc.resume.dashboard.bulkUpdateResumes.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.resume.dashboard.sections.queryOptions({ input: { sectionIds, tenantId, scope: scope as any } })
					.queryKey as any,
			});
		},
	});

	// ── Derived stats ──────────────────────────────────────────────────────────
	const stats = useMemo(() => {
		if (!dashboard)
			return { totalStudents: 0, totalResumes: 0, completionRate: 0, averageScore: null as number | null };
		return dashboard.aggregateStats;
	}, [dashboard]);

	const detailedStats = useMemo(() => {
		if (!dashboard) return { withResumes: 0, noResumes: 0, pendingReview: 0, evaluated: 0, submitted: 0 };
		const students = dashboard.students;
		const withResumes =
			dashboard.aggregateStats.withPrimaryResume ??
			students.filter((s) => s.resumes.length > 0).length;
		const enrolled =
			dashboard.aggregateStats.enrolledInResumeBuilder ?? students.length;
		const noResumes = enrolled - withResumes;
		const pendingReview = students.filter((s) =>
			s.resumes.some((r) => r.isSubmitted && r.evaluationScore === null),
		).length;
		const evaluated = students.filter((s) => s.resumes.some((r) => r.evaluationScore !== null)).length;
		const submitted = students.filter((s) => s.resumes.some((r) => r.isSubmitted)).length;
		return { withResumes, noResumes, pendingReview, evaluated, submitted };
	}, [dashboard]);

	// ── Filter data (comes directly from server) ──────────────────────────────
	const filterPackages = dashboard?.packages ?? [];
	const filterUnitTypes = dashboard?.unitTypes ?? [];
	const filterAllOrgUnits = dashboard?.allOrgUnits ?? [];

	// Students are already filtered server-side via activeUnitId
	const filteredStudents = dashboard?.students ?? [];

	// ── Section drill-down derived state ─────────────────────────────────────
	const activeSection = useMemo(
		() => (sectionId ? dashboard?.sections.find((s) => s.id === sectionId) : undefined),
		[dashboard?.sections, sectionId],
	);
	const isSectionDetail = activeTab === "sections" && !!sectionId;

	const sectionsTabPackageOptions = useMemo(() => {
		if (filterPackages.length > 0) {
			return filterPackages.map((p) => ({ value: p.id, label: p.name }));
		}
		const byId = new Map<string, string>();
		for (const s of dashboard?.sections ?? []) {
			if (s.packageId && s.packageName) byId.set(s.packageId, s.packageName);
		}
		return [...byId.entries()].map(([value, label]) => ({ value, label }));
	}, [filterPackages, dashboard?.sections]);

	const sectionsTabFilteredRows = useMemo(() => {
		const rows = dashboard?.sections ?? [];
		return rows.filter((s) => {
			if (filter.packageId && s.packageId !== filter.packageId) return false;
			const level = viewLevel || (filterUnitTypes.includes("CLASS") ? "CLASS" : filterUnitTypes[0]);
			if (filterUnitTypes.length === 0) return true;
			return s.unitType === level;
		});
	}, [dashboard?.sections, filter.packageId, filterUnitTypes, viewLevel]);

	const sectionsTabDisplayRows = useMemo(() => {
		const q = sectionsTabSearch.trim().toLowerCase();
		if (!q) return sectionsTabFilteredRows;
		return sectionsTabFilteredRows.filter((unit) => {
			const name = unit.name.toLowerCase();
			const pkg = unit.packageName?.toLowerCase() ?? "";
			const ut = unit.unitType.toLowerCase();
			return name.includes(q) || pkg.includes(q) || ut.includes(q);
		});
	}, [sectionsTabFilteredRows, sectionsTabSearch]);

	// ── Header (title + icon) — driven by active tab and section drill-down ──
	const header = (() => {
		if (isSectionDetail) {
			return {
				title: activeSection?.name ?? t`Section`,
				icon: BuildingsIcon,
			};
		}
		switch (activeTab) {
			case "overview":
				return { title: t`Overview`, icon: ChartBarIcon };
			case "inbox":
				return { title: t`Inbox`, icon: TrayIcon };
			case "sections":
				return { title: t`Sections`, icon: BuildingsIcon };
			case "students":
				return { title: t`Students`, icon: UsersIcon };
			case "checklists":
				return { title: t`Checklists`, icon: ListChecksIcon };
		}
	})();

	// ── Loading ────────────────────────────────────────────────────────────────
	if (isLoading) {
		return (
			<div className="space-y-6">
				<DashboardHeader icon={header.icon} title={header.title} />
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{[...Array(4)].map((_, i) => (
						<div key={i} className="rounded-2xl bg-white p-6 shadow-sm">
							<Skeleton className="mb-2 h-8 w-16" />
							<Skeleton className="h-4 w-24" />
						</div>
					))}
				</div>
			</div>
		);
	}

	const hasStudents = (dashboard?.students.length ?? 0) > 0;

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center rounded-2xl border-2 border-slate-200 border-dashed bg-white/50 p-12 text-center">
				<WarningIcon className="mb-4 size-12 text-amber-500 opacity-50" />
				<h3 className="font-bold text-lg text-slate-900">{t`Unable to load dashboard data`}</h3>
				<p className="mt-2 max-w-md text-slate-500 text-sm">
					{t`There was an error fetching student data. This might be due to missing database columns. Please ensure 'npm run db:push' has been executed.`}
				</p>
				<p className="mt-4 rounded border border-slate-100 bg-slate-50 p-2 font-mono text-slate-400 text-xs">
					{error.message}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<DashboardHeader icon={header.icon} title={header.title}>
				{activeTab === "checklists" && (
					<button
						type="button"
						onClick={() => setShowChecklistCreator(true)}
						className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-sm text-white transition-all hover:bg-indigo-700"
					>
						<ListChecksIcon weight="duotone" className="size-4" />
						{t`New Checklist`}
					</button>
				)}
			</DashboardHeader>

			{/* ══════════════════ OVERVIEW TAB ══════════════════ */}
			{activeTab === "overview" && (
				<div className="space-y-6">
					{/* Filter — above metrics */}
					{(filterPackages.length > 0 || filterUnitTypes.length > 0) && (
						<div className="rounded-2xl bg-white p-4 shadow-sm">
							<OrgUnitFilter
								packages={filterPackages}
								unitTypes={filterUnitTypes}
								allOrgUnits={filterAllOrgUnits}
								value={filter}
								onChange={(next) => {
									let updatedFilter = next;
									if (next.packageId !== filter.packageId) {
										updatedFilter = { packageId: next.packageId };
									}
									setFilter(updatedFilter);
									navigate({
										search: (prev: any) =>
											({
												...prev,
												...updatedFilter,
											}) as any,
									});
								}}
							/>
						</div>
					)}

					{/* ── Key Metrics ── */}
					<div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
						<StatCard
							icon={<UsersIcon weight="duotone" className="size-5" />}
							iconBg="bg-violet-50"
							iconColor="text-violet-600"
							label={t`Total Students`}
							value={stats.totalStudents}
							tooltip="Learners in your placement scope who also have a resume builder (Polymath) account — eng-labs and resume DB joined by email."
						/>
						<StatCard
							icon={<FileTextIcon weight="duotone" className="size-5" />}
							iconBg="bg-indigo-50"
							iconColor="text-indigo-600"
							label={t`With primary resume`}
							value={dashboard.aggregateStats.withPrimaryResume ?? stats.totalResumes}
							tooltip="How many enrolled students have created their primary resume document in the builder."
						/>
						<RateCard
							icon={<ChartBarIcon weight="duotone" className="size-5" />}
							iconBg="bg-blue-50"
							iconColor="text-blue-600"
							label={t`Primary resume rate`}
							value={
								dashboard.aggregateStats.primaryResumeRate ??
								(stats.totalStudents > 0 ? (detailedStats.withResumes / stats.totalStudents) * 100 : 0)
							}
							tooltip="Share of resume-builder enrollees who have a primary resume."
						/>
						<RateCard
							icon={<CheckCircleIcon weight="duotone" className="size-5" />}
							iconBg="bg-emerald-50"
							iconColor="text-emerald-600"
							label={t`Evaluation Rate`}
							value={detailedStats.withResumes > 0 ? (detailedStats.evaluated / detailedStats.withResumes) * 100 : 0}
							tooltip="Percentage of resumes evaluated from the total submitted resumes"
						/>
						<ScoreCard
							icon={<CheckCircleIcon weight="duotone" className="size-5" />}
							iconBg="bg-amber-50"
							iconColor="text-amber-600"
							label={t`Avg Score`}
							value={stats.averageScore}
						/>
						<AtsChecksCard />
					</div>

					{/* ── Breakdown + Charts ── */}
					<div className="grid gap-6 lg:grid-cols-3">
						{/* Left: compact breakdown counters */}
						<div className="flex flex-col gap-3">
							<h4 className="font-semibold text-slate-500 text-xs uppercase tracking-wider">{t`Submission Breakdown`}</h4>
							<DetailStatCard
								icon={<FileTextIcon weight="duotone" className="size-5 text-emerald-600" />}
								iconBg="bg-emerald-50"
								value={detailedStats.withResumes}
								label={t`With Resumes`}
							/>
							<DetailStatCard
								icon={<XCircleIcon weight="duotone" className="size-5 text-rose-500" />}
								iconBg="bg-rose-50"
								value={detailedStats.noResumes}
								label={t`No Resume Yet`}
							/>
							<DetailStatCard
								icon={<HourglassIcon weight="duotone" className="size-5 text-indigo-600" />}
								iconBg="bg-indigo-50"
								value={detailedStats.pendingReview}
								label={t`Pending Review`}
							/>
							<DetailStatCard
								icon={<CheckCircleIcon weight="duotone" className="size-5 text-emerald-600" />}
								iconBg="bg-emerald-50"
								value={detailedStats.evaluated}
								label={t`Verified / Evaluated`}
							/>
						</div>

						{/* Center: Donut chart */}
						<SubmissionDonutChart
							submitted={detailedStats.withResumes}
							notSubmitted={detailedStats.noResumes}
							total={stats.totalStudents}
						/>

						{/* Right: Score distribution */}
						<ScoreDistributionChart students={filteredStudents} evaluatedCount={detailedStats.evaluated} />
					</div>

					{/* Empty state */}
					{!hasStudents && (
						<div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 border-dashed bg-slate-50 py-12 text-center">
							<WarningIcon weight="duotone" className="mb-3 size-10 text-amber-400" />
							<p className="font-semibold text-slate-600">{t`No student data found`}</p>
							<p className="mt-1 max-w-xs text-slate-400 text-sm">
								No students found for the assigned sections. Ensure eng-labs is configured and students are enrolled.
							</p>
						</div>
					)}

					{/* Section Intelligence — PO / Admin only */}
					{scope !== "faculty" && dashboard && (
						<SectionIntelligence
							sections={dashboard.sections}
							students={filteredStudents}
							allOrgUnits={dashboard.allOrgUnits}
							onNavigateToTab={(tab, extraSearch) => {
								navigate({
									search: (prev: any) => ({ ...prev, tab, ...extraSearch }),
								});
							}}
						/>
					)}

					{/* ATS Score Improvements (admin/PO only) */}
					{scope !== "faculty" && <AtsImprovementsSection />}

					{/* Recent Activity */}
					{dashboard?.recentActivity && (
						<RecentActivity
							recentEvaluations={dashboard.recentActivity.recentEvaluations}
							recentComments={dashboard.recentActivity.recentComments}
						/>
					)}
				</div>
			)}

			{/* ══════════════════ INBOX TAB ══════════════════ */}
			{activeTab === "inbox" && (
				<InboxView
					scope={scope === "admin" ? "po" : scope}
					students={filteredStudents
						.filter((s) =>
							s.resumes.some((r) =>
								scope === "faculty"
									? r.reviewStatus === "SUBMITTED_TO_FACULTY"
									: r.reviewStatus === "SUBMITTED_TO_PO" || r.reviewStatus === "RESUBMITTED_TO_PO",
							),
						)
						.map((s) => ({
							...s,
							resumes: s.resumes.filter((r) =>
								scope === "faculty"
									? r.reviewStatus === "SUBMITTED_TO_FACULTY"
									: r.reviewStatus === "SUBMITTED_TO_PO" || r.reviewStatus === "RESUBMITTED_TO_PO",
							),
						}))}
					onReview={(resumeId, engLabsStudentId) => {
						navigate({
							to: "/dashboard/review/$resumeId",
							params: { resumeId },
							search: {
								engLabsStudentId,
								tenantId,
								packageId: filter.packageId,
								unitType: filter.unitType,
								unitId: filter.unitId,
								scope: (scope === "admin" ? "po" : scope) as "faculty" | "po",
							},
						});
					}}
				/>
			)}

			{/* ══════════════════ SECTION DETAIL (drill-down) ══════════════════ */}
			{activeTab === "sections" && sectionId && (
				<SectionStudentsPage
					section={activeSection}
					students={filteredStudents.filter((s) => s.sectionId === sectionId)}
					onBack={() => {
						navigate({
							search: (prev: any) => ({ ...prev, sectionId: undefined }),
						});
					}}
					onReview={(resumeId, engLabsStudentId) => {
						navigate({
							to: "/dashboard/review/$resumeId",
							params: { resumeId },
							search: {
								engLabsStudentId,
								tenantId,
								packageId: filter.packageId,
								unitType: filter.unitType,
								unitId: filter.unitId,
								sectionId,
								scope: (scope === "admin" ? "po" : scope) as "faculty" | "po",
							},
						});
					}}
					onStudentClick={(student) => setSelectedStudent(student)}
				/>
			)}

			{/* ══════════════════ SECTIONS TAB (grid) ══════════════════ */}
			{activeTab === "sections" && !sectionId && (
				<div className="space-y-6">
					{/* Package filter + search */}
					<div className="rounded-2xl bg-white p-4 shadow-sm">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
							{sectionsTabPackageOptions.length > 0 ? (
								<div className="flex flex-wrap items-center gap-3">
									<div className="flex items-center gap-1.5 text-slate-400 text-xs">
										<FunnelSimpleIcon weight="duotone" className="size-3.5" />
										<span className="font-medium">{t`Filters`}</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="font-medium text-slate-500 text-xs">{t`Package`}</span>
										<Combobox
											options={sectionsTabPackageOptions}
											value={filter.packageId ?? null}
											placeholder={t`All packages`}
											clearable={true}
											buttonProps={{ className: sectionsTabPackageDropdownClass }}
											onValueChange={(v) => {
												const updatedFilter: OrgUnitFilterValue = {
													packageId: v ?? undefined,
													unitType: undefined,
													unitId: undefined,
												};
												setFilter(updatedFilter);
												navigate({
													search: (prev: any) => ({ ...prev, ...updatedFilter }) as any,
												});
											}}
										/>
									</div>
								</div>
							) : null}
							<div
								className={cn(
									"relative min-w-[200px] flex-1",
									sectionsTabPackageOptions.length > 0 ? "lg:max-w-md" : "w-full",
								)}
							>
								<MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
								<input
									type="search"
									placeholder={t`Search sections by name, package, or type...`}
									value={sectionsTabSearch}
									onChange={(e) => setSectionsTabSearch(e.target.value)}
									className="h-10 w-full rounded-xl border-0 bg-slate-50 pr-4 pl-9 text-slate-900 text-sm outline-none ring-1 ring-slate-200 transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500"
									autoComplete="off"
								/>
							</div>
						</div>
					</div>

					{/* Level Selector */}
					{filterUnitTypes.length > 1 && (
						<div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
							<span className="font-bold text-slate-500 text-sm uppercase tracking-wider">{t`View by`}:</span>
							<div className="flex gap-2">
								{filterUnitTypes.map((type) => (
									<button
										key={type}
										type="button"
										onClick={() => setViewLevel(type)}
										className={cn(
											"rounded-lg px-3 py-1.5 font-bold text-xs transition-all",
											viewLevel === type || (!viewLevel && type === "CLASS")
												? "bg-indigo-600 text-white shadow-md"
												: "bg-slate-100 text-slate-500 hover:bg-slate-200",
										)}
									>
										{type}
									</button>
								))}
							</div>
						</div>
					)}

					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{sectionsTabDisplayRows.map((unit) => {
								const { stats } = unit;
								const totalResumes = stats.totalResumes;
								const verifiedResumes = stats.evaluatedResumes;

								const sectionStudents = dashboard?.students.filter((s) => s.sectionId === unit.id) || [];

								// Faculty: resumes eligible to submit to PO (FACULTY_VERIFIED or FINALIZED_BY_FACULTY for re-submission after PO feedback)
								const pendingResumesList = sectionStudents.flatMap((s) =>
									s.resumes
										.filter((r) => r.reviewStatus === "FACULTY_VERIFIED" || r.reviewStatus === "FINALIZED_BY_FACULTY")
										.map((r) => ({ id: r.id, studentId: s.engLabsId })),
								);

								// States that are "in PO hands" — faculty cannot submit or change these
								const PO_MANAGED = [
									"SUBMITTED_TO_PO",
									"PO_REVISION_REQUESTED",
									"RESUBMITTED_TO_PO",
									"PO_VERIFIED",
									"APPROVED",
								];

								// Resumes currently in PO-managed states
								const resumesInPOHands = sectionStudents.flatMap((s) =>
									s.resumes.filter((r) => PO_MANAGED.includes(r.reviewStatus ?? "")),
								);
								const isInPOHands = resumesInPOHands.length > 0;

								// PO: all resumes that are in any active PO-managed state (excluding APPROVED — those are done)
								const poSubmittedResumes = sectionStudents.flatMap((s) =>
									s.resumes
										.filter((r) => PO_MANAGED.includes(r.reviewStatus ?? "") && r.reviewStatus !== "APPROVED")
										.map((r) => ({ id: r.id, studentId: s.engLabsId })),
								);

								// Summary label for faculty when section is in PO hands
								const poHandsStatusLabel = (() => {
									if (resumesInPOHands.every((r) => r.reviewStatus === "APPROVED")) return "Approved";
									if (resumesInPOHands.some((r) => r.reviewStatus === "PO_REVISION_REQUESTED"))
										return "PO: Revision Requested";
									if (resumesInPOHands.some((r) => r.reviewStatus === "SUBMITTED_TO_PO")) return "Awaiting PO Review";
									return "With PO";
								})();

								return (
									<div
										key={unit.id}
										className="flex flex-col rounded-2xl bg-white p-5 shadow-sm transition-all hover:shadow-md"
									>
										<div className="mb-4 flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												<h3 className="line-clamp-1 font-bold text-lg text-slate-900">{unit.name}</h3>
												{unit.packageName ? (
													<p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{unit.packageName}</p>
												) : null}
											</div>
											<span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 font-bold text-[10px] text-slate-500 uppercase">
												{unit.unitType}
											</span>
										</div>

										<div className="mb-4 flex-1 space-y-3">
											<div className="flex justify-between text-xs">
												<span className="text-slate-500">{t`Verified Progress`}</span>
												<span className="font-bold text-slate-900">
													{verifiedResumes} / {totalResumes}
												</span>
											</div>
											<div className="h-2 overflow-hidden rounded-full bg-slate-100">
												<div
													className="h-full bg-emerald-500 text-[8px] transition-all"
													style={{ width: `${totalResumes > 0 ? (verifiedResumes / totalResumes) * 100 : 0}%` }}
												/>
											</div>
											<div className="flex justify-between text-[10px] text-slate-400 italic">
												<span>
													{t`Total Students`}: {stats.totalStudents}
												</span>
												{stats.averageScore && (
													<span>
														{t`Avg Score`}: {stats.averageScore.toFixed(1)}
													</span>
												)}
											</div>
										</div>

										{/* Review button */}
										<button
											type="button"
											onClick={() => {
												navigate({
													search: (prev: any) => ({ ...prev, tab: "sections", sectionId: unit.id }),
												});
											}}
											className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2 font-semibold text-indigo-700 text-sm transition-all hover:bg-indigo-100 active:scale-[0.98]"
										>
											<UsersIcon weight="duotone" className="size-4" />
											{t`Review Students`}
											<ArrowRightIcon weight="bold" className="size-3" />
										</button>

										{scope === "faculty" ? (
											<>
												{/* Show PO feedback banner if the section was returned with notes */}
												<POSectionFeedbackBanner sectionId={unit.id} tenantId={tenantId} />

												{isInPOHands ? (
													/* Read-only: section is currently with the PO — faculty cannot submit */
													<div className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 py-2.5 font-bold text-orange-600 text-sm">
														<CheckCircleIcon weight="fill" className="size-4" />
														{poHandsStatusLabel}
													</div>
												) : (
													<button
														type="button"
														disabled={pendingResumesList.length === 0 || bulkUpdateMutation.isPending}
														onClick={() => {
															bulkUpdateMutation.mutate({
																resumes: pendingResumesList,
																tenantId,
																status: "SUBMITTED_TO_PO",
															});
														}}
														className={cn(
															"mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-sm shadow-sm transition-all active:scale-[0.98]",
															pendingResumesList.length > 0
																? "bg-indigo-600 text-white hover:bg-indigo-700"
																: "cursor-not-allowed border border-slate-100 bg-slate-50 text-slate-400",
														)}
													>
														{pendingResumesList.length > 0 ? t`Submit Section to PO` : t`Verify All Resumes First`}
													</button>
												)}
											</>
										) : (
											<POSectionCardActions
												sectionId={unit.id}
												sectionName={unit.name}
												tenantId={tenantId}
												stats={stats as any}
												poSubmittedResumes={poSubmittedResumes}
												sectionStudents={sectionStudents}
												onOpenReviewDialog={() =>
													setPoReviewDialog({
														sectionId: unit.id,
														sectionName: unit.name,
														resumes: poSubmittedResumes,
													})
												}
												isPending={bulkUpdateMutation.isPending}
											/>
										)}
									</div>
								);
							})}
					</div>

					{sectionsTabDisplayRows.length === 0 && sectionsTabFilteredRows.length > 0 && (
						<div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 border-dashed bg-slate-50 py-12 text-center">
							<MagnifyingGlassIcon weight="duotone" className="mb-3 size-10 text-slate-300" />
							<p className="font-semibold text-slate-600">{t`No sections match your search`}</p>
							<p className="mt-1 max-w-sm text-slate-400 text-sm">
								{t`Try a different keyword or clear the search box.`}
							</p>
						</div>
					)}

					{sectionsTabFilteredRows.length === 0 && (dashboard?.sections ?? []).length > 0 && (
						<div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 border-dashed bg-slate-50 py-12 text-center">
							<WarningIcon weight="duotone" className="mb-3 size-10 text-amber-400" />
							<p className="font-semibold text-slate-600">{t`No sections match the current filters`}</p>
							<p className="mt-1 max-w-sm text-slate-400 text-sm">
								{t`Try clearing the package filter or pick a different unit type.`}
							</p>
						</div>
					)}
				</div>
			)}

			{/* ══════════════════ STUDENTS TAB ══════════════════ */}
			{activeTab === "students" && (
				<div className="space-y-5">
					{/* Filter */}
					{(filterPackages.length > 0 || filterUnitTypes.length > 0) && (
						<div className="rounded-2xl bg-white p-4 shadow-sm">
							<OrgUnitFilter
								packages={filterPackages}
								unitTypes={filterUnitTypes}
								allOrgUnits={filterAllOrgUnits}
								value={filter}
								onChange={(next) => {
									let updatedFilter = next;
									if (next.packageId !== filter.packageId) {
										updatedFilter = { packageId: next.packageId };
									}
									setFilter(updatedFilter);
									navigate({
										search: (prev: any) =>
											({
												...prev,
												...updatedFilter,
											}) as any,
									});
								}}
							/>
						</div>
					)}

					{!hasStudents ? (
						<div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 border-dashed bg-slate-50 py-12 text-center">
							<WarningIcon weight="duotone" className="mb-3 size-10 text-amber-400" />
							<p className="font-semibold text-slate-600">No student data found</p>
						</div>
					) : (
						<StudentResumeTable
							students={filteredStudents}
							onReview={(resumeId, engLabsStudentId) => {
								navigate({
									to: "/dashboard/review/$resumeId",
									params: { resumeId },
									search: {
										engLabsStudentId,
										tenantId,
										packageId: filter.packageId,
										unitType: filter.unitType,
										unitId: filter.unitId,
										scope: (scope === "admin" ? "po" : scope) as "faculty" | "po",
									},
								});
							}}
							onStudentClick={(student) => setSelectedStudent(student)}
						/>
					)}
				</div>
			)}

			{/* ══════════════════ CHECKLISTS TAB ══════════════════ */}
			{activeTab === "checklists" && (
				<ChecklistsTab tenantId={tenantId} onCreateNew={() => setShowChecklistCreator(true)} />
			)}

			{selectedStudent && (
				<StudentDetailPanel
					student={{
						engLabsId: selectedStudent.engLabsId,
						name: selectedStudent.name,
						email: selectedStudent.email,
						rollNumber: selectedStudent.rollNumber,
						sectionName: selectedStudent.sectionName,
						resumeAppUserId: selectedStudent.resumeAppUserId,
						resumes: selectedStudent.resumes,
					}}
					tenantId={tenantId}
					open={!!selectedStudent}
					onOpenChange={(open) => !open && setSelectedStudent(null)}
				/>
			)}
			<ChecklistCreator tenantId={tenantId} open={showChecklistCreator} onOpenChange={setShowChecklistCreator} />

			{/* ══════════════════ PO SECTION REVIEW DIALOG ══════════════════ */}
			{poReviewDialog && (
				<POSectionReviewDialog
					open={!!poReviewDialog}
					onClose={() => setPoReviewDialog(null)}
					sectionId={poReviewDialog.sectionId}
					sectionName={poReviewDialog.sectionName}
					tenantId={tenantId}
					resumes={poReviewDialog.resumes}
					onSuccess={() => {
						queryClient.invalidateQueries({
							queryKey: orpc.resume.dashboard.sections.queryOptions({
								input: { sectionIds, tenantId, scope: scope as any },
							}).queryKey as any,
						});
					}}
				/>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Submission Donut Chart (SVG)
// ---------------------------------------------------------------------------

function SubmissionDonutChart({
	submitted,
	notSubmitted,
	total,
}: {
	submitted: number;
	notSubmitted: number;
	total: number;
}) {
	const [hovered, setHovered] = useState<"submitted" | "notSubmitted" | null>(null);

	if (total === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-2xl bg-white p-6 shadow-sm">
				<h4 className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Resume Submission</h4>
				<p className="mt-6 text-slate-400 text-sm">No data available yet</p>
			</div>
		);
	}

	const submittedPct = (submitted / total) * 100;
	const notSubmittedPct = (notSubmitted / total) * 100;

	const R = 64;
	const STROKE = 20;
	const C = 2 * Math.PI * R;
	const submittedArc = (submitted / total) * C;
	const notSubmittedArc = C - submittedArc;

	return (
		<div className="flex flex-col rounded-2xl bg-white p-6 shadow-sm">
			<h4 className="mb-2 font-semibold text-slate-500 text-xs uppercase tracking-wider">Resume Submission</h4>
			<div className="flex flex-1 flex-col items-center justify-center">
				<div className="relative">
					<svg width="170" height="170" viewBox="0 0 170 170">
						<circle
							cx="85"
							cy="85"
							r={R}
							fill="none"
							stroke="#E24B4A"
							strokeWidth={STROKE}
							strokeDasharray={`${notSubmittedArc} ${C}`}
							strokeDashoffset={0}
							transform="rotate(-90 85 85)"
							opacity={hovered === "submitted" ? 0.35 : 1}
							onMouseEnter={() => setHovered("notSubmitted")}
							onMouseLeave={() => setHovered(null)}
							style={{ transition: "opacity 0.3s" }}
						/>
						<circle
							cx="85"
							cy="85"
							r={R}
							fill="none"
							stroke="#1D9E75"
							strokeWidth={STROKE}
							strokeDasharray={`${submittedArc} ${C}`}
							strokeDashoffset={-notSubmittedArc}
							transform="rotate(-90 85 85)"
							opacity={hovered === "notSubmitted" ? 0.35 : 1}
							onMouseEnter={() => setHovered("submitted")}
							onMouseLeave={() => setHovered(null)}
							style={{ transition: "opacity 0.3s" }}
						/>
						<text x="85" y="80" textAnchor="middle" className="fill-slate-900" fontSize="26" fontWeight="700">
							{total}
						</text>
						<text x="85" y="98" textAnchor="middle" className="fill-slate-400" fontSize="11">
							students
						</text>
					</svg>

					{hovered && (
						<div
							className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-white text-xs shadow-lg"
							style={{ backgroundColor: "#1a3a5c", marginTop: -48 }}
						>
							{hovered === "submitted"
								? `Submitted: ${submitted} (${submittedPct.toFixed(1)}%)`
								: `Not submitted: ${notSubmitted} (${notSubmittedPct.toFixed(1)}%)`}
						</div>
					)}
				</div>
			</div>
			<div className="mt-auto flex items-center justify-center gap-5 pt-3 text-xs">
				<div className="flex items-center gap-1.5">
					<div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#1D9E75" }} />
					<span className="text-slate-600">Submitted ({submitted})</span>
				</div>
				<div className="flex items-center gap-1.5">
					<div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#E24B4A" }} />
					<span className="text-slate-600">Not Submitted ({notSubmitted})</span>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Score Distribution Bar Chart (SVG)
// ---------------------------------------------------------------------------

function ScoreDistributionChart({
	students,
	evaluatedCount,
}: {
	students: StudentWithResumes[];
	evaluatedCount: number;
}) {
	const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

	const buckets = [
		{ label: "0-1", color: "#E24B4A", min: 0, max: 1 },
		{ label: "1-2", color: "#EF9F27", min: 1, max: 2 },
		{ label: "2-3", color: "#FAC775", min: 2, max: 3 },
		{ label: "3-4", color: "#9FE1CB", min: 3, max: 4 },
		{ label: "4-5", color: "#1D9E75", min: 4, max: 5 },
	];

	const scores = students.flatMap((s) =>
		s.resumes.filter((r) => r.evaluationScore !== null).map((r) => r.evaluationScore as number),
	);

	const counts = buckets.map((b) => scores.filter((s) => s >= b.min && (b.max === 5 ? s <= b.max : s < b.max)).length);
	const max = Math.max(...counts, 1);

	if (evaluatedCount === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-2xl bg-white p-6 shadow-sm">
				<h4 className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Score Distribution</h4>
				<p className="mt-6 text-slate-400 text-sm">No data available yet</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col rounded-2xl bg-white p-6 shadow-sm">
			<h4 className="mb-2 font-semibold text-slate-500 text-xs uppercase tracking-wider">Score Distribution</h4>
			<div className="flex flex-1 items-end justify-center gap-2 pt-4 pb-2">
				{buckets.map((b, i) => {
					const heightPct = Math.max(6, (counts[i] / max) * 100);
					return (
						<div
							key={b.label}
							className="flex flex-1 flex-col items-center gap-1"
							onMouseEnter={() => setHoveredIdx(i)}
							onMouseLeave={() => setHoveredIdx(null)}
						>
							<span className="font-semibold text-[11px] text-slate-500 tabular-nums">
								{counts[i] > 0 ? counts[i] : ""}
							</span>
							<div className="flex w-full justify-center" style={{ height: 110 }}>
								<div
									className="w-full max-w-[36px] self-end rounded-t-md transition-all"
									style={{
										height: `${heightPct}%`,
										backgroundColor: b.color,
										opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.35 : 1,
									}}
								/>
							</div>
							<span className="font-medium text-[11px] text-slate-500">{b.label}</span>
						</div>
					);
				})}
			</div>
			<p className="mt-auto pt-2 text-center text-slate-400 text-xs">
				Based on {evaluatedCount} evaluated resume{evaluatedCount !== 1 ? "s" : ""}
			</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// ATS Checks Card — queries ATS admin stats for the total checks count
// ---------------------------------------------------------------------------

function AtsChecksCard() {
	const { data: atsStats } = useQuery(orpc.ats.adminStats.queryOptions({ input: {} }));

	return (
		<StatCard
			icon={<TargetIcon weight="duotone" className="size-5" />}
			iconBg="bg-blue-50"
			iconColor="text-blue-600"
			label={t`ATS Checks`}
			value={atsStats?.totalChecks ?? 0}
			tooltip="Total number of ATS checks done by the students"
		/>
	);
}

// ---------------------------------------------------------------------------
// Section Students page — full-page drill-down for a single section
// ---------------------------------------------------------------------------

type SectionStudentsPageProps = {
	section?: {
		id: string;
		name: string;
		unitType: string;
		stats: {
			totalStudents: number;
			totalResumes: number;
			evaluatedResumes: number;
			averageScore: number | null;
		};
	};
	students: StudentWithResumes[];
	onBack: () => void;
	onReview: (resumeId: string, engLabsStudentId: string) => void;
	onStudentClick: (student: StudentWithResumes) => void;
};

function SectionStudentsPage({ section, students, onBack, onReview, onStudentClick }: SectionStudentsPageProps) {
	if (!section) {
		return (
			<div className="space-y-6">
				<button
					type="button"
					onClick={onBack}
					className="flex items-center gap-2 font-semibold text-slate-500 text-sm transition-colors hover:text-indigo-600"
				>
					<ArrowLeftIcon weight="bold" className="size-4" />
					{t`Back to Sections`}
				</button>
				<div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 border-dashed bg-slate-50 py-12 text-center">
					<WarningIcon weight="duotone" className="mb-3 size-10 text-amber-400" />
					<p className="font-semibold text-slate-600">{t`Section not found`}</p>
				</div>
			</div>
		);
	}

	const { stats } = section;
	const withResumes = students.filter((s) => s.resumes.length > 0).length;
	const noResumes = students.length - withResumes;
	const verifiedPct = stats.totalResumes > 0 ? (stats.evaluatedResumes / stats.totalResumes) * 100 : 0;

	return (
		<div className="space-y-6">
			{/* Breadcrumb / back */}
			<button
				type="button"
				onClick={onBack}
				className="flex items-center gap-2 font-semibold text-slate-500 text-sm transition-colors hover:text-indigo-600"
			>
				<ArrowLeftIcon weight="bold" className="size-4" />
				{t`Back to Sections`}
			</button>

			{/* Highlights */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					icon={<UsersIcon weight="duotone" className="size-5" />}
					iconBg="bg-violet-50"
					iconColor="text-violet-600"
					label={t`Total Students`}
					value={stats.totalStudents}
				/>
				<StatCard
					icon={<FileTextIcon weight="duotone" className="size-5" />}
					iconBg="bg-emerald-50"
					iconColor="text-emerald-600"
					label={t`With Resumes`}
					value={withResumes}
					tooltip={t`Students who have created at least one resume`}
				/>
				<StatCard
					icon={<XCircleIcon weight="duotone" className="size-5" />}
					iconBg="bg-rose-50"
					iconColor="text-rose-600"
					label={t`No Resume Yet`}
					value={noResumes}
				/>
				<ScoreCard
					icon={<CheckCircleIcon weight="duotone" className="size-5" />}
					iconBg="bg-amber-50"
					iconColor="text-amber-600"
					label={t`Avg Score`}
					value={stats.averageScore}
				/>
			</div>

			{/* Verified progress bar */}
			<div className="rounded-2xl bg-white p-5 shadow-sm">
				<div className="mb-2 flex items-center justify-between">
					<div>
						<p className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">{t`Verified Progress`}</p>
						<p className="mt-1 font-bold text-slate-900 text-sm">
							{stats.evaluatedResumes} / {stats.totalResumes} {t`resumes verified`}
						</p>
					</div>
					<span className="font-bold text-emerald-600 text-sm tabular-nums">{verifiedPct.toFixed(0)}%</span>
				</div>
				<div className="h-2 overflow-hidden rounded-full bg-slate-100">
					<div className="h-full bg-emerald-500 transition-all" style={{ width: `${verifiedPct}%` }} />
				</div>
			</div>

			{/* Students table */}
			{students.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 border-dashed bg-slate-50 py-12 text-center">
					<WarningIcon weight="duotone" className="mb-3 size-10 text-amber-400" />
					<p className="font-semibold text-slate-600">{t`No students in this section`}</p>
				</div>
			) : (
				<StudentResumeTable students={students} onReview={onReview} onStudentClick={onStudentClick} />
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// ATS Improvements section — shown in the admin/PO overview tab
// ---------------------------------------------------------------------------

function AtsImprovementsSection() {
	return (
		<div className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
			<div className="flex items-center gap-2">
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="size-4 text-green-600"
						viewBox="0 0 256 256"
						fill="currentColor"
					>
						<path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16H224A8,8,0,0,1,232,208ZM48,168a8,8,0,0,0,8-8V128a8,8,0,0,0-16,0v32A8,8,0,0,0,48,168Zm40,0a8,8,0,0,0,8-8V80a8,8,0,0,0-16,0v80A8,8,0,0,0,88,168Zm40,0a8,8,0,0,0,8-8V104a8,8,0,0,0-16,0v56A8,8,0,0,0,128,168Zm40,0a8,8,0,0,0,8-8V56a8,8,0,0,0-16,0v104A8,8,0,0,0,168,168Z" />
					</svg>
				</div>
				<div>
					<h3 className="font-semibold text-slate-900 text-sm">ATS Score Improvements</h3>
					<p className="text-slate-500 text-xs">Platform-wide ATS scoring activity and improvement trends</p>
				</div>
			</div>
			<AdminAtsStats />
		</div>
	);
}
