import { t } from "@lingui/core/macro";
import { CheckCircleIcon, ClipboardTextIcon, ChatDotsIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/faculty/")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		if (!context.session) throw redirect({ to: "/auth/login", replace: true });
	},
});

function RouteComponent() {
	const { session } = Route.useRouteContext();

	const { data: dashboard, isLoading } = useQuery(
		orpc.resume.dashboard.faculty.queryOptions({
			input: { userId: session?.user?.id ?? "" },
		}),
	);

	const stats = useMemo(() => {
		if (!dashboard) return { totalChecklists: 0, totalEvaluations: 0, totalComments: 0, recentActivity: null };
		return dashboard.stats;
	}, [dashboard]);

	if (isLoading) {
		return (
			<div className="space-y-8">
				<DashboardHeader icon={ClipboardTextIcon} title={t`Faculty Review Dashboard`} />
				<div className="grid gap-4 md:grid-cols-3">
					{[...Array(3)].map((_, i) => (
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
			<DashboardHeader icon={ClipboardTextIcon} title={t`Faculty Review Dashboard`} />

			{/* Stats Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<StatCard
					icon={<CheckCircleIcon weight="duotone" className="size-5" />}
					iconBg="bg-emerald-50"
					iconColor="text-emerald-600"
					label="Checklists Created"
					value={stats.totalChecklists}
				/>
				<StatCard
					icon={<ChatDotsIcon weight="duotone" className="size-5" />}
					iconBg="bg-sky-50"
					iconColor="text-sky-600"
					label="Evaluations Done"
					value={stats.totalEvaluations}
				/>
				<StatCard
					icon={<ClipboardTextIcon weight="duotone" className="size-5" />}
					iconBg="bg-amber-50"
					iconColor="text-amber-600"
					label="Comments Made"
					value={stats.totalComments}
				/>
			</div>

			{/* Recent Activity */}
			{stats.recentActivity && (
				<div className="space-y-3">
					<h3 className="font-semibold text-slate-900 text-lg">Recent Activity</h3>
					<div className="rounded-2xl bg-white p-5 shadow-sm">
						<div className="space-y-3 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Last Evaluation</span>
								<span className="font-semibold text-slate-900">
									{stats.recentActivity.lastEvaluation
										? new Date(stats.recentActivity.lastEvaluation).toLocaleDateString()
										: "Never"}
								</span>
							</div>
							<Separator />
							<div className="flex items-center justify-between">
								<span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Last Comment</span>
								<span className="font-semibold text-slate-900">
									{stats.recentActivity.lastComment
										? new Date(stats.recentActivity.lastComment).toLocaleDateString()
										: "Never"}
								</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Recent Evaluations */}
			{dashboard?.recentEvaluations && dashboard.recentEvaluations.length > 0 && (
				<div className="space-y-3">
					<h3 className="font-semibold text-slate-900 text-lg">Recent Evaluations</h3>
					<div className="space-y-2">
						{dashboard.recentEvaluations.map((evaluation, idx) => (
							<div key={idx} className="rounded-xl bg-slate-50 p-4 transition-all hover:bg-slate-100 active:scale-[0.99]">
								<div className="flex items-start justify-between">
									<div>
										<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Resume Evaluation</p>
										<p className="mt-1 font-semibold text-slate-900">
											Score: {evaluation.overallScore?.toFixed(1) ?? "N/A"}/5
										</p>
									</div>
									<span className="text-xs text-slate-400">
										{new Date(evaluation.evaluatedAt || evaluation.createdAt).toLocaleDateString()}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Recent Comments */}
			{dashboard?.recentComments && dashboard.recentComments.length > 0 && (
				<div className="space-y-3">
					<h3 className="font-semibold text-slate-900 text-lg">Recent Comments</h3>
					<div className="space-y-2">
						{dashboard.recentComments.map((comment, idx) => (
							<div key={idx} className="rounded-xl bg-slate-50 p-4 transition-all hover:bg-slate-100 active:scale-[0.99]">
								<div className="flex items-start justify-between mb-1.5">
									<p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Comment</p>
									<span className="text-xs text-slate-400">
										{new Date(comment.createdAt).toLocaleDateString()}
									</span>
								</div>
								<p className="text-sm font-medium text-slate-900 line-clamp-2">{comment.content}</p>
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
		<div className={cn("relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]")}>
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
