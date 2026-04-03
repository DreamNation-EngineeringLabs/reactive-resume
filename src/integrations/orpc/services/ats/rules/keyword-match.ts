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

/**
 * Normalize text for matching: lowercase, replace non-alphanumeric/special chars with spaces.
 * Preserves +, #, . so "C++", "C#", "Node.js" remain distinct.
 */
function normalizeForMatch(text: string): string {
	return text.toLowerCase().replace(/[^a-z0-9+#.]/g, " ");
}

/**
 * Check if a keyword appears in text with proper word-boundary awareness.
 *
 * Short keywords (≤2 chars of alphanumeric content, e.g. "C", "R", "Go", "JS", "TS") use strict
 * word-boundary matching — surrounded by spaces in the normalized text — to prevent false positives
 * like "C" matching "architecture" or "Go" matching "going".
 *
 * Longer keywords use substring matching which intentionally allows "SQL" to match "MySQL" /
 * "PostgreSQL" (a desired signal) and "React" to match "React Native".
 */
function keywordFoundInText(keyword: string, text: string): boolean {
	// Pad normalized text with spaces so we can use " keyword " boundary checks
	const normalizedText = " " + normalizeForMatch(text) + " ";
	const normalizedKw = normalizeForMatch(keyword);

	// Count meaningful alphanumeric characters in the keyword (ignoring spaces inserted by normalization)
	const kwAlphaLen = normalizedKw.replace(/\s+/g, "").length;

	const matchesInText = (term: string): boolean => {
		const termAlphaLen = term.replace(/\s+/g, "").length;
		// Use word-boundary match for short terms (≤2 meaningful chars: C, R, Go, JS, TS, C#, C++)
		if (termAlphaLen <= 2) {
			return normalizedText.includes(` ${term} `);
		}
		return normalizedText.includes(term);
	};

	// Direct match
	if (matchesInText(normalizedKw)) return true;

	// Alias match — covers abbreviations (JS→JavaScript, K8s→Kubernetes, etc.)
	const aliases = aliasMap.get(keyword.toLowerCase());
	if (aliases) {
		return aliases.some((alias) => matchesInText(normalizeForMatch(alias)));
	}

	// For multi-word keywords, also try matching each significant word individually
	// e.g. "React Native" should match if resume has "React Native developer"
	// but "problem solving" should NOT fragment-match against unrelated text
	const words = normalizedKw.split(/\s+/).filter((w) => w.length > 3);
	if (words.length >= 2 && kwAlphaLen > 6) {
		// All significant words must be present (not just one)
		return words.every((w) => normalizedText.includes(w));
	}

	return false;
}

/**
 * Exported version that accepts a ResumeData and builds allContent internally.
 * Used by index.ts to keep the metadata keyword matching consistent with scoring.
 */
export function keywordFoundInResumeText(keyword: string, data: ResumeData): boolean {
	const resumeSkills = getResumeSkills(data);
	const bullets = getAllBullets(data);
	const summaryText = stripHtml(data.summary.content);
	const headlineText = data.basics.headline;
	const allContent = [...resumeSkills, ...bullets.map((b) => b.text), summaryText, headlineText].join(" ");
	return keywordFoundInText(keyword, allContent);
}

export async function scoreKeywordMatch(
	data: ResumeData,
	jdKeywords: string[],
	softKeywords: string[] = [],
): Promise<CategoryScore> {
	const details: RuleResult[] = [];

	// Gather all resume text (skills + bullets + summary + headline)
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

	if (jdKeywords.length === 0 && softKeywords.length === 0) {
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
		// Scoring curve: requires minimum 5 recognizable skills to earn any points.
		// Uses a sub-linear power curve (exponent 0.9) so early skills are worth less.
		// Explicit thresholds: 0-4→0pts | 5→1pt | 8→6pts | 12→12pts | 17→18pts | 21→22pts | 25+→25pts
		const score = count < 5 ? 0 : Math.round(Math.min(MAX_SCORE, (Math.max(0, count - 4) / 21) ** 0.9 * MAX_SCORE));

		// Compute what score the next threshold would unlock (for motivating feedback)
		const nextThreshold = count < 5 ? 5 : count < 8 ? 8 : count < 12 ? 12 : count < 17 ? 17 : count < 21 ? 21 : null;
		const nextScore =
			nextThreshold !== null
				? Math.round(Math.min(MAX_SCORE, (Math.max(0, nextThreshold - 4) / 21) ** 0.9 * MAX_SCORE))
				: MAX_SCORE;

		const curveNote =
			nextThreshold !== null
				? ` Scoring curve: reaching ${nextThreshold} terms unlocks ~${nextScore}/25.`
				: " You've reached the top tier of the scoring curve.";

		details.push({
			ruleId: "KW-1",
			ruleName: "Technical terms across your resume",
			score,
			maxScore: MAX_SCORE,
			details:
				count < 5
					? `We only picked up ${count} familiar technical term${count !== 1 ? "s" : ""} across your whole resume (headline, summary, bullets, and skills list). That is very low — scores 0/25 below 5 terms. Add a Skills section with languages, frameworks, and tools, and repeat important ones in your experience bullets.${curveNote}`
					: count < 8
						? `We picked up about ${count} familiar technical terms resume-wide — still low (${score}/25). Strong resumes usually show 15–25 specific tools and technologies. Add more in your Skills section and in project or work bullets.${curveNote}`
						: count < 12
							? `About ${count} familiar technical terms detected — below average (${score}/25). Add depth: frameworks (e.g. React, Spring), databases (PostgreSQL, MongoDB), cloud (AWS, GCP), and everyday tools (Docker, Git, CI/CD).${curveNote}`
							: count < 17
								? `About ${count} familiar technical terms (${score}/25) — decent. Aim for 20–25 to stand out: add domain tools, certifications, or stack details in bullets.${curveNote}`
								: `About ${count} familiar technical terms (${score}/25) — strong coverage for a general ATS check.${curveNote}`,
		});
		return { score, max: MAX_SCORE, details };
	}

	// ─── JD mode ───────────────────────────────────────────────────────────────
	// KW-1: Technical keyword coverage ratio (12 pts — reduced from 15 to make room for KW-3)
	const matchedKeywords = jdKeywords.filter((kw) => keywordFoundInText(kw, allContent));
	const coverageRatio = jdKeywords.length > 0 ? matchedKeywords.length / jdKeywords.length : 1;
	const kw1Score = Math.round(coverageRatio * 12);

	details.push({
		ruleId: "KW-1",
		ruleName: "Technical keyword coverage",
		score: kw1Score,
		maxScore: 12,
		details:
			jdKeywords.length === 0
				? "No hard technical keywords in this JD — full marks."
				: `${matchedKeywords.length}/${jdKeywords.length} technical keywords/tools matched (${Math.round(coverageRatio * 100)}%).`,
	});

	// KW-2: Keywords used in context (in bullets, not just listed) (8 pts — reduced from 10)
	const bulletText = bullets.map((b) => b.text).join(" ");
	const keywordsInContext = matchedKeywords.filter((kw) => keywordFoundInText(kw, bulletText));
	const contextRatio = matchedKeywords.length > 0 ? keywordsInContext.length / matchedKeywords.length : 1;
	const kw2Score = Math.round(contextRatio * 8);

	details.push({
		ruleId: "KW-2",
		ruleName: "Keywords used in context",
		score: kw2Score,
		maxScore: 8,
		details:
			matchedKeywords.length === 0
				? "No technical keywords matched — nothing to check in context."
				: `${keywordsInContext.length}/${matchedKeywords.length} matched keywords also appear in experience/project bullets (${Math.round(contextRatio * 100)}%).${
						contextRatio < 0.6 && keywordsInContext.length < matchedKeywords.length
							? ` Missing in bullets: ${matchedKeywords
									.filter((kw) => !keywordsInContext.includes(kw))
									.slice(0, 5)
									.join(", ")}${matchedKeywords.filter((kw) => !keywordsInContext.includes(kw)).length > 5 ? "…" : ""}.`
							: ""
					}`,
	});

	// KW-3: Soft skills & methodologies coverage (5 pts — NEW)
	// Covers: soft skills (communication, leadership…), process methodologies (Agile, Scrum, TDD, REST…),
	// certifications, and architectural patterns required by the JD.
	let kw3Score = 0;
	let kw3Details = "";

	if (softKeywords.length === 0) {
		// No soft requirements in this JD — award full points
		kw3Score = 5;
		kw3Details = "No soft skills or methodology requirements in this JD.";
	} else {
		const matchedSoft = softKeywords.filter((kw) => keywordFoundInText(kw, allContent));
		const softRatio = matchedSoft.length / softKeywords.length;
		kw3Score = Math.round(softRatio * 5);

		const missedSoft = softKeywords.filter((kw) => !keywordFoundInText(kw, allContent));
		kw3Details =
			missedSoft.length === 0
				? `All ${softKeywords.length} soft/methodology keywords matched (${matchedSoft.length}/${softKeywords.length}).`
				: `${matchedSoft.length}/${softKeywords.length} soft/methodology keywords matched. Missing: ${missedSoft.slice(0, 6).join(", ")}${missedSoft.length > 6 ? `… (+${missedSoft.length - 6} more)` : ""}.`;
	}

	details.push({
		ruleId: "KW-3",
		ruleName: "Soft skills & methodologies",
		score: kw3Score,
		maxScore: 5,
		details: kw3Details,
	});

	const totalScore = Math.min(MAX_SCORE, kw1Score + kw2Score + kw3Score);
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
	const bullets = getAllBullets(data);
	const bulletText = bullets.map((b) => b.text).join(" ");
	const resumeSkills = getResumeSkills(data);
	const summaryText = stripHtml(data.summary.content);
	const headlineText = data.basics.headline;
	const allContent = [...resumeSkills, ...bullets.map((b) => b.text), summaryText, headlineText].join(" ");
	const matched = jdKeywords.filter((kw) => keywordFoundInText(kw, allContent));
	return matched.filter((kw) => !keywordFoundInText(kw, bulletText));
}
