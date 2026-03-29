import { t } from "@lingui/core/macro";
import {
	ChartBarIcon,
	CheckCircleIcon,
	FileTextIcon,
	HourglassIcon,
	ListChecksIcon,
	UsersIcon,
	WarningIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/integrations/orpc/client";
import { ChecklistCreator } from "./checklist-creator";
import { ChecklistsTab } from "./checklists-tab";
import type { OrgUnitFilterValue } from "./org-unit-filter";
import { OrgUnitFilter } from "./org-unit-filter";
import { RecentActivity } from "./recent-activity";
import { CompletionRateCard, ScoreCard, StatCard } from "./stat-card";
import { StudentDetailPanel } from "./student-detail-panel";
import type { StudentWithResumes } from "./student-resume-table";
import { StudentResumeTable } from "./student-resume-table";

export type DashboardTab = "overview" | "students" | "checklists";

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

	useEffect(() => {
		setFilter(initialFilter);
	}, [initialFilter]);
const [selectedStudent, setSelectedStudent] = useState<StudentWithResumes | null>(null);
	const [showChecklistCreator, setShowChecklistCreator] = useState(false);

const { data: dashboard, isLoading } = useQuery(
		orpc.resume.dashboard.sections.queryOptions({
			input: {
				sectionIds,
				tenantId,
				scope: scope === "admin" ? "po" : scope,
				activeUnitId: filter.unitId,
			},
		}),
	);

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

	return (
		<div className="space-y-6">
			{title && (
				<div className="flex items-center justify-between">
					<h2 className="font-bold text-slate-900 text-xl">{title}</h2>
				</div>
			)}

			{/* Checklist create button shown when on checklists view */}
			{activeTab === "checklists" && (
				<div className="flex justify-end">
					<button
						type="button"
						onClick={() => setShowChecklistCreator(true)}
						className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-sm text-white transition-all hover:bg-indigo-700"
					>
						<ListChecksIcon weight="duotone" className="size-4" />
						{t`New Checklist`}
					</button>
				</div>
			)}

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
								<p className="text-slate-500 text-xs">With Resumes</p>
							</div>
						</div>
						<div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50">
								<XCircleIcon weight="duotone" className="size-5 text-rose-500" />
							</div>
							<div>
								<p className="font-bold text-slate-900 text-xl">{detailedStats.noResumes}</p>
								<p className="text-slate-500 text-xs">No Resume Yet</p>
							</div>
						</div>
						<div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
								<HourglassIcon weight="duotone" className="size-5 text-indigo-600" />
							</div>
							<div>
								<p className="font-bold text-slate-900 text-xl">{detailedStats.pendingReview}</p>
								<p className="text-slate-500 text-xs">Pending Review</p>
							</div>
						</div>
						<div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
								<CheckCircleIcon weight="duotone" className="size-5 text-emerald-600" />
							</div>
							<div>
								<p className="font-bold text-slate-900 text-xl">{detailedStats.evaluated}</p>
								<p className="text-slate-500 text-xs">Verified / Evaluated</p>
							</div>
						</div>
					</div>

					{/* Empty state */}
					{!hasStudents && (
						<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
							<WarningIcon weight="duotone" className="mb-3 size-10 text-amber-400" />
							<p className="font-semibold text-slate-600">No student data found</p>
							<p className="mt-1 max-w-xs text-slate-400 text-sm">
								No students found for the assigned sections. Ensure eng-labs is configured and students are enrolled.
							</p>
						</div>
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
		</div>
	);
}
