import { t } from "@lingui/core/macro";
import { ChartPieIcon, CheckCircleIcon, FileTextIcon, UsersIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/placement-officer/")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
	},
});

function RouteComponent() {
	const [view, setView] = useState<"aggregate" | "by-section">("aggregate");

	const { data: dashboard, isLoading } = useQuery(
		orpc.resume.dashboard.po.queryOptions({
			input: { tenantId: "default" },
		}),
	);

	const stats = useMemo(() => {
		if (!dashboard) return { totalResumes: 0, totalEvaluations: 0, evaluatedResumes: 0, completionRate: 0, averageScore: null };
		return dashboard.aggregateStats;
	}, [dashboard]);

	if (isLoading) {
		return (
			<div className="space-y-8">
				<DashboardHeader icon={ChartPieIcon} title={t`Placement Officer Dashboard`} />
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
			<DashboardHeader icon={ChartPieIcon} title={t`Placement Officer Dashboard`} />

			{/* View Tabs */}
			<Tabs value={view} onValueChange={(v) => setView(v as "aggregate" | "by-section")}>
				<TabsList className="rounded-xl bg-slate-100">
					<TabsTrigger value="aggregate" className="rounded-lg">Aggregate View</TabsTrigger>
					<TabsTrigger value="by-section" className="rounded-lg">By Section</TabsTrigger>
				</TabsList>
			</Tabs>

			{/* Aggregate View */}
			{view === "aggregate" && (
				<div className="space-y-8">
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
							label="Evaluated"
							value={stats.evaluatedResumes}
						/>
						<div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]">
							<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
								<ChartPieIcon weight="duotone" className="size-5" />
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
									<ChartPieIcon weight="duotone" className="size-5" />
								</div>
								<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Avg Score</p>
								<p className={cn("mt-1 text-3xl font-bold", getScoreColor(stats.averageScore))}>
									{stats.averageScore.toFixed(1)}/5
								</p>
							</div>
						) : (
							<div className="rounded-2xl bg-slate-50 p-6" />
						)}
					</div>
				</div>
			)}

			{/* By Section View */}
			{view === "by-section" && dashboard?.userMetrics && dashboard.userMetrics.length > 0 && (
				<div className="space-y-4">
					<h3 className="flex items-center gap-2 font-semibold text-slate-900 text-lg">
						<UsersIcon weight="duotone" className="size-5" />
						Metrics by Section
					</h3>
					<div className="space-y-3">
						{dashboard.userMetrics.map((userMetric: any) => (
							<div key={userMetric.userId} className="rounded-2xl bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.99]">
								<div className="flex items-start justify-between mb-4">
									<div>
										<p className="font-semibold text-slate-900">{userMetric.userId}</p>
										<p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Section / Student ID</p>
									</div>
									{userMetric.averageScore !== null && (
										<span className={cn("rounded-full px-3 py-1 text-xs font-semibold", getEvaluationBadgeClass(userMetric.averageScore))}>
											Avg: {userMetric.averageScore.toFixed(1)}/5
										</span>
									)}
								</div>

								<Separator className="my-3" />

								<div className="grid grid-cols-3 gap-4">
									<div>
										<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Resumes</p>
										<p className="mt-1 text-xl font-bold text-slate-900">{userMetric.totalResumes}</p>
									</div>
									<div>
										<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Evaluated</p>
										<p className="mt-1 text-xl font-bold text-slate-900">{userMetric.evaluatedResumes}</p>
									</div>
									<div>
										<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Comments</p>
										<p className="mt-1 text-xl font-bold text-slate-900">{userMetric.totalComments}</p>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
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
