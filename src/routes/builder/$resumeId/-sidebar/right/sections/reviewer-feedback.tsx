import { t } from "@lingui/core/macro";
import { ChatDotsIcon, CheckCircleIcon, ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useResumeStore } from "@/components/resume/store/resume";
import { Badge } from "@/components/ui/badge";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { SectionBase } from "../shared/section-base";

export function ReviewerFeedbackSectionBuilder() {
	return (
		<SectionBase type="reviewer-feedback">
			<ReviewerFeedbackForm />
		</SectionBase>
	);
}

function ReviewerFeedbackForm() {
	const queryClient = useQueryClient();
	const resumeId = useResumeStore((state) => state.resume.id);

	const { data: comments = [] } = useQuery(orpc.resume.comments.list.queryOptions({ input: { resumeId } }));

	const updateCommentStatusMutation = useMutation({
		...orpc.resume.comments.updateStatus.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.resume.comments.list.queryKey({ input: { resumeId } }) });
		},
	});

	if (comments.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
				<ChatDotsIcon className="size-8 opacity-20 mb-2" />
				<p className="text-xs italic">{t`No feedback comments yet.`}</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{[...comments].reverse().map((comment) => (
				<div
					key={comment.id}
					className={cn(
						"rounded-xl border p-3 transition-all",
						comment.status === "RESOLVED"
							? "bg-emerald-50/20 border-emerald-100 opacity-80"
							: comment.status === "ADDRESSED"
								? "bg-amber-50 border-amber-100"
								: "bg-white border-slate-100",
					)}
				>
					<div className="flex items-start justify-between gap-2">
						<p
							className={cn(
								"text-xs leading-relaxed text-slate-700",
								comment.status === "RESOLVED" && "text-slate-400 line-through",
							)}
						>
							{comment.content}
						</p>
					</div>

					<div className="mt-2 flex items-center justify-between">
						<span className="text-[10px] text-slate-400">
							{new Date(comment.createdAt).toLocaleDateString()}
						</span>

						<div className="flex items-center gap-2">
							{(comment.status === "OPEN" ||
								comment.status === "PUBLISHED" ||
								(comment.status as string) === "DRAFT") && (
								<button
									type="button"
									onClick={() =>
										updateCommentStatusMutation.mutate({ id: comment.id, status: "ADDRESSED" })
									}
									className="flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[10px] font-bold text-white transition-colors hover:bg-amber-700"
								>
									<CheckCircleIcon className="size-3" />
									{t`Mark Addressed`}
								</button>
							)}
							{comment.status === "ADDRESSED" && (
								<button
									type="button"
									onClick={() => updateCommentStatusMutation.mutate({ id: comment.id, status: "OPEN" })}
									className="flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-bold text-amber-600 transition-colors hover:bg-amber-50"
								>
									<ClockCounterClockwiseIcon className="size-3" />
									{t`Undo`}
								</button>
							)}
							<Badge
								variant={comment.status === "RESOLVED" ? "secondary" : "default"}
								className={cn(
									"h-4 px-1.5 text-[9px] uppercase tracking-wider",
									comment.status === "RESOLVED" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
									comment.status === "ADDRESSED" && "bg-amber-100 text-amber-700 hover:bg-amber-100",
									(comment.status === "OPEN" || comment.status === "PUBLISHED") &&
										"bg-blue-100 text-blue-700 hover:bg-blue-100",
								)}
							>
								{comment.status === "PUBLISHED" ? "OPEN" : comment.status}
							</Badge>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
