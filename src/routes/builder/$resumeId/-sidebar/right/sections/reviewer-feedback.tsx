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
	const resume = useResumeStore((state) => state.resume);
	const resumeId = resume.id;

	const { data: comments = [] } = useQuery(orpc.resume.comments.list.queryOptions({ input: { resumeId } }));

	const updateCommentStatusMutation = useMutation({
		...orpc.resume.comments.updateStatus.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.resume.comments.list.queryKey({ input: { resumeId } }) });
		},
	});

	const submitMutation = useMutation({
		...orpc.resume.dashboard.submitResume.mutationOptions(),
		onSuccess: () => {
			window.location.reload();
		},
	});

	const canSubmitFirstTime = resume.reviewStatus === "DRAFT" || !resume.reviewStatus;

	if (comments.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
				<ChatDotsIcon className="size-10 opacity-10 mb-3 text-indigo-600" />
				<p className="text-slate-500 font-medium text-sm mb-4">{t`Ready for review?`}</p>
				<p className="text-xs text-slate-400 mb-6 px-4">{t`Submit your resume to notify faculty that it is ready for feedback.`}</p>
				
				{canSubmitFirstTime && (
					<button
						type="button"
						disabled={submitMutation.isPending}
						onClick={() => submitMutation.mutate({ resumeId })}
						className="rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-white text-sm shadow-md transition-all hover:bg-indigo-700 disabled:opacity-50"
					>
						{submitMutation.isPending ? t`Submitting...` : t`Submit for Faculty Review`}
					</button>
				)}
			</div>
		);
	}

	const topLevelComments = comments.filter((c) => !c.parentId);
	const getReplies = (parentId: string) => comments.filter((c) => c.parentId === parentId).reverse();

	const unaddressedCount = comments.filter((c) => c.status === "OPEN" || c.status === "PUBLISHED").length;

	return (
		<div className="space-y-4">
			{/* Initial Submission (Draft) */}
			{canSubmitFirstTime && (
				<div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 p-4 mb-4 flex flex-col items-center">
					<p className="text-slate-600 font-bold text-xs mb-2 text-center uppercase tracking-wider opacity-60">{t`Initial Draft`}</p>
					<button
						type="button"
						disabled={submitMutation.isPending}
						onClick={() => submitMutation.mutate({ resumeId })}
						className="w-full rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white text-sm shadow-md transition-all hover:bg-indigo-700 disabled:opacity-50"
					>
						{submitMutation.isPending ? t`Submitting...` : t`Submit for Faculty Review`}
					</button>
					<p className="mt-2 text-[10px] text-slate-400 text-center italic">{t`Submit to notify faculty that your resume is ready for review.`}</p>
				</div>
			)}

			{/* Overall Status Banner (Review Phases) */}
			{resume.reviewStatus && resume.reviewStatus !== "DRAFT" && (
				<div className={cn(
					"rounded-xl border p-3 mb-4 flex items-center justify-between shadow-sm",
					resume.reviewStatus === "APPROVED" ? "bg-teal-50 border-teal-100" : "bg-indigo-50 border-indigo-100"
				)}>
					<div className="flex items-center gap-2">
						<ClockCounterClockwiseIcon className={cn("size-4", resume.reviewStatus === "APPROVED" ? "text-teal-600" : "text-indigo-600")} />
						<div>
							<p className="font-bold text-[10px] uppercase tracking-wider text-slate-400">{t`Current Status`}</p>
							<p className="font-bold text-xs text-slate-700">{resume.reviewStatus.replace(/_/g, " ")}</p>
						</div>
					</div>

					{(resume.reviewStatus === "FACULTY_REVISION_REQUESTED" || resume.reviewStatus === "PO_REVISION_REQUESTED") && (
						<button
							type="button"
							disabled={unaddressedCount > 0 || submitMutation.isPending}
							onClick={() => submitMutation.mutate({ resumeId })}
							className="rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white text-[10px] shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{unaddressedCount > 0 
								? t`Address All Fixes` 
								: resume.reviewStatus === "FACULTY_REVISION_REQUESTED" 
									? t`Resubmit to Faculty` 
									: t`Resubmit to PO`}
						</button>
					)}
				</div>
			)}
			{[...topLevelComments].reverse().map((comment) => {
				const replies = getReplies(comment.id);
				return (
					<div key={comment.id} className="space-y-2">
						<div
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

						{/* Replies */}
						{replies.length > 0 && (
							<div className="ml-6 space-y-2 border-slate-100 border-l pl-3">
								{replies.map((reply) => (
									<div key={reply.id} className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] space-y-2">
										<p className={cn("text-slate-700 leading-relaxed", reply.status === "RESOLVED" && "text-slate-400 line-through")}>{reply.content}</p>
										
										<div className="flex items-center justify-between gap-2">
											<span className="text-[9px] text-slate-400">{new Date(reply.createdAt).toLocaleDateString()}</span>
											
											<div className="flex items-center gap-1.5 flex-wrap justify-end">
												{(reply.status === "OPEN" || reply.status === "PUBLISHED") && (
													<button
														type="button"
														onClick={() => updateCommentStatusMutation.mutate({ id: reply.id, status: "ADDRESSED" })}
														className="flex items-center gap-1 rounded-md bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold text-white transition-colors hover:bg-amber-700"
													>
														<CheckCircleIcon className="size-2.5" />
														{t`Mark Addressed`}
													</button>
												)}
												{reply.status === "ADDRESSED" && (
													<button
														type="button"
														onClick={() => updateCommentStatusMutation.mutate({ id: reply.id, status: "OPEN" })}
														className="flex items-center gap-1 rounded-md border border-amber-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-amber-600 transition-colors hover:bg-amber-50"
													>
														<ClockCounterClockwiseIcon className="size-2.5" />
														{t`Undo`}
													</button>
												)}
												<div className={cn(
													"px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider shadow-sm border",
													reply.status === "RESOLVED" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
													reply.status === "ADDRESSED" ? "bg-amber-100 text-amber-700 border-amber-200" :
													"bg-blue-100 text-blue-700 border-blue-200"
												)}>
													{reply.status === "PUBLISHED" ? "OPEN" : reply.status}
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
