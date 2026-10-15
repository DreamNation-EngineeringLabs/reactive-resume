import { t } from "@lingui/core/macro";
import { cn } from "@/utils/style";
import { uiSurface } from "@/utils/ui-tokens";

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
		<div className={cn(uiSurface.card, "overflow-hidden")}>
			<div className="px-6 pt-5 pb-3">
				<h3 className="font-semibold text-foreground">{t`Recent evaluations`}</h3>
				<p className="text-muted-foreground text-xs">{t`The latest checklist scores you and your colleagues gave.`}</p>
			</div>
			<ul className="divide-y divide-border">
				{recentEvaluations.map((evaluation) => (
					<li key={evaluation.id} className="flex items-center gap-4 px-6 py-3">
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium text-foreground text-sm">{evaluation.studentName ?? t`Student`}</p>
							<p className="text-muted-foreground text-xs">{new Date(evaluation.evaluatedAt).toLocaleDateString()}</p>
						</div>
						{evaluation.overallScore !== null && (
							<>
								<div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-muted sm:block">
									<div
										className="h-full rounded-full bg-primary"
										style={{ width: `${(evaluation.overallScore / 5) * 100}%` }}
									/>
								</div>
								<span className="w-12 text-right font-semibold text-foreground text-sm tabular-nums">
									{evaluation.overallScore.toFixed(1)}/5
								</span>
							</>
						)}
					</li>
				))}
			</ul>
		</div>
	);
}
