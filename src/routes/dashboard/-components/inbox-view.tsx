import { t } from "@lingui/core/macro";
import { ArrowClockwiseIcon, ArrowRightIcon, ClockIcon, TrayIcon } from "@phosphor-icons/react";
import { cn } from "@/utils/style";
import type { StudentWithResumes } from "./student-resume-table";

type InboxGroup = {
	id: string;
	label: string;
	description: string;
	iconBg: string;
	iconColor: string;
	icon: React.ReactNode;
	items: InboxItem[];
};

type InboxItem = {
	resumeId: string;
	resumeName: string;
	updatedAt: Date;
	reviewStatus: string;
	evaluationScore: number | null;
	commentCount: number;
	student: {
		engLabsId: string;
		name: string;
		email: string;
		rollNumber: string | null;
		sectionName: string | null;
	};
};

type InboxViewProps = {
	students: StudentWithResumes[];
	scope: "faculty" | "po";
	onReview?: (resumeId: string, engLabsStudentId: string) => void;
};

function timeAgo(date: Date): string {
	const now = Date.now();
	const diff = now - new Date(date).getTime();
	const minutes = Math.floor(diff / 60_000);
	const hours = Math.floor(diff / 3_600_000);
	const days = Math.floor(diff / 86_400_000);

	if (minutes < 1) return t`just now`;
	if (minutes < 60) return t`${minutes}m ago`;
	if (hours < 24) return t`${hours}h ago`;
	if (days === 1) return t`yesterday`;
	return t`${days}d ago`;
}

export function InboxView({ students, scope, onReview }: InboxViewProps) {
	// Build flat list of inbox items per relevant status
	const allItems: InboxItem[] = students.flatMap((student) =>
		student.resumes.map((resume) => ({
			resumeId: resume.id,
			resumeName: resume.name,
			updatedAt: resume.updatedAt,
			reviewStatus: resume.reviewStatus ?? "DRAFT",
			evaluationScore: resume.evaluationScore,
			commentCount: resume.commentCount,
			student: {
				engLabsId: student.engLabsId,
				name: student.name,
				email: student.email,
				rollNumber: student.rollNumber,
				sectionName: student.sectionName,
			},
		})),
	);

	// Sort newest-first within each group
	const sorted = [...allItems].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

	const groups: InboxGroup[] =
		scope === "faculty"
			? [
					{
						id: "submissions",
						label: t`Student Submissions`,
						description: t`Resumes submitted by students waiting for your review`,
						iconBg: "bg-blue-50",
						iconColor: "text-blue-600",
						icon: <TrayIcon weight="duotone" className="size-5" />,
						items: sorted.filter((i) => i.reviewStatus === "SUBMITTED_TO_FACULTY"),
					},
				]
			: [
					{
						id: "submitted_to_po",
						label: t`Submitted to PO`,
						description: t`Sections submitted by faculty awaiting your review`,
						iconBg: "bg-orange-50",
						iconColor: "text-orange-600",
						icon: <TrayIcon weight="duotone" className="size-5" />,
						items: sorted.filter((i) => i.reviewStatus === "SUBMITTED_TO_PO"),
					},
					{
						id: "resubmissions",
						label: t`Resubmitted to PO`,
						description: t`Sections resubmitted by faculty after your feedback`,
						iconBg: "bg-amber-50",
						iconColor: "text-amber-600",
						icon: <ArrowClockwiseIcon weight="duotone" className="size-5" />,
						items: sorted.filter((i) => i.reviewStatus === "RESUBMITTED_TO_PO"),
					},
				];

	const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

	if (totalCount === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 border-dashed bg-slate-50 py-16 text-center">
				<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
					<TrayIcon weight="duotone" className="size-7 text-slate-400" />
				</div>
				<p className="font-bold text-base text-slate-700">{t`Inbox is empty`}</p>
				<p className="mt-1 max-w-xs text-slate-400 text-sm">
					{scope === "faculty"
						? t`No student submissions are waiting for your review.`
						: t`No resumes from faculty or student resubmissions are pending your action.`}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{groups
				.filter((g) => g.items.length > 0)
				.map((group) => (
					<div key={group.id} className="space-y-3">
						{/* Group Header */}
						<div className="flex items-center gap-3">
							<div
								className={cn(
									"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
									group.iconBg,
									group.iconColor,
								)}
							>
								{group.icon}
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="font-bold text-slate-900 text-sm">{group.label}</span>
									<span className="rounded-full bg-slate-900 px-2 py-0.5 font-bold text-[10px] text-white">
										{group.items.length}
									</span>
								</div>
								<p className="text-slate-500 text-xs">{group.description}</p>
							</div>
						</div>

						{/* Items */}
						<div className="space-y-2">
							{group.items.map((item) => (
								<InboxCard key={item.resumeId} item={item} onReview={onReview} />
							))}
						</div>
					</div>
				))}
		</div>
	);
}

function InboxCard({
	item,
	onReview,
}: {
	item: InboxItem;
	onReview?: (resumeId: string, engLabsStudentId: string) => void;
}) {
	const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
		SUBMITTED_TO_FACULTY: { bg: "bg-blue-50", text: "text-blue-700", label: t`Submitted` },
		FINALIZED_BY_FACULTY: { bg: "bg-indigo-50", text: "text-indigo-700", label: t`Faculty Finalized` },
		SUBMITTED_TO_PO: { bg: "bg-orange-50", text: "text-orange-700", label: t`Submitted to PO` },
		RESUBMITTED_TO_PO: { bg: "bg-amber-50", text: "text-amber-700", label: t`Resubmitted` },
	};
	const badge = statusConfig[item.reviewStatus] ?? {
		bg: "bg-slate-100",
		text: "text-slate-500",
		label: item.reviewStatus,
	};

	return (
		<div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm transition-all hover:shadow-md">
			{/* Student avatar */}
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 font-bold text-indigo-600 text-sm">
				{item.student.name.charAt(0).toUpperCase()}
			</div>

			{/* Main content */}
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate font-semibold text-slate-900 text-sm">{item.student.name}</span>
					{item.student.rollNumber && (
						<span className="shrink-0 text-slate-400 text-xs">· {item.student.rollNumber}</span>
					)}
				</div>
				<div className="mt-0.5 flex flex-wrap items-center gap-2 text-slate-500 text-xs">
					<span className="truncate">{item.resumeName}</span>
					{item.student.sectionName && (
						<>
							<span className="text-slate-300">·</span>
							<span className="truncate">{item.student.sectionName}</span>
						</>
					)}
				</div>
			</div>

			{/* Meta */}
			<div className="flex shrink-0 items-center gap-3">
				{/* Timestamp */}
				<div className="hidden items-center gap-1 text-slate-400 text-xs sm:flex">
					<ClockIcon weight="duotone" className="size-3.5" />
					<span>{timeAgo(item.updatedAt)}</span>
				</div>

				{/* Score if evaluated */}
				{item.evaluationScore !== null && (
					<span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700 text-xs">
						{item.evaluationScore.toFixed(1)}/5
					</span>
				)}

				{/* Status badge */}
				<span className={cn("rounded-full px-2.5 py-0.5 font-medium text-xs", badge.bg, badge.text)}>
					{badge.label}
				</span>

				{/* Review CTA */}
				{onReview && (
					<button
						type="button"
						onClick={() => onReview(item.resumeId, item.student.engLabsId)}
						className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 font-semibold text-white text-xs transition-all hover:bg-indigo-700 active:scale-[0.97]"
					>
						{t`Review`}
						<ArrowRightIcon weight="bold" className="size-3" />
					</button>
				)}
			</div>
		</div>
	);
}
