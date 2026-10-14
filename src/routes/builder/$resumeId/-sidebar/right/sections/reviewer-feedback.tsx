import { t } from "@lingui/core/macro";
import {
	ChatDotsIcon,
	CheckCircleIcon,
	CheckIcon,
	ClockCounterClockwiseIcon,
	CopyIcon,
	PencilSimpleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import {
	anchorLabel,
	SEVERITY_BADGE,
	scrollToAnchor,
	severityEdge,
	severityLabel,
	useAnchorStatusStore,
} from "@/components/resume/review-anchors";
import { flushResumeSync, useResumeStore } from "@/components/resume/store/resume";
import { Badge } from "@/components/ui/badge";
import { useDialogStore } from "@/dialogs/store";
import { orpc } from "@/integrations/orpc/client";
import { anchorTarget, applySuggestion, type CommentAnchor } from "@/schema/resume/comment-anchor";
import type { ResumeData } from "@/schema/resume/data";
import type { SidebarSection } from "@/utils/resume/section";
import { cn } from "@/utils/style";
import { useSectionStore } from "../../../-store/section";
import { useBuilderSidebar, useBuilderSidebarStore } from "../../../-store/sidebar";
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
	const { comment: activeId } = useSearch({ from: "/builder/$resumeId" });
	const navigate = useNavigate({ from: "/builder/$resumeId" });
	const { toggleSidebar } = useBuilderSidebar();

	// Highlights are painted by the preview (builder/$resumeId/index.tsx), which also reports their status.
	const anchorStatuses = useAnchorStatusStore((state) => state.statuses);

	// Shows a comment's text on the resume. On phones the panel covers the resume, so close it first.
	const showComment = (id: string, anchor: CommentAnchor) => {
		useBuilderSidebarStore.getState().setMobilePanel(null);
		if (id === activeId) return scrollToAnchor(anchor);
		// A search-param change, not a page change: no cross-fade, no scroll reset.
		navigate({
			search: (prev) => ({ ...prev, comment: id }),
			replace: true,
			resetScroll: false,
			viewTransition: false,
		});
	};

	useEffect(() => {
		if (activeId) document.getElementById(`feedback-${activeId}`)?.scrollIntoView({ block: "nearest" });
	}, [activeId]);

	// Opens the editor for the exact entry a comment points at; basics/summary/whole sections open their panel.
	const openEditor = (anchor: CommentAnchor) => {
		const custom = resume.data.customSections.find((s) => s.id === anchor.section);
		const section = resume.data.sections[anchor.section as keyof typeof resume.data.sections];
		const items: { id: string }[] = custom?.items ?? (section && "items" in section ? section.items : []);
		const item = items.find((i) => i.id === anchor.itemId);

		if (item) {
			// Same call the left sidebar makes when an item is clicked.
			useDialogStore.getState().openDialog(
				`resume.sections.${custom?.type ?? anchor.section}.update` as never,
				{
					item,
					customSectionId: custom?.id,
				} as never,
			);
			return;
		}

		const panel = (custom ? "custom" : anchor.section) as SidebarSection;
		toggleSidebar("left", true);
		useSectionStore.getState().setCollapsed(panel, false);
		requestAnimationFrame(() => document.getElementById(`sidebar-${panel}`)?.scrollIntoView({ block: "start" }));
	};

	const updateCommentStatusMutation = useMutation({
		// No global invalidation: refetching the resume here re-initializes the builder from the server
		// and drops edits still waiting for the debounced save (e.g. a suggestion applied a moment ago).
		...orpc.resume.comments.updateStatus.mutationOptions({ meta: { noInvalidate: true } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.resume.comments.list.queryKey({ input: { resumeId } }) });
		},
	});

	// Where a reviewer's rewrite would go, or null when it can't be applied safely (text edited, repeated, or formatted).
	const suggestionEdit = (anchor: CommentAnchor, suggestion: string) =>
		anchor.quote ? applySuggestion(anchorTarget(resume.data, anchor), anchor.quote.exact, suggestion) : null;

	const updateResumeData = useResumeStore((state) => state.updateResumeData);
	const applyRewrite = (commentId: string, anchor: CommentAnchor, suggestion: string) => {
		const edit = suggestionEdit(anchor, suggestion);
		if (!edit) return;
		updateResumeData((draft) => {
			const target = anchorTarget(draft as ResumeData, anchor);
			let node = target as Record<string, unknown> | undefined;
			for (const key of edit.path.slice(0, -1)) node = node?.[key] as Record<string, unknown> | undefined;
			if (node) node[edit.path[edit.path.length - 1]] = edit.value;
		});
		flushResumeSync();
		updateCommentStatusMutation.mutate({ id: commentId, status: "ADDRESSED" });
		toast.success(t`Suggestion applied and marked as addressed.`);
	};

	const submitMutation = useMutation({
		...orpc.resume.dashboard.submitResume.mutationOptions(),
		onSuccess: () => {
			window.location.reload();
		},
	});

	const canSubmitFirstTime = resume.reviewStatus === "DRAFT" || !resume.reviewStatus;

	if (comments.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-2xl border-2 border-border border-dashed bg-muted/50 py-8 text-center">
				<ChatDotsIcon className="mb-3 size-10 text-primary opacity-10" />
				<p className="mb-4 font-medium text-muted-foreground text-sm">{t`Ready for review?`}</p>
				<p className="mb-6 px-4 text-muted-foreground text-xs">{t`Submit your resume to notify faculty that it is ready for feedback.`}</p>

				{canSubmitFirstTime && (
					<button
						type="button"
						disabled={submitMutation.isPending}
						onClick={() => submitMutation.mutate({ resumeId })}
						className="rounded-xl bg-primary px-6 py-2.5 font-bold text-sm text-white shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
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
	const doneCount = topLevelComments.filter((c) => c.status === "ADDRESSED" || c.status === "RESOLVED").length;

	return (
		<div className="space-y-4">
			{/* Initial Submission (Draft) */}
			{canSubmitFirstTime && (
				<div className="mb-4 flex flex-col items-center rounded-xl border border-primary/20 border-dashed bg-primary/5 p-4">
					<p className="mb-2 text-center font-bold text-muted-foreground text-xs uppercase tracking-wider opacity-60">{t`Initial Draft`}</p>
					<button
						type="button"
						disabled={submitMutation.isPending}
						onClick={() => submitMutation.mutate({ resumeId })}
						className="w-full rounded-xl bg-primary px-4 py-2 font-bold text-sm text-white shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
					>
						{submitMutation.isPending ? t`Submitting...` : t`Submit for Faculty Review`}
					</button>
					<p className="mt-2 text-center text-[10px] text-muted-foreground italic">{t`Submit to notify faculty that your resume is ready for review.`}</p>
				</div>
			)}

			{/* Overall Status Banner (Review Phases) */}
			{resume.reviewStatus && resume.reviewStatus !== "DRAFT" && (
				<div
					className={cn(
						"mb-4 flex items-center justify-between rounded-xl border p-3 shadow-sm",
						resume.reviewStatus === "APPROVED" ? "border-teal-100 bg-teal-50" : "border-primary/10 bg-primary/5",
					)}
				>
					<div className="flex items-center gap-2">
						<ClockCounterClockwiseIcon
							className={cn("size-4", resume.reviewStatus === "APPROVED" ? "text-teal-600" : "text-primary")}
						/>
						<div>
							<p className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">{t`Current Status`}</p>
							<p className="font-bold text-foreground text-xs">{resume.reviewStatus.replace(/_/g, " ")}</p>
						</div>
					</div>

					{(resume.reviewStatus === "FACULTY_REVISION_REQUESTED" ||
						resume.reviewStatus === "PO_REVISION_REQUESTED") && (
						<button
							type="button"
							disabled={unaddressedCount > 0 || submitMutation.isPending}
							onClick={() => submitMutation.mutate({ resumeId })}
							className="rounded-lg bg-primary px-3 py-1.5 font-bold text-[10px] text-white shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
			<div>
				<div className="mb-1 flex justify-between text-muted-foreground text-xs">
					<span>{t`Feedback addressed`}</span>
					<span className="font-semibold text-foreground">
						{doneCount} / {topLevelComments.length}
					</span>
				</div>
				<div className="h-1.5 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full rounded-full bg-emerald-500 transition-all"
						style={{ width: `${(doneCount / Math.max(1, topLevelComments.length)) * 100}%` }}
					/>
				</div>
			</div>

			{[...topLevelComments].reverse().map((comment) => {
				const replies = getReplies(comment.id);
				const anchorStatus = anchorStatuses[comment.id];
				return (
					<div key={comment.id} id={`feedback-${comment.id}`} className="space-y-2">
						<div
							className={cn(
								"rounded-xl border p-3 transition-all",
								comment.status === "RESOLVED"
									? "border-emerald-100 bg-emerald-50/20 opacity-80"
									: comment.status === "ADDRESSED"
										? "border-amber-100 bg-amber-50"
										: "border-border bg-card",
								activeId === comment.id && "ring-2 ring-amber-400",
							)}
						>
							{comment.anchor && (
								<div className="mb-2 flex items-stretch gap-1.5">
									<button
										type="button"
										onClick={() => comment.anchor && showComment(comment.id, comment.anchor)}
										className={cn(
											"min-w-0 flex-1 rounded-lg border-l-4 bg-amber-50/60 px-2.5 py-1.5 text-start hover:bg-amber-50",
											severityEdge(comment.severity),
										)}
									>
										<span className="flex flex-wrap items-center gap-1.5 font-semibold text-[10px] text-muted-foreground">
											{anchorLabel(comment.anchor, resume.data)}
											{anchorStatus === "changed" && (
												<span className="rounded bg-primary/10 px-1 text-primary">{t`Edited`}</span>
											)}
											{anchorStatus === "missing" && (
												<span className="rounded bg-border px-1 text-muted-foreground">{t`Removed`}</span>
											)}
										</span>
										<span
											className={cn(
												"line-clamp-2 text-[11px] text-foreground",
												anchorStatus && anchorStatus !== "ok" && "line-through opacity-70",
											)}
										>
											{comment.anchor.quote ? `“${comment.anchor.quote.exact}”` : t`Whole section`}
										</span>
									</button>
									<button
										type="button"
										onClick={() => comment.anchor && openEditor(comment.anchor)}
										aria-label={t`Edit ${anchorLabel(comment.anchor, resume.data)}`}
										className="flex shrink-0 items-center gap-1 rounded-lg bg-card px-2 font-semibold text-[10px] text-primary ring-1 ring-border hover:bg-primary/5"
									>
										<PencilSimpleIcon className="size-3" />
										{t`Edit`}
									</button>
								</div>
							)}
							{comment.severity && (
								<span
									className={cn(
										"mb-1 inline-block rounded-md px-1.5 py-0.5 font-semibold text-[10px]",
										SEVERITY_BADGE[comment.severity],
									)}
								>
									{t`${severityLabel(comment.severity)} severity`}
								</span>
							)}
							<div className="flex items-start justify-between gap-2">
								<p
									className={cn(
										"text-foreground text-xs leading-relaxed",
										comment.status === "RESOLVED" && "text-muted-foreground line-through",
									)}
								>
									{comment.content}
								</p>
							</div>

							{comment.suggestion && comment.anchor?.quote && comment.status !== "RESOLVED" && (
								<SuggestedRewrite
									suggestion={comment.suggestion}
									canApply={!resume.isLocked && !!suggestionEdit(comment.anchor, comment.suggestion)}
									onApply={() => comment.anchor && applyRewrite(comment.id, comment.anchor, comment.suggestion ?? "")}
								/>
							)}

							<div className="mt-2 flex items-center justify-between">
								<span className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>

								<div className="flex items-center gap-2">
									{(comment.status === "OPEN" ||
										comment.status === "PUBLISHED" ||
										(comment.status as string) === "DRAFT") && (
										<button
											type="button"
											onClick={() => updateCommentStatusMutation.mutate({ id: comment.id, status: "ADDRESSED" })}
											className="flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 font-bold text-[10px] text-white transition-colors hover:bg-amber-700"
										>
											<CheckCircleIcon className="size-3" />
											{t`Mark Addressed`}
										</button>
									)}
									{comment.status === "ADDRESSED" && (
										<button
											type="button"
											onClick={() => updateCommentStatusMutation.mutate({ id: comment.id, status: "OPEN" })}
											className="flex items-center gap-1 rounded-md border border-amber-200 bg-card px-2 py-1 font-bold text-[10px] text-amber-600 transition-colors hover:bg-amber-50"
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
							<div className="ml-6 space-y-2 border-border border-l pl-3">
								{replies.map((reply) => (
									<div
										key={reply.id}
										className="space-y-2 rounded-xl border border-border bg-muted/50 p-3 text-[11px]"
									>
										<p
											className={cn(
												"text-foreground leading-relaxed",
												reply.status === "RESOLVED" && "text-muted-foreground line-through",
											)}
										>
											{reply.content}
										</p>

										<div className="flex items-center justify-between gap-2">
											<span className="text-[9px] text-muted-foreground">
												{new Date(reply.createdAt).toLocaleDateString()}
											</span>

											<div className="flex flex-wrap items-center justify-end gap-1.5">
												{(reply.status === "OPEN" || reply.status === "PUBLISHED") && (
													<button
														type="button"
														onClick={() => updateCommentStatusMutation.mutate({ id: reply.id, status: "ADDRESSED" })}
														className="flex items-center gap-1 rounded-md bg-amber-600 px-1.5 py-0.5 font-bold text-[9px] text-white transition-colors hover:bg-amber-700"
													>
														<CheckCircleIcon className="size-2.5" />
														{t`Mark Addressed`}
													</button>
												)}
												{reply.status === "ADDRESSED" && (
													<button
														type="button"
														onClick={() => updateCommentStatusMutation.mutate({ id: reply.id, status: "OPEN" })}
														className="flex items-center gap-1 rounded-md border border-amber-200 bg-card px-1.5 py-0.5 font-bold text-[9px] text-amber-600 transition-colors hover:bg-amber-50"
													>
														<ClockCounterClockwiseIcon className="size-2.5" />
														{t`Undo`}
													</button>
												)}
												<div
													className={cn(
														"rounded-full border px-1.5 py-0.5 font-bold text-[8px] uppercase tracking-wider shadow-sm",
														reply.status === "RESOLVED"
															? "border-emerald-200 bg-emerald-100 text-emerald-700"
															: reply.status === "ADDRESSED"
																? "border-amber-200 bg-amber-100 text-amber-700"
																: "border-blue-200 bg-blue-100 text-blue-700",
													)}
												>
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

function SuggestedRewrite({
	suggestion,
	canApply,
	onApply,
}: {
	suggestion: string;
	canApply: boolean;
	onApply: () => void;
}) {
	const copy = async () => {
		await navigator.clipboard.writeText(suggestion);
		toast.success(t`Suggestion copied. Paste it where the highlighted text is.`);
	};

	return (
		<div className="mt-2 rounded-lg bg-emerald-50/70 px-2.5 py-2">
			<p className="font-semibold text-[10px] text-emerald-700">{t`Suggested rewrite`}</p>
			<p className="mt-0.5 text-[11px] text-foreground">{suggestion}</p>
			<button
				type="button"
				onClick={canApply ? onApply : copy}
				className="mt-1.5 flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 font-bold text-[10px] text-white hover:bg-emerald-700"
			>
				{canApply ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
				{canApply ? t`Apply suggestion` : t`Copy suggestion`}
			</button>
		</div>
	);
}
