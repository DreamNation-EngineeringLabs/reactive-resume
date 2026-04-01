import type { ResumeData } from "@/schema/resume/data";
import type { CategoryScore, RuleResult } from "../index";
import { extractBullets, stripHtml } from "../index";

const MAX_SCORE = 20;

const REQUIRED_SECTIONS = ["experience", "education", "skills", "projects"] as const;

const MIN_EXPERIENCE_BULLETS_TOTAL = 2;
const MIN_EXPERIENCE_LONGEST_BULLET_WORDS = 10;
const MIN_EXPERIENCE_AVG_WORDS_PER_BULLET = 6;
const MIN_PROJECT_DESCRIPTION_WORDS = 20;
const MIN_SKILL_ROWS_FILLED = 2;

/** Experience section: enough bullets overall + at least one substantive line (structure ≠ impact, but not a hollow section). */
function experienceSectionHasDepth(visibleItems: Array<{ description?: string }>): boolean {
	const bullets: string[] = [];
	for (const item of visibleItems) {
		const desc = "description" in item ? String((item as { description: string }).description ?? "") : "";
		bullets.push(...extractBullets(desc));
	}
	if (bullets.length < MIN_EXPERIENCE_BULLETS_TOTAL) return false;
	const wordCounts = bullets.map((b) => b.split(/\s+/).filter(Boolean).length);
	const longest = Math.max(...wordCounts);
	const avg = wordCounts.reduce((a, n) => a + n, 0) / wordCounts.length;
	return longest >= MIN_EXPERIENCE_LONGEST_BULLET_WORDS && avg >= MIN_EXPERIENCE_AVG_WORDS_PER_BULLET;
}

/** Check if a project item has a meaningful description (aligned with coaching — not full quality scoring). */
function projectHasContent(description: string): boolean {
	const text = stripHtml(description).trim();
	return text.split(/\s+/).filter(Boolean).length >= MIN_PROJECT_DESCRIPTION_WORDS;
}

