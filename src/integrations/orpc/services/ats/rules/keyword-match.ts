import skillsTaxonomy from "@/data/skills-taxonomy.json";
import type { ResumeData } from "@/schema/resume/data";
import type { CategoryScore, RuleResult } from "../index";
import { getAllBullets, getResumeSkills, stripHtml } from "../index";

const MAX_SCORE = 25;

/** Resolve aliases for matching — "AWS" matches "Amazon Web Services" and vice versa */
function buildAliasMap(): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const category of Object.values(skillsTaxonomy.categories)) {
		for (const [skill, aliases] of Object.entries(category)) {
			const allForms = [skill, ...aliases];
			for (const form of allForms) {
				map.set(
					form.toLowerCase(),
					allForms.map((f) => f.toLowerCase()),
				);
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

export async function scoreKeywordMatch(data: ResumeData, jdKeywords: string[]): Promise<CategoryScore> {
	const details: RuleResult[] = [];

	// Gather all resume text
	const resumeSkills = getResumeSkills(data);
	const bullets = getAllBullets(data);
	const summaryText = stripHtml(data.summary.content);
	const headlineText = data.basics.headline;
	const allContent = [...resumeSkills, ...bullets.map((b) => b.text), summaryText, headlineText].join(" ");

	// GUARD: Empty or near-empty resume
	if (allContent.trim().length < 50) {
		return {
			score: 0,
			max: MAX_SCORE,
			details: [
				{
					ruleId: "KW-0",
					ruleName: "Minimum content",
					score: 0,
					maxScore: MAX_SCORE,
					details: "Resume has no meaningful content to evaluate keywords.",
				},
			],
		};
	}

	if (jdKeywords.length === 0) {
		// No JD provided — score against general skills taxonomy for industry density
		const allSkillKeys = Array.from(aliasMap.keys());
		const matchedSkills = allSkillKeys.filter((skill) => keywordFoundInText(skill, allContent));

		// Use a unique set of skills (since aliasMap has multiple entries per skill)
		const uniqueMatched = new Set<string>();
		for (const skill of matchedSkills) {
			const aliases = aliasMap.get(skill);
			if (aliases) uniqueMatched.add(aliases[0]); // Add the primary alias
		}

		const count = uniqueMatched.size;
		// Strict density-based scoring — require minimum 5 skills to earn any points.
		// Non-linear: early skills are worth less; reaching 25+ gives full score.
		// 0-4: 0, 5-7: 1-4, 8-12: 5-12, 13-18: 13-20, 19-25+: 21-25
		const score = count < 5 ? 0 : Math.round(Math.min(MAX_SCORE, (Math.max(0, count - 4) / 21) ** 0.9 * MAX_SCORE));

		details.push({
			ruleId: "KW-1",
			ruleName: "Technical terms across your resume",
			score,
			maxScore: MAX_SCORE,
			details:
				count < 5
					? `We only picked up ${count} familiar technical term${count !== 1 ? "s" : ""} across your whole resume (headline, summary, bullets, and skills list). That is very low. Add a Skills section with languages, frameworks, and tools, and repeat important ones in your experience bullets.`
					: count < 8
						? `We picked up about ${count} familiar technical terms resume-wide — still low. Strong resumes usually show 15–25 specific tools and technologies. Add more in your Skills section and in project or work bullets.`
						: count < 12
							? `About ${count} familiar technical terms detected — below average. Add depth: frameworks (e.g. React, Spring), databases (PostgreSQL, MongoDB), cloud (AWS, GCP), and everyday tools (Docker, Git, CI/CD).`
							: count < 17
								? `About ${count} familiar technical terms — decent. Aim for 20–25 to stand out: add domain tools, certifications, or stack details in bullets.`
								: `About ${count} familiar technical terms — strong coverage for a general ATS check.`,
		});
		return { score, max: MAX_SCORE, details };
	}

	// KW-1: Keyword coverage ratio (15 pts)
	const matchedKeywords = jdKeywords.filter((kw) => keywordFoundInText(kw, allContent));
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

/** Count unique taxonomy skills detected in resume text (same basis as no-JD scoring). */
export function getIndustryTaxonomyMatchCount(data: ResumeData): number {
	const resumeSkills = getResumeSkills(data);
	const bullets = getAllBullets(data);
	const summaryText = stripHtml(data.summary.content);
	const headlineText = data.basics.headline;
	const allContent = [...resumeSkills, ...bullets.map((b) => b.text), summaryText, headlineText].join(" ");
	if (allContent.trim().length < 50) return 0;

	const allSkillKeys = Array.from(aliasMap.keys());
	const matchedSkills = allSkillKeys.filter((skill) => keywordFoundInText(skill, allContent));
	const uniqueMatched = new Set<string>();
	for (const skill of matchedSkills) {
		const aliases = aliasMap.get(skill);
		if (aliases) uniqueMatched.add(aliases[0]);
	}
	return uniqueMatched.size;
}

/** JD keywords that appear somewhere on the resume but not in experience/project/volunteer bullet text (KW-2 gap). */
export function getJdKeywordsNotInBulletText(data: ResumeData, jdKeywords: string[]): string[] {
	if (jdKeywords.length === 0) return [];
	const resumeSkills = getResumeSkills(data);
	const bullets = getAllBullets(data);
	const summaryText = stripHtml(data.summary.content);
	const headlineText = data.basics.headline;
	const allContent = [...resumeSkills, ...bullets.map((b) => b.text), summaryText, headlineText].join(" ");
	const bulletText = bullets.map((b) => b.text).join(" ");
	const matched = jdKeywords.filter((kw) => keywordFoundInText(kw, allContent));
	return matched.filter((kw) => !keywordFoundInText(kw, bulletText));
}
