import type { ResumeData } from "@/schema/resume/data";
import type { CategoryScore, RuleResult } from "../index";
import { getResumeSkills, getAllBullets, stripHtml } from "../index";
import skillsTaxonomy from "@/data/skills-taxonomy.json";

const MAX_SCORE = 25;

/** Resolve aliases for matching — "AWS" matches "Amazon Web Services" and vice versa */
function buildAliasMap(): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const category of Object.values(skillsTaxonomy.categories)) {
		for (const [skill, aliases] of Object.entries(category)) {
			const allForms = [skill, ...aliases];
			for (const form of allForms) {
				map.set(form.toLowerCase(), allForms.map((f) => f.toLowerCase()));
			}
		}
	}
	return map;
}

const aliasMap = buildAliasMap();

function normalizeForMatch(text: string): string {
	return text.toLowerCase().replace(/[^a-z0-9+#.]/g, " ");
}

function keywordFoundInText(keyword: string, text: string): boolean {
	const normalizedText = normalizeForMatch(text);
	const normalizedKw = keyword.toLowerCase();

	// Direct match
	if (normalizedText.includes(normalizeForMatch(normalizedKw))) return true;

	// Alias match
	const aliases = aliasMap.get(normalizedKw);
	if (aliases) {
		return aliases.some((alias) => normalizedText.includes(normalizeForMatch(alias)));
	}

	return false;
}

export async function scoreKeywordMatch(
	data: ResumeData,
	jdKeywords: string[],
): Promise<CategoryScore> {
	const details: RuleResult[] = [];

	if (jdKeywords.length === 0) {
		// No JD provided — give full marks for keyword match
		details.push({
			ruleId: "KW-1",
			ruleName: "Keyword coverage ratio",
			score: 15,
			maxScore: 15,
			details: "No job description provided — keyword match skipped.",
		});
		details.push({
			ruleId: "KW-2",
			ruleName: "Keywords in context",
			score: 10,
			maxScore: 10,
			details: "No job description provided — keyword context check skipped.",
		});
		return { score: MAX_SCORE, max: MAX_SCORE, details };
	}

	// Gather all resume text
	const resumeSkills = getResumeSkills(data);
	const bullets = getAllBullets(data);
	const summaryText = stripHtml(data.summary.content);
	const headlineText = data.basics.headline;
	const allText = [
		...resumeSkills,
		...bullets.map((b) => b.text),
		summaryText,
		headlineText,
	].join(" ");

	// KW-1: Keyword coverage ratio (15 pts)
	const matchedKeywords = jdKeywords.filter((kw) => keywordFoundInText(kw, allText));
	const coverageRatio = matchedKeywords.length / jdKeywords.length;
	const kw1Score = Math.round(coverageRatio * 15);

	details.push({
		ruleId: "KW-1",
		ruleName: "Keyword coverage ratio",
		score: kw1Score,
		maxScore: 15,
		details: `${matchedKeywords.length}/${jdKeywords.length} keywords found (${Math.round(coverageRatio * 100)}%).`,
	});

	// KW-2: Keywords used in context (in bullets, not just listed) (10 pts)
	const bulletText = bullets.map((b) => b.text).join(" ");
	const keywordsInContext = matchedKeywords.filter((kw) => keywordFoundInText(kw, bulletText));
	const contextRatio = matchedKeywords.length > 0 ? keywordsInContext.length / matchedKeywords.length : 1;
	const kw2Score = Math.round(contextRatio * 10);

	details.push({
		ruleId: "KW-2",
		ruleName: "Keywords in context",
		score: kw2Score,
		maxScore: 10,
		details: `${keywordsInContext.length}/${matchedKeywords.length} matched keywords also appear in bullet descriptions.`,
	});

	const totalScore = Math.min(MAX_SCORE, kw1Score + kw2Score);
	return { score: totalScore, max: MAX_SCORE, details };
}
