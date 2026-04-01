import { t } from "@lingui/core/macro";
import {
	ArrowRightIcon,
	ChartBarIcon,
	CheckCircleIcon,
	FileTextIcon,
	HourglassIcon,
	ListChecksIcon,
	UsersIcon,
	WarningIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { ChecklistCreator } from "./checklist-creator";
import { ChecklistsTab } from "./checklists-tab";
import { InboxView } from "./inbox-view";
import type { OrgUnitFilterValue } from "./org-unit-filter";
import { SectionIntelligence } from "./section-intelligence";
import { OrgUnitFilter } from "./org-unit-filter";
import { RecentActivity } from "./recent-activity";
import { CompletionRateCard, ScoreCard, StatCard } from "./stat-card";
import { StudentDetailPanel } from "./student-detail-panel";
import type { StudentWithResumes } from "./student-resume-table";
import { StudentResumeTable } from "./student-resume-table";

export type DashboardTab = "overview" | "inbox" | "sections" | "students" | "checklists";

type SectionMetricsViewProps = {
	scope: "faculty" | "po" | "admin";
	sectionIds: string[];
	tenantId: string;
	title: string;
	initialTab?: DashboardTab;
	initialFilter?: OrgUnitFilterValue;
};

export function SectionMetricsView({
	scope,
	sectionIds,
	tenantId,
	title,
	initialTab = "overview",
	initialFilter = {},
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
	const [reviewSection, setReviewSection] = useState<{ id: string; name: string; unitType: string } | null>(null);

	const { data: dashboard, isLoading, error } = useQuery(
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
				queryKey: orpc.resume.dashboard.sections.queryOptions({ input: { sectionIds, tenantId, scope: scope as any } }).queryKey as any
			});
		},
	});

	// ── Derived stats ──────────────────────────────────────────────────────────
	const stats = useMemo(() => {
		if (!dashboard) return { totalStudents: 0, totalResumes: 0, completionRate: 0, averageScore: null as number | null };
		return dashboard.aggregateStats;
	}, [dashboard]);

	const detailedStats = useMemo(() => {
		if (!dashboard) return { withResumes: 0, noResumes: 0, pendingReview: 0, evaluated: 0, submitted: 0 };
		const students = dashboard.students;
		const withResumes = students.filter((s) => s.resumes.length > 0).length;
		const noResumes = students.length - withResumes;
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

	// ── Loading ────────────────────────────────────────────────────────────────
	if (isLoading) {
		return (
			<div className="space-y-6">
				{title && <h2 className="font-bold text-slate-900 text-xl">{title}</h2>}
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
			<div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-12 text-center">
				<WarningIcon className="mb-4 size-12 text-amber-500 opacity-50" />
				<h3 className="font-bold text-slate-900 text-lg">{t`Unable to load dashboard data`}</h3>
				<p className="mt-2 max-w-md text-slate-500 text-sm">
					{t`There was an error fetching student data. This might be due to missing database columns. Please ensure 'npm run db:push' has been executed.`}
				</p>
				<p className="mt-4 text-xs text-slate-400 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
					{error.message}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{title && (
				<div className="flex items-center justify-between">
					<h2 className="font-bold text-slate-900 text-xl">{title}</h2>
				</div>
			)}

			{/* Layout adjusted to handle sidebar-only navigation */}
			<div className="flex items-center justify-between">
				<div />

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
			</div>

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

					{/* Primary stat row */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<StatCard
							icon={<UsersIcon weight="duotone" className="size-5" />}
							iconBg="bg-violet-50"
							iconColor="text-violet-600"
							label={t`Total Students`}
							value={stats.totalStudents}
						/>
						<StatCard
							icon={<FileTextIcon weight="duotone" className="size-5" />}
							iconBg="bg-indigo-50"
							iconColor="text-indigo-600"
							label={t`Total Resumes`}
							value={stats.totalResumes}
						/>
						<CompletionRateCard
							icon={<ChartBarIcon weight="duotone" className="size-5" />}
							iconBg="bg-blue-50"
							iconColor="text-blue-600"
							label={t`Completion Rate`}
							value={stats.completionRate}
						/>
						<ScoreCard
							icon={<CheckCircleIcon weight="duotone" className="size-5" />}
							iconBg="bg-amber-50"
							iconColor="text-amber-600"
							label={t`Avg Score`}
							value={stats.averageScore}
						/>
					</div>

					{/* Submission breakdown */}
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
								<FileTextIcon weight="duotone" className="size-5 text-emerald-600" />
							</div>
							<div>
								<p className="font-bold text-slate-900 text-xl">{detailedStats.withResumes}</p>
								<p className="text-slate-500 text-xs">{t`With Resumes`}</p>
							</div>
						</div>
						<div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50">
								<XCircleIcon weight="duotone" className="size-5 text-rose-500" />
							</div>
							<div>
								<p className="font-bold text-slate-900 text-xl">{detailedStats.noResumes}</p>
								<p className="text-slate-500 text-xs">{t`No Resume Yet`}</p>
							</div>
						</div>
						<div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
								<HourglassIcon weight="duotone" className="size-5 text-indigo-600" />
							</div>
							<div>
								<p className="font-bold text-slate-900 text-xl">{detailedStats.pendingReview}</p>
								<p className="text-slate-500 text-xs">{t`Pending Review`}</p>
							</div>
						</div>
						<div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
								<CheckCircleIcon weight="duotone" className="size-5 text-emerald-600" />
							</div>
							<div>
								<p className="font-bold text-slate-900 text-xl">{detailedStats.evaluated}</p>
								<p className="text-slate-500 text-xs">{t`Verified / Evaluated`}</p>
							</div>
						</div>
					</div>

					{/* Empty state */}
					{!hasStudents && (
						<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
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
									: r.reviewStatus === "FINALIZED_BY_FACULTY" || r.reviewStatus === "RESUBMITTED_TO_PO",
							),
						)
						.map((s) => ({
							...s,
							resumes: s.resumes.filter((r) =>
								scope === "faculty"
									? r.reviewStatus === "SUBMITTED_TO_FACULTY"
									: r.reviewStatus === "FINALIZED_BY_FACULTY" || r.reviewStatus === "RESUBMITTED_TO_PO",
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

			{/* ══════════════════ SECTIONS TAB ══════════════════ */}
			{activeTab === "sections" && (
				<div className="space-y-6">
					{/* Level Selector */}
					{filterUnitTypes.length > 1 && (
						<div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
							<span className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t`View by`}:</span>
							<div className="flex gap-2">
								{filterUnitTypes.map((type) => (
									<button
										key={type}
										type="button"
										onClick={() => setViewLevel(type)}
										className={cn(
											"rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
											(viewLevel === type || (!viewLevel && type === "CLASS"))
												? "bg-indigo-600 text-white shadow-md"
												: "bg-slate-100 text-slate-500 hover:bg-slate-200"
										)}
									>
										{type}
									</button>
								))}
							</div>
						</div>
					)}

					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{(dashboard?.sections ?? [])
							.filter(s => s.unitType === (viewLevel || (filterUnitTypes.includes("CLASS") ? "CLASS" : filterUnitTypes[0])))
							.map((unit) => {
								const { stats } = unit;
								const totalResumes = stats.totalResumes;
								const verifiedResumes = stats.evaluatedResumes;
								const finalizedResumes = stats.submittedResumes;
								
								const isFullyVerified = totalResumes > 0 && verifiedResumes >= totalResumes;
								const isAlreadyFinalized = totalResumes > 0 && finalizedResumes >= totalResumes;

								// Only for Faculty: we need the list of resumes for bulk submission
								// (PO doesn't need to bulk-submit to themselves)
								const sectionStudents = dashboard?.students.filter(s => s.sectionId === unit.id) || [];
								const pendingResumesList = sectionStudents.flatMap(s => s.resumes.filter(r => r.reviewStatus === "FACULTY_VERIFIED").map(r => ({ id: r.id, studentId: s.engLabsId })));

								return (
									<div key={unit.id} className="flex flex-col rounded-2xl bg-white p-5 shadow-sm transition-all hover:shadow-md">
										<div className="mb-4 flex items-center justify-between">
											<h3 className="font-bold text-slate-900 text-lg line-clamp-1">{unit.name}</h3>
											<span className="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-500 text-[10px] uppercase">
												{unit.unitType}
											</span>
										</div>

										<div className="mb-4 space-y-3 flex-1">
											<div className="flex justify-between text-xs">
												<span className="text-slate-500">{t`Verified Progress`}</span>
												<span className="font-bold text-slate-900">{verifiedResumes} / {totalResumes}</span>
											</div>
											<div className="h-2 overflow-hidden rounded-full bg-slate-100">
												<div
													className="h-full bg-emerald-500 transition-all text-[8px]"
													style={{ width: `${totalResumes > 0 ? (verifiedResumes / totalResumes) * 100 : 0}%` }}
												/>
											</div>
											<div className="flex justify-between text-[10px] text-slate-400 italic">
												<span>{t`Total Students`}: {stats.totalStudents}</span>
												{stats.averageScore && <span>{t`Avg Score`}: {stats.averageScore.toFixed(1)}</span>}
											</div>
										</div>

										{/* Review button */}
										<button
											type="button"
											onClick={() => setReviewSection({ id: unit.id, name: unit.name, unitType: unit.unitType })}
											className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 py-2 font-semibold text-indigo-700 text-sm transition-all hover:bg-indigo-100 active:scale-[0.98]"
										>
											<UsersIcon weight="duotone" className="size-4" />
											{t`Review Students`}
											<ArrowRightIcon weight="bold" className="size-3" />
										</button>

										{scope === "faculty" ? (
											<button
												type="button"
												disabled={!isFullyVerified || isAlreadyFinalized || bulkUpdateMutation.isPending}
												onClick={() => {
													bulkUpdateMutation.mutate({
														resumes: pendingResumesList,
														tenantId,
														status: "FINALIZED_BY_FACULTY",
													});
												}}
												className={cn(
													"flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-sm transition-all shadow-sm active:scale-[0.98]",
													isFullyVerified && !isAlreadyFinalized
														? "bg-indigo-600 text-white hover:bg-indigo-700"
														: isAlreadyFinalized 
															? "bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default"
															: "bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed"
												)}
											>
												{isAlreadyFinalized ? (
													<>
														<CheckCircleIcon weight="fill" className="size-4" />
														{t`Submitted to PO`}
													</>
												) : isFullyVerified ? (
													t`Submit Section to PO`
												) : (
													t`Verify All Resumes First`
												)}
											</button>
										) : (
											<button
												type="button"
												disabled={((stats as any).poVerifiedResumes ?? 0) + stats.approvedResumes < stats.totalResumes || stats.approvedResumes === stats.totalResumes || bulkUpdateMutation.isPending}
												onClick={() => {
													const poPendingList = sectionStudents.flatMap(s => s.resumes.filter(r => r.reviewStatus === "PO_VERIFIED" || r.reviewStatus === "FINALIZED_BY_FACULTY" || r.reviewStatus === "RESUBMITTED_TO_PO").map(r => ({ id: r.id, studentId: s.engLabsId })));
													bulkUpdateMutation.mutate({
														resumes: poPendingList,
														tenantId,
														status: "APPROVED",
													});
												}}
												className={cn(
													"flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-sm transition-all shadow-sm active:scale-[0.98]",
													((stats as any).poVerifiedResumes ?? 0) + stats.approvedResumes >= stats.totalResumes && stats.approvedResumes < stats.totalResumes && stats.totalResumes > 0
														? "bg-indigo-600 text-white hover:bg-indigo-700"
														: stats.approvedResumes === stats.totalResumes && stats.totalResumes > 0
															? "bg-emerald-50 text-emerald-600 border border-emerald-100 cursor-default"
															: (stats as any).passedFaculty === stats.totalResumes && stats.totalResumes > 0
																? "bg-amber-50 text-amber-600 border border-amber-200 cursor-help"
																: "bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed"
												)}
											>
												{stats.approvedResumes === stats.totalResumes && stats.totalResumes > 0 ? (
													<>
														<CheckCircleIcon weight="fill" className="size-4" />
														{t`Approved for Placement`}
													</>
												) : ((stats as any).poVerifiedResumes ?? 0) + stats.approvedResumes >= stats.totalResumes ? (
													t`Approve for Placement`
												) : ((stats as any).poVerifiedResumes ?? 0) > 0 ? (
													t`Verify All (${(stats as any).poVerifiedResumes} / ${stats.totalResumes - stats.approvedResumes}) First`
												) : (stats as any).passedFaculty === stats.totalResumes ? (
													t`Ready for PO Review`
												) : (
													t`Waiting for Faculty`
												)}
											</button>
										)}
									</div>
								);
							})}
					</div>
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
						<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
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

			{/* ══════════════════ SECTION DRILL-DOWN PANEL ══════════════════ */}
			<Sheet open={!!reviewSection} onOpenChange={(open) => !open && setReviewSection(null)}>
				<SheetContent side="right" className="flex w-full max-w-2xl flex-col overflow-hidden p-0">
					<SheetHeader className="border-b px-6 py-4">
						<div className="flex items-center justify-between">
							<div>
								<SheetTitle className="text-lg font-bold text-slate-900">
									{reviewSection?.name}
								</SheetTitle>
								<span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
									{reviewSection?.unitType}
								</span>
							</div>
							<span className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
								{reviewSection
									? filteredStudents.filter((s) => s.sectionId === reviewSection.id).length
									: 0}{" "}
								{t`students`}
							</span>
						</div>
					</SheetHeader>

					<div className="flex-1 overflow-y-auto px-6 py-4">
						{reviewSection && (
							<StudentResumeTable
								students={filteredStudents.filter((s) => s.sectionId === reviewSection.id)}
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
										},
									});
									setReviewSection(null);
								}}
								onStudentClick={(student) => {
									setSelectedStudent(student);
									setReviewSection(null);
								}}
							/>
						)}
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
