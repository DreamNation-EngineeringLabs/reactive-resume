import { t } from "@lingui/core/macro";
import { ChatTeardropTextIcon, MicrophoneIcon, XIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { orpc } from "@/integrations/orpc/client";

type Props = {
	sectionId: string;
	tenantId: string;
};

export function POSectionFeedbackBanner({ sectionId, tenantId }: Props) {
	const [open, setOpen] = useState(false);

	const { data: reviews } = useQuery(
		orpc.resume.dashboard.getPoSectionReviews.queryOptions({
			input: { sectionId, tenantId },
		}),
	);

	const latest = reviews?.[0];
	if (!latest) return null;

	const formattedDate = new Date(latest.createdAt).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	return (
		<>
			{/* Compact button — always fixed height in the card */}
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="mt-2 flex w-full items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-left text-xs transition-colors hover:bg-indigo-100"
			>
				<ChatTeardropTextIcon weight="duotone" className="size-4 shrink-0 text-indigo-500" />
				<span className="flex-1 truncate font-semibold text-indigo-700">{t`Placement Officer Feedback`}</span>
				<span className="shrink-0 text-indigo-400">{formattedDate}</span>
			</button>

			{/* Full feedback in a dialog */}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-base">
							<ChatTeardropTextIcon weight="duotone" className="size-5 text-indigo-500" />
							{t`Placement Officer Feedback`}
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 pt-1">
						{reviews?.map((review, i) => (
							<div
								key={review.id}
								className={`rounded-xl border p-4 text-sm ${i === 0 ? "border-indigo-100 bg-indigo-50" : "border-slate-100 bg-slate-50"}`}
							>
								<div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
									<span className="font-semibold text-slate-600">
										{i === 0 ? t`Latest` : `#${reviews.length - i}`}
									</span>
									<span className="ml-auto">
										{new Date(review.createdAt).toLocaleDateString(undefined, {
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								</div>
								<p className="whitespace-pre-wrap leading-relaxed text-slate-700">{review.reviewNotes}</p>
								{review.voiceNoteUrl && (
									<div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
										<MicrophoneIcon weight="duotone" className="size-4 shrink-0 text-indigo-400" />
										<audio src={review.voiceNoteUrl} controls className="h-8 flex-1" />
									</div>
								)}
							</div>
						))}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
