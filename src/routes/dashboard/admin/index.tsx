import { t } from "@lingui/core/macro";
import { ChartBarIcon, CheckCircleIcon, FileTextIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/admin/")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
	},
});

function RouteComponent() {
	const { data: dashboard, isLoading } = useQuery(
		orpc.resume.dashboard.admin.queryOptions({
			input: { tenantId: "default" },
		}),
	);

	const stats = useMemo(() => {
		if (!dashboard) return { totalResumes: 0, totalEvaluations: 0, completionRate: 0, averageScore: null };
		return dashboard.stats;
	}, [dashboard]);

	if (isLoading) {
		return (
			<div className="space-y-8">
				<DashboardHeader icon={ChartBarIcon} title={t`Admin Metrics Dashboard`} />
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
			<DashboardHeader icon={ChartBarIcon} title={t`Admin Metrics Dashboard`} />

			{/* Main Stats */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<StatCard
					icon={<FileTextIcon weight="duotone" className="size-5" />}
					iconBg="bg-indigo-50"
					iconColor="text-indigo-600"
					label="Total Resumes"
					value={stats.totalResumes}
				/>
				<StatCard
					icon={<CheckCircleIcon weight="duotone" className="size-5" />}
					iconBg="bg-emerald-50"
					iconColor="text-emerald-600"
					label="Total Evaluations"
					value={stats.totalEvaluations}
				/>
				<div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]">
					<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
						<ChartBarIcon weight="duotone" className="size-5" />
					</div>
					<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Completion Rate</p>
					<p className="mt-1 text-3xl font-bold text-slate-900">{stats.completionRate}%</p>
					<div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
						<div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${stats.completionRate}%` }} />
					</div>
				</div>
				{stats.averageScore !== null ? (
					<div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]">
						<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
							<ChartBarIcon weight="duotone" className="size-5" />
						</div>
						<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Avg Evaluation Score</p>
						<p className={cn("mt-1 text-3xl font-bold", getScoreColor(stats.averageScore))}>
							{stats.averageScore.toFixed(1)}/5
						</p>
					</div>
				) : (
					<div className="rounded-2xl bg-slate-50 p-6" />
				)}
			</div>

			{/* Recent Activity */}
			<div className="grid gap-6 lg:grid-cols-3">
				{dashboard?.recentActivity?.recentResumes && dashboard.recentActivity.recentResumes.length > 0 && (
					<div className="space-y-3">
						<h3 className="font-semibold text-slate-900 text-lg">Recent Resumes</h3>
						<div className="space-y-2">
							{dashboard.recentActivity.recentResumes.map((resume: any, idx: number) => (
								<div key={idx} className="rounded-xl bg-slate-50 p-3 transition-all hover:bg-slate-100">
									<p className="text-sm font-semibold text-slate-900 line-clamp-1">{resume.name || `Resume ${idx + 1}`}</p>
									<p className="mt-0.5 text-xs text-slate-400">
										{new Date(resume.createdAt).toLocaleDateString()}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{dashboard?.recentActivity?.recentEvaluations && dashboard.recentActivity.recentEvaluations.length > 0 && (
					<div className="space-y-3">
						<h3 className="font-semibold text-slate-900 text-lg">Recent Evaluations</h3>
						<div className="space-y-2">
							{dashboard.recentActivity.recentEvaluations.map((evaluation: any, idx: number) => (
								<div key={idx} className="rounded-xl bg-slate-50 p-3 transition-all hover:bg-slate-100">
									<div className="flex items-center justify-between">
										<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Evaluation</p>
										<span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", getEvaluationBadgeClass(evaluation.overallScore || 0))}>
											{(evaluation.overallScore || 0).toFixed(1)}/5
										</span>
									</div>
									<p className="mt-0.5 text-xs text-slate-400">
										{new Date(evaluation.createdAt).toLocaleDateString()}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{dashboard?.recentActivity?.recentComments && dashboard.recentActivity.recentComments.length > 0 && (
					<div className="space-y-3">
						<h3 className="font-semibold text-slate-900 text-lg">Recent Comments</h3>
						<div className="space-y-2">
							{dashboard.recentActivity.recentComments.map((comment: any, idx: number) => (
								<div key={idx} className="rounded-xl bg-slate-50 p-3 transition-all hover:bg-slate-100">
									<p className="text-sm font-semibold text-slate-900 line-clamp-2">{comment.content}</p>
									<p className="mt-0.5 text-xs text-slate-400">
										{new Date(comment.createdAt).toLocaleDateString()}
									</p>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function StatCard({
	icon,
	iconBg,
	iconColor,
	label,
	value,
}: {
	icon: React.ReactNode;
	iconBg: string;
	iconColor: string;
	label: string;
	value: number;
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
