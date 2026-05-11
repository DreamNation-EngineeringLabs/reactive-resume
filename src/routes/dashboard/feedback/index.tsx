import { t } from "@lingui/core/macro";
import {
	ArrowSquareOutIcon,
	BookOpenIcon,
	CaretDownIcon,
	ChartLineIcon,
	CheckCircleIcon,
	FileTextIcon,
	ListChecksIcon,
	PaperPlaneTiltIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/integrations/orpc/client";
import { getEngLabsUserId, getTenantId } from "@/utils/sso-context";
import { cn } from "@/utils/style";
import { ChecklistsTab } from "../-components/checklists-tab";
import { DashboardHeader } from "../-components/header";
import { getEvaluationBadgeClass } from "../-components/score-helpers";
import { ScoreCard, StatCard } from "../-components/stat-card";

export const Route = createFileRoute("/dashboard/feedback/")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
	},
	// Prefetch the student feedback dashboard on the server. The query input mirrors the initial
	// useQuery shape in RouteComponent before its useEffect populates engLabsUserId from localStorage
	// — `engLabsUserId: undefined` matches on the first render, and the server-side handler resolves
	// the student from the authenticated user's email anyway. See admin/index.tsx for the broader
	// rationale around SSR suspension + Cloud Run streaming.
	loader: async ({ context }) => {
		const userId = context.session?.user?.id;
		if (!userId) return;
		try {
			await context.queryClient.prefetchQuery(
				orpc.resume.dashboard.student.queryOptions({
					input: { userId, engLabsUserId: undefined },
				}),
			);
		} catch {
			// non-fatal
		}
	},
});

