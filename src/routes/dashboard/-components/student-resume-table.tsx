import {
	MagnifyingGlassIcon,
	UserIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { cn } from "@/utils/style";
import { getEvaluationBadgeClass, getStatusBadgeClass } from "./score-helpers";

type ResumeEntry = {
	id: string;
	name: string;
	updatedAt: Date;
	evaluationScore: number | null;
	commentCount: number;
	isSubmitted: boolean;
	status: "not_reviewed" | "submitted" | "evaluated" | "has_comments";
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

export function StudentResumeTable({
	students,
	onReview,
	onStudentClick,
}: StudentResumeTableProps) {
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
			<div className="flex flex-wrap items-center gap-3">
				<div className="relative flex-1">
					<MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						placeholder="Search by name or roll number..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-10 w-full rounded-xl border-0 bg-slate-50 pr-4 pl-9 text-slate-900 text-sm outline-none ring-1 ring-slate-200 transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500"
					/>
				</div>
				<div className="flex gap-1.5">
					{(["all", "not_reviewed", "evaluated", "has_comments"] as const).map((status) => {
						const labels = {
							all: "All",
							not_reviewed: "Not Reviewed",
							evaluated: "Evaluated",
							has_comments: "Has Comments",
						};
						return (
							<button
								key={status}
								type="button"
								onClick={() => setStatusFilter(status)}
								className={cn(
									"rounded-xl px-3 py-2 font-semibold text-xs transition-all active:scale-[0.97]",
									statusFilter === status
										? "bg-indigo-600 text-white"
										: "bg-slate-100 text-slate-600 hover:bg-slate-200",
								)}
							>
								{labels[status]}
							</button>
						);
					})}
				</div>
			</div>

			{/* Table */}
			{filteredStudents.length === 0 ? (
				<div className="rounded-2xl bg-slate-50 p-12 text-center">
					<p className="font-semibold text-slate-400 text-sm">No students or resumes found</p>
				</div>
			) : (
				<div className="space-y-3">
					{filteredStudents.map((student) => (
						<div key={student.engLabsId} className="rounded-2xl bg-white shadow-sm">
							{/* Student Header */}
							<div className="flex items-center gap-4 px-5 pt-4 pb-2">
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 font-bold text-indigo-600 text-sm">
									{student.name.charAt(0).toUpperCase()}
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate font-semibold text-slate-900 text-sm">{student.name}</p>
									<p className="text-slate-400 text-xs">
										{student.rollNumber ?? student.email}
										{student.sectionName && ` · ${student.sectionName}`}
									</p>
								</div>
								<span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-500 text-xs">
									{student.resumes.length} resume{student.resumes.length !== 1 ? "s" : ""}
								</span>
								{onStudentClick && (
									<button
										type="button"
										onClick={() => onStudentClick(student)}
										title="View student details"
										className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600 active:scale-[0.95]"
									>
										<UserIcon weight="duotone" className="size-4" />
									</button>
								)}
							</div>

							{/* Resumes */}
							{student.resumes.length > 0 ? (
								<div className="space-y-1 px-5 pb-4">
									{student.resumes.map((resume) => {
										const statusBadge = getStatusBadgeClass(resume.status);
										return (
											<div
												key={resume.id}
												className="flex items-center gap-3 rounded-xl bg-slate-50/80 px-4 py-3 transition-all hover:bg-slate-100"
											>
												<div className="min-w-0 flex-1">
													<p className="truncate font-medium text-slate-900 text-sm">{resume.name}</p>
													<p className="text-slate-400 text-xs">
														Updated {new Date(resume.updatedAt).toLocaleDateString()}
													</p>
												</div>

												{/* Score */}
												{resume.evaluationScore !== null && (
													<span
														className={cn(
															"rounded-full px-2.5 py-0.5 font-medium text-xs",
															getEvaluationBadgeClass(resume.evaluationScore),
														)}
													>
														{resume.evaluationScore.toFixed(1)}/5
													</span>
												)}

												{/* Comment count */}
												{resume.commentCount > 0 && (
													<span className="rounded-full bg-sky-50 px-2.5 py-0.5 font-medium text-sky-700 text-xs">
														{resume.commentCount} comment{resume.commentCount !== 1 ? "s" : ""}
													</span>
												)}

												{/* Status badge */}
												<span
													className={cn(
														"rounded-full px-2.5 py-0.5 font-medium text-xs",
														statusBadge.bg,
														statusBadge.text,
													)}
												>
													{statusBadge.label}
												</span>

												{/* Actions */}
												{onReview && (
													<button
														type="button"
														onClick={() => onReview(resume.id, student.engLabsId)}
														className="rounded-xl bg-indigo-600 px-3 py-1.5 font-semibold text-white text-xs transition-all hover:bg-indigo-700 active:scale-[0.97]"
													>
														Review
													</button>
												)}
											</div>
										);
									})}
								</div>
							) : (
								<div className="px-5 pb-4">
									<p className="rounded-xl bg-slate-50/80 px-4 py-3 text-center text-slate-400 text-xs">
										No resumes created yet
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
