import { t } from "@lingui/core/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

type CommentDialogProps = {
	resumeId: string;
	studentId: string;
	tenantId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function CommentDialog({ resumeId, studentId, tenantId, open, onOpenChange }: CommentDialogProps) {
	const queryClient = useQueryClient();
	const [content, setContent] = useState("");
	const [scope, setScope] = useState<"INDIVIDUAL" | "SECTION">("INDIVIDUAL");
	const [replyTo, setReplyTo] = useState<string | null>(null);

	const { data: comments = [], isLoading } = useQuery(
		orpc.resume.comments.list.queryOptions({
			input: { resumeId },
		}),
	);

	const createMutation = useMutation(
		orpc.resume.comments.create.mutationOptions({
			onSuccess: () => {
				setContent("");
				setReplyTo(null);
				queryClient.invalidateQueries({
					queryKey: orpc.resume.comments.list.queryKey({ input: { resumeId } }),
				});
			},
		}),
	);

	const handleSubmit = () => {
		if (!content.trim()) return;
		createMutation.mutate({ resumeId, studentId, tenantId, content: content.trim(), scope, parentId: replyTo ?? undefined });
	};

	const topLevelComments = comments.filter((c) => !c.parentId);
	const getReplies = (parentId: string) => comments.filter((c) => c.parentId === parentId).reverse();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="rounded-3xl sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle className="font-semibold text-lg text-slate-900">{t`Resume Feedback`}</DialogTitle>
				</DialogHeader>

				{/* Existing comments */}
				<div className="max-h-[50vh] space-y-4 overflow-y-auto pr-2 pb-2">
					{isLoading && (
						<div className="space-y-2">
							{[...Array(2)].map((_, i) => (
								<div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-50" />
							))}
						</div>
					)}
					{topLevelComments.length === 0 && !isLoading && (
						<p className="py-8 text-center text-slate-400 text-sm">No feedback yet</p>
					)}
					{topLevelComments.map((comment) => {
						const replies = getReplies(comment.id);
						return (
							<div key={comment.id} className="space-y-2">
								<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
									<div className="mb-2 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span
												className={cn(
													"rounded-full px-2 py-0.5 font-medium text-[10px] uppercase tracking-wider",
													comment.scope === "SECTION" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700",
												)}
											>
												{comment.scope === "SECTION" ? "Section" : "Individual"}
											</span>
											<span
												className={cn(
													"rounded-full px-2 py-0.5 font-medium text-[10px] uppercase tracking-wider",
													comment.status === "ADDRESSED" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700",
												)}
											>
												{comment.status}
											</span>
										</div>
										<span className="text-slate-400 text-[10px]">{new Date(comment.createdAt).toLocaleDateString()}</span>
									</div>
									<p className="mb-2 text-slate-700 text-sm leading-relaxed">{comment.content}</p>
									<div className="flex justify-end">
										<button
											type="button"
											onClick={() => setReplyTo(comment.id)}
											className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
										>
											{t`Reply`}
										</button>
									</div>
								</div>

								{/* Replies */}
								{replies.length > 0 && (
									<div className="ml-8 space-y-2 border-slate-100 border-l pl-4">
										{replies.map((reply) => (
											<div key={reply.id} className="rounded-xl bg-slate-50 p-3 text-sm">
												<div className="mb-1 flex items-center justify-between">
													<span className="font-semibold text-slate-500 text-[10px] uppercase">{t`Reply`}</span>
													<span className="text-slate-400 text-[10px]">{new Date(reply.createdAt).toLocaleDateString()}</span>
												</div>
												<p className="text-slate-600 text-xs leading-relaxed">{reply.content}</p>
											</div>
										))}
									</div>
								)}
							</div>
						);
					})}
				</div>

				{/* New comment form */}
				<div className="space-y-3 border-slate-100 border-t pt-4">
					<div className="flex items-center justify-between">
						<div className="flex gap-2">
							{(["INDIVIDUAL", "SECTION"] as const).map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => setScope(s)}
									className={cn(
										"rounded-xl px-3 py-1.5 font-semibold text-[11px] uppercase transition-all active:scale-[0.97]",
										scope === s && !replyTo ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
										replyTo && "opacity-50 pointer-events-none",
									)}
								>
									{s === "INDIVIDUAL" ? "Individual" : "Entire Section"}
								</button>
							))}
						</div>
						{replyTo && (
							<div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1 text-indigo-700 text-xs">
								<span className="font-bold uppercase tracking-tight">{t`Replying to thread`}</span>
								<button onClick={() => setReplyTo(null)} className="font-bold hover:text-indigo-900">
									✕
								</button>
							</div>
						)}
					</div>
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder={replyTo ? "Add your reply..." : "Add your feedback..."}
						rows={3}
						className="w-full resize-none rounded-2xl border-0 bg-slate-50 p-4 text-slate-900 text-sm outline-none ring-1 ring-slate-200 transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500"
					/>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!content.trim() || createMutation.isPending}
						className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-sm text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
					>
						{createMutation.isPending ? "Posting..." : replyTo ? "Post Reply" : "Post Comment"}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