type FeedbackTab = "overview" | "checklists";

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const [expandedResumeId, setExpandedResumeId] = useState<string | null>(null);
	const [engLabsUserId, setEngLabsUserId] = useState<string | null>(null);
	const [tenantId, setTenantId] = useState<string>("default");
	const [activeTab, setActiveTab] = useState<FeedbackTab>("overview");

	useEffect(() => {
		setEngLabsUserId(getEngLabsUserId());
		setTenantId(getTenantId() ?? "default");
	}, []);

	const { data: dashboard, isLoading } = useQuery(
		orpc.resume.dashboard.student.queryOptions({
			input: {
				userId: session?.user?.id ?? "",
				engLabsUserId: engLabsUserId ?? undefined,
			},
		}),
	);

	const stats = useMemo(() => {
		if (!dashboard)
			return { totalResumes: 0, withFeedback: 0, totalComments: 0, evaluationsReceived: 0, averageScore: null };
		return dashboard.stats;
	}, [dashboard]);

	if (isLoading) {
		return (
			<div className="space-y-8">
				<DashboardHeader icon={ChartLineIcon} title={t`Feedback Summary`} />
				<div className="grid gap-4 md:grid-cols-3">
					{[...Array(3)].map((_, i) => (
						<div key={i} className="rounded-2xl bg-white p-6 shadow-sm">
							<Skeleton className="mb-2 h-8 w-16" />
							<Skeleton className="h-4 w-24" />
						</div>
					))}
				</div>
			</div>
		);
	}

	const enrollment = dashboard?.enrollment;

	const tabs: { id: FeedbackTab; icon: React.ReactNode; label: string }[] = [
		{ id: "overview", icon: <ChartLineIcon weight="duotone" className="size-4" />, label: t`Overview` },
		{ id: "checklists", icon: <ListChecksIcon weight="duotone" className="size-4" />, label: t`Checklists` },
	];

	return (
		<div className="space-y-8">
			<DashboardHeader icon={ChartLineIcon} title={t`Feedback Summary`} />

			{/* Tab bar */}
			<div className="flex gap-1 border-slate-100 border-b">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={cn(
							"flex items-center gap-2 border-b-2 px-4 py-3 font-semibold text-sm transition-all",
							activeTab === tab.id
								? "border-indigo-600 text-indigo-600"
								: "border-transparent text-slate-500 hover:text-slate-700",
						)}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>

			{activeTab === "checklists" && <ChecklistsTab tenantId={tenantId} onCreateNew={() => {}} />}

			{activeTab === "overview" && (
				<div className="space-y-8">
					{/* Enrollment context banner */}
					{enrollment && (
						<div className="flex flex-wrap items-center gap-3 rounded-2xl bg-indigo-50 px-5 py-3">
							<BookOpenIcon weight="duotone" className="size-5 shrink-0 text-indigo-500" />
							<div className="flex flex-wrap gap-2">
								{enrollment.parentName && (
									<span className="flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-800 text-xs">
										<span className="text-[10px] text-indigo-400 uppercase tracking-widest">Package</span>
										{enrollment.parentName}
									</span>
								)}
								<span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold text-indigo-700 text-xs shadow-sm">
									<span className="text-[10px] text-indigo-400 uppercase tracking-widest">
										{enrollment.unitType.charAt(0) + enrollment.unitType.slice(1).toLowerCase()}
									</span>
									{enrollment.unitName}
								</span>
							</div>
						</div>
					)}

					{/* Stats Cards */}
					<div className="grid gap-4 md:grid-cols-3">
						<StatCard
							label={t`My Resumes`}
							value={stats.totalResumes}
							iconBg="bg-indigo-50"
							iconColor="text-indigo-600"
							icon={<FileTextIcon weight="duotone" className="size-5" />}
						/>
						<StatCard
							label={t`Feedback Received`}
							value={stats.totalComments}
							iconBg="bg-sky-50"
							iconColor="text-sky-600"
							icon={<ChartLineIcon weight="duotone" className="size-5" />}
						/>
						<ScoreCard
							label={t`Average Score`}
							value={stats.averageScore}
							iconBg="bg-emerald-50"
							iconColor="text-emerald-600"
							icon={<CheckCircleIcon weight="duotone" className="size-5" />}
						/>
					</div>

					{/* Resumes */}
					<div className="space-y-4">
						<h3 className="font-semibold text-lg text-slate-900">Your Resumes</h3>
						{dashboard?.resumes && dashboard.resumes.length > 0 ? (
							<div className="space-y-3">
								{dashboard.resumes.map((resume) => (
									<ResumeCard
										key={resume.id}
										resume={resume}
										engLabsUserId={engLabsUserId}
										tenantId={tenantId}
										isExpanded={expandedResumeId === resume.id}
										onToggle={() => setExpandedResumeId(expandedResumeId === resume.id ? null : resume.id)}
									/>
								))}
							</div>
						) : (
							<div className="rounded-2xl bg-white p-10 text-center shadow-sm">
								<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
									<FileTextIcon weight="duotone" className="size-7" />
								</div>
								<p className="font-medium text-slate-500">No resumes created yet</p>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

type ResumeFeedback = {
	totalComments: number;
	evaluationScore: number | null;
	isSubmitted: boolean;
};

function ResumeCard({
	resume,
	engLabsUserId,
	tenantId,
	isExpanded,
	onToggle,
}: {
	resume: {
		id: string;
		name: string;
		updatedAt: Date;
		feedback: ResumeFeedback;
	};
	engLabsUserId: string | null;
	tenantId: string;
	isExpanded: boolean;
	onToggle: () => void;
}) {
	const queryClient = useQueryClient();
	const hasEvaluation = resume.feedback.evaluationScore !== null;
	const hasComments = resume.feedback.totalComments > 0;
	const isSubmitted = resume.feedback.isSubmitted;

	let statusLabel = "Not Reviewed";
	let statusBg = "bg-slate-100";
	let statusText = "text-slate-500";
	if (hasEvaluation) {
		statusLabel = "Evaluated";
		statusBg = "bg-emerald-50";
		statusText = "text-emerald-700";
	} else if (isSubmitted) {
		statusLabel = "Submitted for Review";
		statusBg = "bg-indigo-50";
		statusText = "text-indigo-700";
	} else if (hasComments) {
		statusLabel = "Has Comments";
		statusBg = "bg-amber-50";
		statusText = "text-amber-700";
	}

	const { data: commentsData, isLoading: commentsLoading } = useQuery({
		...orpc.resume.comments.list.queryOptions({ input: { resumeId: resume.id } }),
		enabled: isExpanded,
	});

	const submitMutation = useMutation({
		...orpc.resume.dashboard.submitResume.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries(orpc.resume.dashboard.student.queryOptions({ input: { userId: "" } }));
		},
	});

	const canSubmit = !isSubmitted && !hasEvaluation && !!engLabsUserId;

	return (
		<div className="overflow-hidden rounded-2xl bg-white shadow-sm">
			{/* biome-ignore lint: click to expand */}
			<div
				className="flex cursor-pointer items-start justify-between p-5 transition-colors hover:bg-slate-50/60"
				onClick={onToggle}
			>
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-slate-900">{resume.name}</p>
					<p className="mt-0.5 text-slate-400 text-xs">Updated {new Date(resume.updatedAt).toLocaleDateString()}</p>
					<div className="mt-3 flex flex-wrap gap-2">
						<span className={cn("rounded-full px-2.5 py-0.5 font-medium text-xs", statusBg, statusText)}>
							{statusLabel}
						</span>
						{hasComments && (
							<span className="rounded-full bg-sky-50 px-2.5 py-0.5 font-medium text-sky-700 text-xs">
								{resume.feedback.totalComments} comment{resume.feedback.totalComments !== 1 ? "s" : ""}
							</span>
						)}
						{hasEvaluation && (
							<span
								className={cn(
									"rounded-full px-2.5 py-0.5 font-medium text-xs",
									getEvaluationBadgeClass(resume.feedback.evaluationScore!),
								)}
							>
								{resume.feedback.evaluationScore!.toFixed(1)}/5
							</span>
						)}
					</div>
				</div>

				<div className="ml-4 flex shrink-0 items-center gap-2">
					<Link
						to="/builder/$resumeId"
						params={{ resumeId: resume.id }}
						target="_blank"
						rel="noreferrer"
						title="Open resume builder"
						onClick={(e) => e.stopPropagation()}
						className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600"
					>
						<ArrowSquareOutIcon weight="duotone" className="size-4" />
					</Link>
					<CaretDownIcon
						weight="bold"
						className={cn("size-4 text-slate-400 transition-transform", isExpanded && "rotate-180")}
					/>
				</div>
			</div>

			{/* Expanded: Submit + Comments */}
			{isExpanded && (
				<div className="border-slate-100 border-t bg-slate-50/60 px-5 pt-4 pb-5">
					{canSubmit && (
						<div className="mb-4 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
							<div>
								<p className="font-semibold text-indigo-900 text-sm">Ready for faculty review?</p>
								<p className="text-indigo-600 text-xs">Submit this resume so your faculty can review and comment.</p>
							</div>
							<button
								type="button"
								disabled={submitMutation.isPending}
								onClick={() => {
									if (!engLabsUserId) return;
									submitMutation.mutate({ resumeId: resume.id, studentId: engLabsUserId, tenantId });
								}}
								className="ml-4 flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-sm text-white transition-all hover:bg-indigo-700 disabled:opacity-60"
							>
								<PaperPlaneTiltIcon weight="duotone" className="size-4" />
								{submitMutation.isPending ? "Submitting…" : "Submit for Review"}
							</button>
						</div>
					)}
					{isSubmitted && !hasEvaluation && (
						<div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
							<p className="font-semibold text-indigo-800 text-sm">Submitted for Review</p>
							<p className="text-indigo-600 text-xs">Your resume is pending faculty review.</p>
						</div>
					)}

					<p className="mb-3 font-semibold text-slate-500 text-xs uppercase tracking-widest">Faculty Comments</p>
					{commentsLoading ? (
						<div className="space-y-2">
							{[...Array(2)].map((_, i) => (
								<Skeleton key={i} className="h-16 w-full rounded-xl" />
							))}
						</div>
					) : !commentsData || commentsData.length === 0 ? (
						<p className="rounded-xl bg-white px-4 py-3 text-center text-slate-400 text-sm shadow-sm">
							No comments yet from your faculty
						</p>
					) : (
						<div className="space-y-2">
							{commentsData.map((comment) => (
								<div key={comment.id} className="rounded-xl bg-white p-3 shadow-sm">
									<p className="text-slate-700 text-sm">{comment.content}</p>
									<p className="mt-1.5 text-slate-400 text-xs">
										{new Date(comment.createdAt).toLocaleDateString()} ·{" "}
										{comment.status === "RESOLVED" ? (
											<span className="text-emerald-600">Resolved</span>
										) : (
											<span className="text-amber-600">Open</span>
										)}
									</p>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
