import { t } from "@lingui/core/macro";
import {
	ArrowSquareOutIcon,
	BookOpenIcon,
	CaretDownIcon,
	ChartLineIcon,
	FileTextIcon,
	ListChecksIcon,
	PaperPlaneTiltIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat, StatStrip } from "@/components/ui/stat";
import { orpc } from "@/integrations/orpc/client";
import { getEngLabsUserId, getTenantId } from "@/utils/sso-context";
import { cn } from "@/utils/style";
import { ChecklistsTab } from "../-components/checklists-tab";
import { DashboardHeader } from "../-components/header";
import { getEvaluationBadgeClass } from "../-components/score-helpers";

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
						<div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
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
			<DashboardHeader
				icon={ChartLineIcon}
				title={t`Feedback Summary`}
				description={t`What your reviewers said about your resumes, in one place.`}
			/>

			{/* Tab bar */}
			<div className="flex gap-1 border-border border-b">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={cn(
							"flex items-center gap-2 border-b-2 px-4 py-3 font-semibold text-sm transition-all",
							activeTab === tab.id
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground",
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
						<div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-sm">
							<BookOpenIcon weight="duotone" className="size-5 shrink-0 text-primary" />
							<div className="flex flex-wrap gap-2">
								{enrollment.parentName && (
									<span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium text-foreground text-xs">
										<span className="text-muted-foreground">Package</span>
										{enrollment.parentName}
									</span>
								)}
								<span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium text-foreground text-xs">
									<span className="text-muted-foreground">
										{enrollment.unitType.charAt(0) + enrollment.unitType.slice(1).toLowerCase()}
									</span>
									{enrollment.unitName}
								</span>
							</div>
						</div>
					)}

					{/* Stats Cards */}
					<StatStrip>
						<Stat label={t`My resumes`} value={stats.totalResumes} />
						<Stat label={t`Feedback received`} value={stats.totalComments} />
						<Stat
							label={t`Average score`}
							value={
								stats.averageScore === null ? null : (
									<>
										{stats.averageScore.toFixed(1)}
										<span className="ml-0.5 font-medium text-base text-muted-foreground">/5</span>
									</>
								)
							}
							hint={stats.averageScore === null ? t`Nothing evaluated yet` : undefined}
						/>
					</StatStrip>

					{/* Resumes */}
					<div className="space-y-4">
						<h3 className="font-semibold text-foreground text-lg">Your resumes</h3>
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
							<div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
								<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-primary">
									<FileTextIcon weight="duotone" className="size-7" />
								</div>
								<p className="font-semibold text-foreground">No resumes yet</p>
								<p className="mx-auto mt-1 max-w-xs text-muted-foreground text-sm">
									Create a resume and submit it for review. Your reviewers' comments will show up here.
								</p>
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
	let statusBg = "bg-muted";
	let statusText = "text-muted-foreground";
	if (hasEvaluation) {
		statusLabel = "Evaluated";
		statusBg = "bg-emerald-50";
		statusText = "text-emerald-700";
	} else if (isSubmitted) {
		statusLabel = "Submitted for Review";
		statusBg = "bg-primary/10";
		statusText = "text-primary";
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
		<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
			{/* biome-ignore lint: click to expand */}
			<div
				className="flex cursor-pointer items-start justify-between p-5 transition-colors hover:bg-muted/40"
				onClick={onToggle}
			>
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-foreground">{resume.name}</p>
					<p className="mt-0.5 text-muted-foreground text-xs">Updated {new Date(resume.updatedAt).toLocaleDateString()}</p>
					<div className="mt-3 flex flex-wrap gap-2">
						<span className={cn("rounded-full px-2.5 py-0.5 font-medium text-xs", statusBg, statusText)}>
							{statusLabel}
						</span>
						{hasComments && (
							<span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-foreground text-xs">
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
						className="flex size-8 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
					>
						<ArrowSquareOutIcon weight="duotone" className="size-4" />
					</Link>
					<CaretDownIcon
						weight="bold"
						className={cn("size-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
					/>
				</div>
			</div>

			{/* Expanded: Submit + Comments */}
			{isExpanded && (
				<div className="border-border border-t bg-muted/50 px-5 pt-4 pb-5">
					{canSubmit && (
						<div className="mb-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
							<div>
								<p className="font-semibold text-foreground text-sm">Ready for faculty review?</p>
								<p className="text-muted-foreground text-xs">Submit this resume so your faculty can review and comment.</p>
							</div>
							<button
								type="button"
								disabled={submitMutation.isPending}
								onClick={() => {
									if (!engLabsUserId) return;
									submitMutation.mutate({ resumeId: resume.id, studentId: engLabsUserId, tenantId });
								}}
								className="ml-4 flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
							>
								<PaperPlaneTiltIcon weight="duotone" className="size-4" />
								{submitMutation.isPending ? "Submitting…" : "Submit for Review"}
							</button>
						</div>
					)}
					{isSubmitted && !hasEvaluation && (
						<div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
							<p className="font-semibold text-foreground text-sm">Submitted for review</p>
							<p className="text-muted-foreground text-xs">Your resume is waiting for your faculty.</p>
						</div>
					)}

					<p className="mb-3 font-semibold text-foreground text-sm">Faculty comments</p>
					{commentsLoading ? (
						<div className="space-y-2">
							{[...Array(2)].map((_, i) => (
								<Skeleton key={i} className="h-16 w-full rounded-xl" />
							))}
						</div>
					) : !commentsData || commentsData.length === 0 ? (
						<p className="rounded-xl border border-border bg-card px-4 py-3 text-center text-muted-foreground text-sm">
							No comments yet from your faculty
						</p>
					) : (
						<div className="space-y-2">
							{commentsData.map((comment) => (
								<div key={comment.id} className="rounded-xl border border-border bg-card p-3">
									{comment.anchor && (
										<Link
											to="/builder/$resumeId"
											params={{ resumeId: resume.id }}
											search={{ comment: comment.id }}
											className="mb-2 block rounded-lg border-amber-400 border-l-4 bg-amber-500/10 px-3 py-1.5 text-xs hover:bg-amber-500/20"
										>
											<span className="line-clamp-2 text-foreground">
												{comment.anchor.quote ? `“${comment.anchor.quote.exact}”` : "Whole section"}
											</span>
											<span className="font-semibold text-primary">Show in resume</span>
										</Link>
									)}
									<p className="text-foreground text-sm">{comment.content}</p>
									{comment.suggestion && (
										<p className="mt-1 text-emerald-700 text-xs">Suggested rewrite: “{comment.suggestion}”</p>
									)}
									<p className="mt-1.5 text-muted-foreground text-xs">
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
