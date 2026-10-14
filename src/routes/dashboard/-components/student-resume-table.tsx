import { t } from "@lingui/core/macro";
import { CalendarBlankIcon, ChatDotsIcon, MagnifyingGlassIcon, UserIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { cn } from "@/utils/style";
import { getEvaluationBadgeClass, getStatusBadgeClass } from "./score-helpers";

type ResumeEntry = {
	id: string;
	name: string;
	updatedAt: Date;
	evaluationScore: number | null;
	commentCount: number;
	/** The viewing reviewer's own top-level comments, by status (Overview → My reviews). */
	myComments?: { OPEN: number; ADDRESSED: number; RESOLVED: number } | null;
	isSubmitted: boolean;
	status: "not_reviewed" | "submitted" | "evaluated" | "has_comments";
	reviewStatus: string | null;
};

export type StudentWithResumes = {
	engLabsId: string;
	name: string;
	email: string;
	rollNumber: string | null;
	sectionId: string;
	sectionName: string | null;
	resumeAppUserId: string | null;
	resumes: ResumeEntry[];
};

type StudentResumeTableProps = {
	students: StudentWithResumes[];
	onReview?: (resumeId: string, engLabsStudentId: string) => void;
	onStudentClick?: (student: StudentWithResumes) => void;
};

export function StudentResumeTable({ students, onReview, onStudentClick }: StudentResumeTableProps) {
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "not_reviewed" | "evaluated" | "has_comments">("all");

	const filteredStudents = useMemo(() => {
		const query = search.toLowerCase();
		return students
			.map((student) => {
				const matchesSearch =
					!query ||
					student.name.toLowerCase().includes(query) ||
					(student.rollNumber?.toLowerCase().includes(query) ?? false);

				if (!matchesSearch) return null;

				const filteredResumes =
					statusFilter === "all" ? student.resumes : student.resumes.filter((r) => r.status === statusFilter);

				if (filteredResumes.length === 0 && student.resumes.length > 0 && statusFilter !== "all") return null;

				return { ...student, resumes: filteredResumes };
			})
			.filter(Boolean) as StudentWithResumes[];
	}, [students, search, statusFilter]);

	return (
		<div className="space-y-4">
			{/* Search & Filter Bar */}
			<div className="space-y-3">
				<div className="relative">
					<MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder={t`Search by name or roll number...`}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-10 w-full rounded-xl border-0 bg-muted/50 pr-4 pl-9 text-foreground text-sm outline-none ring-1 ring-border transition-all placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-primary"
					/>
				</div>
				<div className="flex flex-wrap gap-1.5">
					{(["all", "not_reviewed", "evaluated", "has_comments"] as const).map((status) => {
						const labels = {
							all: t`All`,
							not_reviewed: t`Not Reviewed`,
							evaluated: t`Evaluated`,
							has_comments: t`Has Comments`,
						};
						return (
							<button
								key={status}
								type="button"
								onClick={() => setStatusFilter(status)}
								className={cn(
									"rounded-xl px-3 py-2 font-semibold text-xs transition-all active:scale-[0.97]",
									statusFilter === status
										? "bg-primary text-white shadow-sm"
										: "bg-muted text-muted-foreground hover:bg-border",
								)}
							>
								{labels[status]}
							</button>
						);
					})}
				</div>
			</div>

			{/* Student Cards */}
			{filteredStudents.length === 0 ? (
				<div className="rounded-2xl bg-muted/50 py-12 text-center">
					<p className="font-semibold text-muted-foreground text-sm">{t`No students or resumes found`}</p>
				</div>
			) : (
				<div className="space-y-3">
					{filteredStudents.map((student) => (
						<div
							key={student.engLabsId}
							className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
						>
							{/* Student Header */}
							<div className="flex items-center gap-3 border-border border-b bg-muted/50 px-4 py-3">
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary text-sm">
									{student.name.charAt(0).toUpperCase()}
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate font-semibold text-foreground text-sm leading-tight">{student.name}</p>
									<p className="mt-0.5 text-muted-foreground text-xs">
										{student.rollNumber ?? student.email}
										{student.sectionName && <span className="ml-1 text-muted-foreground">·</span>}
										{student.sectionName && <span className="ml-1 text-muted-foreground">{student.sectionName}</span>}
									</p>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<span className="rounded-full bg-card px-2.5 py-0.5 font-medium text-muted-foreground text-xs ring-1 ring-border">
										{student.resumes.length} resume{student.resumes.length !== 1 ? "s" : ""}
									</span>
									{onStudentClick && (
										<button
											type="button"
											onClick={() => onStudentClick(student)}
											title={t`View student details`}
											className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground ring-1 ring-border transition-all hover:bg-primary/5 hover:text-primary hover:ring-primary/20 active:scale-[0.95]"
										>
											<UserIcon weight="duotone" className="size-3.5" />
										</button>
									)}
								</div>
							</div>

							{/* Resume Entries */}
							{student.resumes.length > 0 ? (
								<div className="divide-y divide-border">
									{student.resumes.map((resume) => {
										const statusInfo = getStatusBadgeClass(resume.reviewStatus || resume.status);
										return (
											<div key={resume.id} className="px-4 py-3 transition-colors hover:bg-muted/50">
												{/* Resume name + date row */}
												<div className="mb-2.5 flex items-start justify-between gap-3">
													<p className="truncate font-semibold text-foreground text-sm leading-tight">{resume.name}</p>
													<span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
														<CalendarBlankIcon className="size-3" />
														{new Date(resume.updatedAt).toLocaleDateString()}
													</span>
												</div>

												{/* Badges + action row */}
												<div className="flex flex-wrap items-center gap-2">
													{/* Status badge */}
													<span
														className={cn(
															"rounded-full px-2.5 py-0.5 font-semibold text-[11px]",
															statusInfo.bg,
															statusInfo.text,
														)}
													>
														{statusInfo.label}
													</span>

													{/* Score badge */}
													{resume.evaluationScore !== null && (
														<span
															className={cn(
																"rounded-full px-2.5 py-0.5 font-semibold text-[11px]",
																getEvaluationBadgeClass(resume.evaluationScore),
															)}
														>
															Score: {resume.evaluationScore.toFixed(1)}/5
														</span>
													)}

													{/* Comment count */}
													{resume.commentCount > 0 && (
														<span className="flex items-center gap-1 rounded-full bg-primary/5 px-2.5 py-0.5 font-semibold text-[11px] text-primary">
															<ChatDotsIcon className="size-3" />
															{resume.commentCount} comment{resume.commentCount !== 1 ? "s" : ""}
														</span>
													)}

													{/* Spacer */}
													<div className="flex-1" />

													{/* Review action */}
													{onReview && (
														<button
															type="button"
															onClick={() => onReview(resume.id, student.engLabsId)}
															className="rounded-xl bg-primary px-3.5 py-1.5 font-bold text-white text-xs shadow-sm transition-all hover:bg-primary/90 active:scale-[0.97]"
														>
															{t`Review`}
														</button>
													)}
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<div className="px-4 py-4">
									<p className="rounded-xl bg-muted/50 px-4 py-3 text-center text-muted-foreground text-xs">
										{t`No resumes created yet`}
									</p>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
