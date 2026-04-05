import { t } from "@lingui/core/macro";
import { ChatCircleDotsIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";
import { POFeedbackSentBadge } from "./po-feedback-sent-badge";

type Stats = {
	totalStudents: number;
	totalResumes: number;
	approvedResumes: number;
	evaluatedResumes: number;
	averageScore: number | null;
	[key: string]: unknown;
};

type Props = {
	sectionId: string;
	sectionName: string;
	tenantId: string;
	stats: Stats;
	poSubmittedResumes: Array<{ id: string; studentId: string }>;
	sectionStudents: Array<{
		engLabsId: string;
		resumes: Array<{ id: string; reviewStatus?: string | null; studentId?: string }>;
	}>;
	onOpenReviewDialog: () => void;
	isPending: boolean;
};

export function POSectionCardActions({
	sectionId,
	sectionName,
	tenantId,
	stats,
	poSubmittedResumes,
	sectionStudents,
	onOpenReviewDialog,
	isPending,
}: Props) {
	const queryClient = useQueryClient();

	const { data: reviews } = useQuery(
		orpc.resume.dashboard.getPoSectionReviews.queryOptions({
			input: { sectionId, tenantId },
		}),
	);

	const bulkUpdateMutation = useMutation({
		...orpc.resume.dashboard.bulkUpdateResumes.mutationOptions(),
		onSuccess: () => queryClient.invalidateQueries(),
	});

	const hasSentFeedback = (reviews?.length ?? 0) > 0;

	// Resumes waiting for faculty to resubmit after PO feedback (FINALIZED_BY_FACULTY with prior feedback)
	const awaitingResubmission = hasSentFeedback && poSubmittedResumes.length === 0;

	const poVerifiedResumes = (stats.poVerifiedResumes as number | undefined) ?? 0;
	const passedFaculty = (stats.passedFaculty as number | undefined) ?? 0;

	return (
		<div className="space-y-2">
			{/* Feedback sent badge — shown when PO has previously sent feedback */}
			{hasSentFeedback && (
				<POFeedbackSentBadge
					sectionId={sectionId}
					sectionName={sectionName}
					tenantId={tenantId}
					resumes={poSubmittedResumes}
					onSuccess={() => queryClient.invalidateQueries()}
				/>
			)}

			{/* Send feedback button — only when resumes are actively in PO hands */}
			{poSubmittedResumes.length > 0 && (
				<button
					type="button"
					onClick={onOpenReviewDialog}
					className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2.5 font-bold text-amber-700 text-sm shadow-sm transition-all hover:bg-amber-100 active:scale-[0.98]"
				>
					<ChatCircleDotsIcon weight="duotone" className="size-4" />
					{t`Review & Send Feedback`}
					<span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px]">{poSubmittedResumes.length}</span>
				</button>
			)}

			{/* Approve / status button — hidden when waiting for faculty resubmission after feedback */}
			{!awaitingResubmission && (
				<button
					type="button"
					disabled={
						poVerifiedResumes + stats.approvedResumes < stats.totalResumes ||
						stats.approvedResumes === stats.totalResumes ||
						isPending
					}
					onClick={() => {
						const poPendingList = sectionStudents.flatMap((s) =>
							s.resumes
								.filter(
									(r) =>
										r.reviewStatus === "PO_VERIFIED" ||
										r.reviewStatus === "SUBMITTED_TO_PO" ||
										r.reviewStatus === "RESUBMITTED_TO_PO",
								)
								.map((r) => ({ id: r.id, studentId: s.engLabsId })),
						);
						bulkUpdateMutation.mutate({
							resumes: poPendingList,
							tenantId,
							status: "APPROVED",
						});
					}}
					className={cn(
						"flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-sm shadow-sm transition-all active:scale-[0.98]",
						poVerifiedResumes + stats.approvedResumes >= stats.totalResumes &&
							stats.approvedResumes < stats.totalResumes &&
							stats.totalResumes > 0
							? "bg-indigo-600 text-white hover:bg-indigo-700"
							: stats.approvedResumes === stats.totalResumes && stats.totalResumes > 0
								? "cursor-default border border-emerald-100 bg-emerald-50 text-emerald-600"
								: passedFaculty === stats.totalResumes && stats.totalResumes > 0
									? "cursor-help border border-amber-200 bg-amber-50 text-amber-600"
									: "cursor-not-allowed border border-slate-100 bg-slate-50 text-slate-400",
					)}
				>
					{stats.approvedResumes === stats.totalResumes && stats.totalResumes > 0 ? (
						<>
							<CheckCircleIcon weight="fill" className="size-4" />
							{t`Approved for Placement`}
						</>
					) : poVerifiedResumes + stats.approvedResumes >= stats.totalResumes ? (
						t`Approve for Placement`
					) : poVerifiedResumes > 0 ? (
						t`Verify All (${poVerifiedResumes} / ${stats.totalResumes - stats.approvedResumes}) First`
					) : passedFaculty === stats.totalResumes && stats.totalResumes > 0 ? (
						t`Ready for PO Review`
					) : (
						t`Waiting for Faculty`
					)}
				</button>
			)}
		</div>
	);
}
