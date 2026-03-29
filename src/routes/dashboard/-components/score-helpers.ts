export function getScoreColor(score: number): string {
	if (score >= 4.5) return "text-green-600";
	if (score >= 3.5) return "text-amber-600";
	return "text-red-600";
}

export function getEvaluationBadgeClass(score: number): string {
	if (score >= 4.5) return "bg-green-100 text-green-800";
	if (score >= 3.5) return "bg-amber-100 text-amber-800";
	return "bg-red-100 text-red-800";
}

export function getStatusBadgeClass(status: string): { bg: string; text: string; label: string } {
	switch (status) {
		case "evaluated":
			return { bg: "bg-emerald-50", text: "text-emerald-700", label: "Evaluated" };
		case "submitted":
			return { bg: "bg-indigo-50", text: "text-indigo-700", label: "Submitted for Review" };
		case "has_comments":
			return { bg: "bg-amber-50", text: "text-amber-700", label: "Has Comments" };
		default:
			return { bg: "bg-slate-100", text: "text-slate-500", label: "Not Reviewed" };
	}
}
