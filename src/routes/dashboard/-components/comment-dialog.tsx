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

	const { data: comments, isLoading } = useQuery(
		orpc.resume.comments.list.queryOptions({
			input: { resumeId },
		}),
	);

	const createMutation = useMutation(
		orpc.resume.comments.create.mutationOptions({
			onSuccess: () => {
				setContent("");
				queryClient.invalidateQueries({
					queryKey: orpc.resume.comments.list.queryOptions({ input: { resumeId } }).queryKey as readonly unknown[],
				});
			},
		}),
	);

	const handleSubmit = () => {
		if (!content.trim()) return;
		createMutation.mutate({ resumeId, studentId, tenantId, content: content.trim(), scope });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="rounded-3xl sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle className="font-semibold text-lg text-slate-900">{t`Comments`}</DialogTitle>
				</DialogHeader>

				{/* Existing comments */}
				<div className="max-h-[40vh] space-y-2 overflow-y-auto">
					{isLoading && (
						<div className="space-y-2">
							{[...Array(2)].map((_, i) => (
								<div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-50" />
							))}
						</div>
					)}
					{comments?.length === 0 && !isLoading && (
						<p className="py-8 text-center text-slate-400 text-sm">No comments yet</p>
					)}
					{comments?.map((comment) => (
						<div key={comment.id} className="rounded-2xl bg-slate-50 p-4">
							<div className="mb-1 flex items-center justify-between">
								<span
									className={cn(
										"rounded-full px-2 py-0.5 font-medium text-xs",
										comment.scope === "SECTION" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700",
									)}
								>
									{comment.scope === "SECTION" ? "Section" : "Individual"}
								</span>
								<span className="text-slate-400 text-xs">{new Date(comment.createdAt).toLocaleDateString()}</span>
							</div>
							<p className="text-slate-700 text-sm">{comment.content}</p>
						</div>
					))}
				</div>

				{/* New comment form */}
				<div className="space-y-3 border-slate-100 border-t pt-4">
					<div className="flex gap-2">
						{(["INDIVIDUAL", "SECTION"] as const).map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => setScope(s)}
								className={cn(
									"rounded-xl px-3 py-1.5 font-semibold text-xs transition-all active:scale-[0.97]",
									scope === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
								)}
							>
								{s === "INDIVIDUAL" ? "Individual" : "Entire Section"}
							</button>
						))}
					</div>
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="Add your feedback..."
						rows={3}
						className="w-full resize-none rounded-2xl border-0 bg-slate-50 p-4 text-slate-900 text-sm outline-none ring-1 ring-slate-200 transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500"
					/>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!content.trim() || createMutation.isPending}
						className="w-full rounded-xl bg-indigo-600 py-2.5 font-semibold text-sm text-white transition-all hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
					>
						{createMutation.isPending ? "Posting..." : "Post Comment"}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
