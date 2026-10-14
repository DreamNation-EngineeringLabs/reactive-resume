import { cn } from "@/utils/style";
import { getEvaluationBadgeClass } from "./score-helpers";

type RecentEvaluation = {
	id: string;
	overallScore: number | null;
	evaluatedAt: Date;
	studentName: string | null;
};

type RecentActivityProps = {
	recentEvaluations: RecentEvaluation[];
};

export function RecentActivity({ recentEvaluations }: RecentActivityProps) {
	if (recentEvaluations.length === 0) return null;

	return (
		<div className="space-y-3">
			<h3 className="font-semibold text-lg text-slate-900">Recent Evaluations</h3>
			<div className="space-y-2">
				{recentEvaluations.map((evaluation) => (
					<div
						key={evaluation.id}
						className="rounded-2xl bg-slate-50 p-4 transition-all hover:bg-slate-100 active:scale-[0.99]"
					>
						<div className="flex items-center justify-between">
							<div>
								<p className="font-semibold text-slate-900 text-sm">{evaluation.studentName ?? "Student"}</p>
								<p className="mt-0.5 text-slate-400 text-xs">{new Date(evaluation.evaluatedAt).toLocaleDateString()}</p>
							</div>
							{evaluation.overallScore !== null && (
								<span
									className={cn(
										"rounded-full px-2.5 py-0.5 font-medium text-xs",
										getEvaluationBadgeClass(evaluation.overallScore),
									)}
								>
									{evaluation.overallScore.toFixed(1)}/5
								</span>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
