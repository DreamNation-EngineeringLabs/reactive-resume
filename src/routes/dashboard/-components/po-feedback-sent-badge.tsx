import { t } from "@lingui/core/macro";
import { ArrowCounterClockwiseIcon, ChatTeardropTextIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/integrations/orpc/client";
import { POSectionReviewDialog } from "./po-section-review-dialog";

type Props = {
	sectionId: string;
	sectionName: string;
	tenantId: string;
	resumes: Array<{ id: string; studentId: string }>;
	onSuccess: () => void;
};

export function POFeedbackSentBadge({ sectionId, sectionName, tenantId, resumes, onSuccess }: Props) {
	const [expanded, setExpanded] = useState(false);
	const [editOpen, setEditOpen] = useState(false);

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
			<div className="rounded-xl border border-slate-200 bg-slate-50 text-xs">
				{/* Header row */}
				<div className="flex w-full items-center gap-2 px-3 py-2">
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						className="flex flex-1 items-center gap-2 text-left"
					>
						<ArrowCounterClockwiseIcon weight="bold" className="size-3.5 shrink-0 text-amber-500" />
						<span className="font-semibold text-slate-700">{t`Feedback sent — awaiting resubmission`}</span>
						<span className="ml-auto text-slate-400">{formattedDate}</span>
						<ChatTeardropTextIcon
							weight="duotone"
							className={`size-3.5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
						/>
					</button>
					{/* Edit button */}
					<button
						type="button"
						onClick={() => setEditOpen(true)}
						className="ml-1 flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 text-xs hover:border-indigo-200 hover:text-indigo-600 transition-colors"
					>
						<PencilSimpleIcon className="size-3" />
						{t`Edit`}
					</button>
				</div>

				{/* Expandable preview */}
				{expanded && (
					<div className="border-t border-slate-200 px-3 py-2 space-y-2">
						<p className="leading-relaxed text-slate-600 whitespace-pre-wrap line-clamp-4">{latest.reviewNotes}</p>
						{latest.voiceNoteUrl && (
							<audio src={latest.voiceNoteUrl} controls className="h-7 w-full" />
						)}
						{reviews && reviews.length > 1 && (
							<p className="text-slate-400 italic">{t`+${reviews.length - 1} earlier round(s)`}</p>
						)}
					</div>
				)}
			</div>

			{/* Edit dialog */}
			<POSectionReviewDialog
				open={editOpen}
				onClose={() => setEditOpen(false)}
				sectionId={sectionId}
				sectionName={sectionName}
				tenantId={tenantId}
				resumes={resumes}
				editReviewId={latest.id}
				initialNotes={latest.reviewNotes}
				initialVoiceNoteUrl={latest.voiceNoteUrl}
				onSuccess={onSuccess}
			/>
		</>
	);
}