/** Check if an education item has degree information */
function educationIsComplete(item: Record<string, unknown>): boolean {
	const degree = String(item.degree ?? "").trim();
	const area = String(item.area ?? "").trim();
	const institution = String(item.institution ?? item.school ?? "").trim();
	// Must have at least institution + one of degree/area
	return institution.length > 0 && (degree.length > 0 || area.length > 0);
}

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
export function isReverseChronological(items: Array<{ period?: string; date?: string; hidden?: boolean }>): boolean {
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
	let totalScore = MAX_SCORE;

	// SC-1: Required sections present AND have meaningful content (8 pts)
	// Tier 1 (4 pts): Section exists with at least one visible item
	// Tier 2 (4 pts): Section has substantive content (bullets, descriptions, degree info)
	const missingSections: string[] = [];
	const thinSections: string[] = [];

	for (const key of REQUIRED_SECTIONS) {
		const section = data.sections[key];
		const visibleItems = section.hidden ? [] : section.items.filter((item) => !item.hidden);

		if (visibleItems.length === 0) {
			missingSections.push(key);
			continue;
		}

		// Tier 2: content depth check
		if (key === "experience") {
			const hasRealBullets = experienceSectionHasDepth(visibleItems as Array<{ description?: string }>);
			if (!hasRealBullets) {
				thinSections.push("experience (needs multiple bullets with fuller lines — not just placeholders)");
			}
		} else if (key === "projects") {
			const hasRealContent = visibleItems.some((item) => {
				const desc = "description" in item ? (item as { description: string }).description : "";
				return projectHasContent(desc);
			});
			if (!hasRealContent)
				thinSections.push("projects (descriptions too short — aim for a short paragraph per project)");
		} else if (key === "education") {
			const hasCompleteEntry = visibleItems.some((item) => educationIsComplete(item as Record<string, unknown>));
			if (!hasCompleteEntry) thinSections.push("education (missing degree/area)");
		} else if (key === "skills") {
			let filledRows = 0;
			let keywordCount = 0;
			for (const item of visibleItems) {
				const name = String((item as { name?: string }).name ?? "").trim();
				const keywords = (item as { keywords?: string[] }).keywords ?? [];
				keywordCount += keywords.length;
				if (name.length > 0 || keywords.length > 0) filledRows++;
			}
			const hasSkills = filledRows >= MIN_SKILL_ROWS_FILLED || (filledRows >= 1 && keywordCount >= 4);
			if (!hasSkills) {
				thinSections.push(
					`skills (add at least ${MIN_SKILL_ROWS_FILLED} skill rows, or one row with several tools listed)`,
				);
			}
		}
	}

	const tier1Penalty = Math.round((missingSections.length / REQUIRED_SECTIONS.length) * 4);
	const tier2Penalty = Math.min(4, thinSections.length);
	const sc1Score = Math.max(0, 8 - tier1Penalty - tier2Penalty);
	totalScore -= 8 - sc1Score;

	const sc1Issues = [...missingSections.map((s) => `Missing: ${s}`), ...thinSections.map((s) => `Thin content: ${s}`)];

	details.push({
		ruleId: "SC-1",
		ruleName: "Required sections present & content depth",
		score: sc1Score,
		maxScore: 8,
		details:
			sc1Issues.length > 0
				? `Issues found: ${sc1Issues.join("; ")}. Add specific accomplishments, degree info, and detailed descriptions. -${8 - sc1Score} pts.`
				: "All required sections (Experience, Education, Skills, Projects) are present with meaningful content.",
	});

	// SC-2: Recommended sections present (4 pts)
	let sc2Score = 4;
	const summaryPresent = !data.summary.hidden && stripHtml(data.summary.content).trim().length > 0;
	if (!summaryPresent) {
		sc2Score -= 2;
		totalScore -= 2;
	}

	const profilesPresent = !data.sections.profiles.hidden && data.sections.profiles.items.some((item) => !item.hidden);
	if (!profilesPresent) {
		sc2Score -= 2;
		totalScore -= 2;
	}

	details.push({
		ruleId: "SC-2",
		ruleName: "Recommended sections present",
		score: sc2Score,
		maxScore: 4,
		details:
			[summaryPresent ? null : "Missing: Summary", profilesPresent ? null : "Missing: Profiles/Links"]
				.filter(Boolean)
				.join("; ") || "Summary and Profiles sections present.",
	});

	// SC-3: Reverse chronological order (4 pts)
	const sectionsToCheck = [
		{ key: "experience", label: "Experience" },
		{ key: "education", label: "Education" },
		{ key: "projects", label: "Projects" },
	] as const;

	let sc3Score = 4;
	const outOfOrder: string[] = [];
	const emptySections: string[] = [];

	for (const { key, label } of sectionsToCheck) {
		const section = data.sections[key];
		if (section.hidden || section.items.filter((i) => !i.hidden).length === 0) {
			emptySections.push(label);
			continue;
		}
		const items = section.items as Array<{ period?: string; date?: string; hidden?: boolean }>;
		if (!isReverseChronological(items)) {
			outOfOrder.push(label);
		}
	}

	// Penalize for out-of-order AND for empty sections (no way to verify order)
	const sc3Penalty = outOfOrder.length * 2 + emptySections.length * 0.5;
	sc3Score = Math.max(0, 4 - sc3Penalty);
	totalScore -= 4 - sc3Score;

	details.push({
		ruleId: "SC-3",
		ruleName: "Reverse chronological order",
		score: Math.round(sc3Score),
		maxScore: 4,
		details:
			outOfOrder.length > 0
				? `Not in reverse chronological order: ${outOfOrder.join(", ")}.`
				: emptySections.length === sectionsToCheck.length
					? "Unable to verify order (all sections empty)."
					: "Relevant sections are in reverse chronological order.",
	});

	// SC-4: Contact information complete (4 pts)
	let sc4Score = 4;
	const missingContact: string[] = [];
	if (!data.basics.name.trim()) {
		missingContact.push("name");
		sc4Score -= 1;
		totalScore -= 1;
	}
	if (!data.basics.email.trim()) {
		missingContact.push("email");
		sc4Score -= 1;
		totalScore -= 1;
	}
	if (!data.basics.phone.trim()) {
		missingContact.push("phone");
		sc4Score -= 1;
		totalScore -= 1;
	}
	if (!data.basics.location.trim()) {
		missingContact.push("location");
		sc4Score -= 1;
		totalScore -= 1;
	}

	details.push({
		ruleId: "SC-4",
		ruleName: "Contact information complete",
		score: sc4Score,
		maxScore: 4,
		details:
			missingContact.length > 0
				? `Missing contact info: ${missingContact.join(", ")}.`
				: "All contact information present.",
	});

	return { score: Math.max(0, Math.round(totalScore)), max: MAX_SCORE, details };
}
