import { t } from "@lingui/core/macro";
import { ChartLineIcon, FileTextIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/feedback/")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
	},
});

function RouteComponent() {
	const { session } = Route.useRouteContext();

	const { data: dashboard, isLoading } = useQuery(
		orpc.resume.dashboard.student.queryOptions({
			input: { userId: session?.user?.id ?? "" },
		}),
	);

	const stats = useMemo(() => {
		if (!dashboard) return { totalResumes: 0, withFeedback: 0, totalComments: 0, evaluationsReceived: 0, averageScore: null };
		return dashboard.stats;
	}, [dashboard]);

	if (isLoading) {
		return (
			<div className="space-y-8">
				<DashboardHeader icon={ChartLineIcon} title={t`Feedback Summary`} />
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{[...Array(4)].map((_, i) => (
						<div key={i} className="rounded-2xl bg-white shadow-sm p-6">
							<Skeleton className="h-8 w-16 mb-2" />
							<Skeleton className="h-4 w-24" />
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<DashboardHeader icon={ChartLineIcon} title={t`Feedback Summary`} />

			{/* Stats Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label="Total Resumes"
					value={stats.totalResumes}
					iconBg="bg-indigo-50"
					iconColor="text-indigo-600"
					icon={<FileTextIcon weight="duotone" className="size-5" />}
				/>
				<StatCard
					label="With Feedback"
					value={stats.withFeedback}
					iconBg="bg-sky-50"
					iconColor="text-sky-600"
					icon={<ChartLineIcon weight="duotone" className="size-5" />}
				/>
				<StatCard
					label="Total Comments"
					value={stats.totalComments}
					iconBg="bg-violet-50"
					iconColor="text-violet-600"
					icon={<FileTextIcon weight="duotone" className="size-5" />}
				/>
				<StatCard
					label="Evaluations Received"
					value={stats.evaluationsReceived}
					iconBg="bg-emerald-50"
					iconColor="text-emerald-600"
					icon={<ChartLineIcon weight="duotone" className="size-5" />}
				/>
			</div>

			{/* Average Score */}
			{stats.averageScore !== null && (
				<div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Average Evaluation Score</p>
							<p className="mt-2 text-5xl font-bold text-slate-900">{stats.averageScore.toFixed(1)}</p>
							<p className="mt-1 text-sm text-slate-500">out of 5.0</p>
						</div>
						<div className={cn("text-8xl font-bold opacity-5 select-none pointer-events-none", getScoreColor(stats.averageScore))}>
							{Math.round(stats.averageScore * 20)}%
						</div>
					</div>
				</div>
			)}

			{/* Resumes with Feedback */}
			<div className="space-y-4">
				<h3 className="font-semibold text-slate-900 text-lg">Your Resumes</h3>
				{dashboard?.resumes && dashboard.resumes.length > 0 ? (
					<div className="space-y-2">
						{dashboard.resumes.map((resume: any) => (
							<ResumeCard key={resume.id} resume={resume} />
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
	);
}

function StatCard({
	label,
	value,
	icon,
	iconBg,
	iconColor,
}: {
	label: string;
	value: number;
	icon: React.ReactNode;
	iconBg: string;
	iconColor: string;
}) {
	return (
		<div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]">
			<div className={cn("mb-4 flex h-10 w-10 items-center justify-center rounded-2xl", iconBg, iconColor)}>
				{icon}
			</div>
			<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
			<p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
			<div className={cn("pointer-events-none absolute -bottom-3 -right-3 size-20 rotate-12 opacity-5", iconColor)}>
				{icon}
			</div>
		</div>
	);
}

function ResumeCard({
	resume,
}: {
	resume: {
		id: string;
		name: string;
		feedback: {
			totalComments: number;
			latestEvaluation: { overallScore: number | null; createdAt: Date } | null;
			averageScore: number | null;
		};
	};
}) {
	return (
		<div className="rounded-xl bg-slate-50 p-4 transition-all hover:bg-slate-100 active:scale-[0.99]">
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<p className="font-semibold text-slate-900">{resume.name}</p>
					<div className="mt-2 flex gap-2">
						{resume.feedback.totalComments > 0 && (
							<span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">
								{resume.feedback.totalComments} {resume.feedback.totalComments === 1 ? "Comment" : "Comments"}
							</span>
						)}
						{resume.feedback.latestEvaluation && (
							<span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", getEvaluationBadgeClass(resume.feedback.latestEvaluation.overallScore || 0))}>
								Score: {(resume.feedback.latestEvaluation.overallScore || 0).toFixed(1)}/5
							</span>
						)}
					</div>
				</div>
				{resume.feedback.averageScore !== null && (
					<div className="text-right">
						<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Avg Score</p>
						<p className="mt-1 text-xl font-bold text-slate-900">{resume.feedback.averageScore.toFixed(1)}</p>
					</div>
				)}
			</div>
		</div>
	);
}

function getScoreColor(score: number): string {
	if (score >= 4.5) return "text-green-600";
	if (score >= 3.5) return "text-amber-600";
	return "text-red-600";
}

function getEvaluationBadgeClass(score: number): string {
	if (score >= 4.5) return "bg-green-100 text-green-800";
	if (score >= 3.5) return "bg-amber-100 text-amber-800";
	return "bg-red-100 text-red-800";
}
