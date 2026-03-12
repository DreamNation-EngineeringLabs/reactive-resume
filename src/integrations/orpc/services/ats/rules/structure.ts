import type { ResumeData } from "@/schema/resume/data";
import type { CategoryScore, RuleResult } from "../index";

const MAX_SCORE = 20;

const REQUIRED_SECTIONS = ["experience", "education", "skills"] as const;

/** Extract the most recent year from a date/period string */
export function extractLatestYear(dateStr?: string): number {
	if (!dateStr) return 0;
	// "Present" / "Current" = treat as future so it sorts first
	if (/\b(present|current|now|ongoing)\b/i.test(dateStr)) return 9999;
	const match = dateStr.match(/(\d{4})/g);
	if (!match) return 0;
	return Math.max(...match.map(Number));
}

/** Check if items are in reverse-chronological order based on period/date strings */
export function isReverseChronological(
	items: Array<{ period?: string; date?: string; hidden?: boolean }>,
): boolean {
	const visibleItems = items.filter((item) => !item.hidden && (item.period || item.date));
	if (visibleItems.length <= 1) return true;

	const years = visibleItems.map((item) => extractLatestYear(item.period || item.date));

	// Check if years are in descending order
	for (let i = 1; i < years.length; i++) {
		if (years[i] > years[i - 1]) return false;
	}
	return true;
}

export async function scoreStructure(data: ResumeData): Promise<CategoryScore> {
	const details: RuleResult[] = [];

	// SC-1: Required sections present (8 pts)
	const presentRequired = REQUIRED_SECTIONS.filter((key) => {
		const section = data.sections[key];
		return !section.hidden && section.items.some((item) => !item.hidden);
	});

	const sc1Score = Math.round((presentRequired.length / REQUIRED_SECTIONS.length) * 8);
	const missingRequired = REQUIRED_SECTIONS.filter((key) => {
		const section = data.sections[key];
		return section.hidden || !section.items.some((item) => !item.hidden);
	});

	details.push({
		ruleId: "SC-1",
		ruleName: "Required sections present",
		score: sc1Score,
		maxScore: 8,
		details: missingRequired.length > 0
			? `Missing required sections: ${missingRequired.join(", ")}.`
			: "All required sections present.",
	});

	// SC-2: Recommended sections present (4 pts)
	let sc2Score = 0;
	const summaryPresent = !data.summary.hidden && data.summary.content.trim().length > 0;
	if (summaryPresent) sc2Score += 2;

	const profilesPresent = !data.sections.profiles.hidden &&
		data.sections.profiles.items.some((item) => !item.hidden);
	if (profilesPresent) sc2Score += 2;

	details.push({
		ruleId: "SC-2",
		ruleName: "Recommended sections present",
		score: sc2Score,
		maxScore: 4,
		details: [
			summaryPresent ? null : "Missing: Summary section",
			profilesPresent ? null : "Missing: Profiles/Links section",
		].filter(Boolean).join("; ") || "Summary and Profiles sections present.",
	});

	// SC-3: Reverse chronological order (4 pts)
	// Check all sections that have date/period fields
	const sectionsToCheck = [
		{ key: "experience", label: "Experience" },
		{ key: "education", label: "Education" },
		{ key: "projects", label: "Projects" },
		{ key: "volunteer", label: "Volunteer" },
		{ key: "awards", label: "Awards" },
		{ key: "certifications", label: "Certifications" },
		{ key: "publications", label: "Publications" },
	] as const;

	const outOfOrder: string[] = [];
	for (const { key, label } of sectionsToCheck) {
		const section = data.sections[key];
		if (section.hidden) continue;
		const items = section.items as Array<{ period?: string; date?: string; hidden?: boolean }>;
		if (!isReverseChronological(items)) {
			outOfOrder.push(label);
		}
	}

	const sc3Score = outOfOrder.length === 0 ? 4 : Math.max(0, 4 - outOfOrder.length);

	details.push({
		ruleId: "SC-3",
		ruleName: "Reverse chronological order",
		score: sc3Score,
		maxScore: 4,
		details: outOfOrder.length > 0
			? `Not in reverse chronological order: ${outOfOrder.join(", ")}.`
			: "All sections are in reverse chronological order.",
	});

	// SC-4: Contact information complete (4 pts)
	let sc4Score = 0;
	if (data.basics.name.trim()) sc4Score += 1;
	if (data.basics.email.trim()) sc4Score += 1;
	if (data.basics.phone.trim()) sc4Score += 1;
	if (data.basics.location.trim()) sc4Score += 1;

	const missingContact: string[] = [];
	if (!data.basics.name.trim()) missingContact.push("name");
	if (!data.basics.email.trim()) missingContact.push("email");
	if (!data.basics.phone.trim()) missingContact.push("phone");
	if (!data.basics.location.trim()) missingContact.push("location");

	details.push({
		ruleId: "SC-4",
		ruleName: "Contact information complete",
		score: sc4Score,
		maxScore: 4,
		details: missingContact.length > 0
			? `Missing contact info: ${missingContact.join(", ")}.`
			: "All contact information present.",
	});

	const totalScore = Math.min(MAX_SCORE, sc1Score + sc2Score + sc3Score + sc4Score);
	return { score: totalScore, max: MAX_SCORE, details };
}
