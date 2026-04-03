import type { ResumeData } from "@/schema/resume/data";
import { extractKeywords } from "./keyword-extractor";
import { scoreBrevity } from "./rules/brevity";
import { scoreContentQuality } from "./rules/content-quality";
import { scoreFormatting } from "./rules/formatting";
import { scoreImpactMetrics } from "./rules/impact-metrics";
import { getIndustryTaxonomyMatchCount, scoreKeywordMatch } from "./rules/keyword-match";
import { scoreStructure } from "./rules/structure";
import { scoreTailoring } from "./rules/tailoring";
import { generateSuggestions } from "./suggestion-generator";

export interface RuleResult {
	ruleId: string;
	ruleName: string;
	score: number;
	maxScore: number;
	details?: string;
}

export interface DiffHunk {
	removed?: string;
	added?: string;
	context?: string;
}

export interface SuggestionDiff {
	type: "text_replace" | "field_replace" | "add_item" | "remove_item" | "reorder";
	location: string;
	fieldPath: string;
	hunks: DiffHunk[];
}

export interface JsonPatchOp {
	op: "add" | "remove" | "replace" | "move" | "copy" | "test" | "replace-bullet" | "remove-bullet";
	path: string;
	value?: unknown;
	from?: string;
	oldText?: string;
	newText?: string;
}

/** Optional structured body for readable suggestion cards (bullets / sections). */
export interface SuggestionBodySection {
	title?: string;
	items: string[];
}

export interface Suggestion {
	id: string;
	ruleId: string;
	category: string;
	severity: "critical" | "warning" | "info";
	title: string;
	description: string;
	/** When set, UIs should prefer rendering these as a list instead of a single paragraph. */
	descriptionBullets?: string[];
	bodySections?: SuggestionBodySection[];
	autoApplicable: boolean;
	patches?: JsonPatchOp[];
	estimatedScoreGain: number;
	diff: SuggestionDiff;
}

export interface CategoryScore {
	score: number;
	max: number;
	details: RuleResult[];
}

export interface ScoringResult {
	overall: number;
	categories: {
		keywordMatch: CategoryScore;
		impactMetrics: CategoryScore;
		structure: CategoryScore;
		formatting: CategoryScore;
		brevity: CategoryScore;
		tailoring: CategoryScore | null;
	};
	suggestions: Suggestion[];
	metadata: {
		jdProvided: boolean;
		keywordsExtracted: string[];
		keywordsMatched: string[];
		keywordsMissing: string[];
		totalBullets: number;
		estimatedPages: number;
		/** True when AI-powered rewrites were skipped or failed (e.g. no API key, LLM error). */
		aiRewriteUnavailable?: boolean;
		/**
		 * Number of unique taxonomy skills detected in the resume (no-JD mode only).
		 * Used to show the student their position on the scoring curve chart.
		 */
		taxonomyMatchCount?: number;
	};
}

/** Passed into suggestion generation so cards align with scoring signals. */
export interface AtsScoringContext {
	jdProvided: boolean;
	requiredJdKeywords: string[];
	categories: ScoringResult["categories"];
}

export interface JDAnalysis {
	hardSkills: string[];
	softSkills: string[];
	tools: string[];
	certifications: string[];
	/**
	 * Development methodologies, processes, and architectural patterns explicitly or implicitly required.
	 * e.g. Agile, Scrum, TDD, REST, GraphQL, microservices, CI/CD, DevOps, code review, pair programming.
	 */
	methodologies: string[];
	jobTitle: string;
	experienceLevel: string;
	requiredYears?: number;
	educationRequirements: string[];
}

export const SCORING_LLM_CONFIG = {
	model: "gpt-4o-mini",
	temperature: 0,
	seed: 42,
} as const;

/** Extract visible text from HTML content */
export function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** Extract bullet points from HTML description */
export function extractBullets(html: string): string[] {
	const liMatches = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
	if (liMatches) {
		return liMatches.map((li) => stripHtml(li)).filter((text) => text.length > 0);
	}
	// Fallback: split on line breaks or treat as single bullet
	const text = stripHtml(html);
	if (!text) return [];
	return text
		.split(/\n|<br\s*\/?>/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Get all visible experience/project/volunteer bullets from resume */
export function getAllBullets(
	data: ResumeData,
): { text: string; sectionKey: string; itemIndex: number; path: string }[] {
	const bullets: { text: string; sectionKey: string; itemIndex: number; path: string }[] = [];

	const sectionsWithBullets = ["experience", "projects", "volunteer"] as const;

	for (const key of sectionsWithBullets) {
		const section = data.sections[key];
		if (section.hidden) continue;

		section.items.forEach((item, idx) => {
			if (item.hidden) return;
			const desc = "description" in item ? (item as { description: string }).description : "";
			const itemBullets = extractBullets(desc);
			for (const bulletText of itemBullets) {
				bullets.push({
					text: bulletText,
					sectionKey: key,
					itemIndex: idx,
					path: `/sections/${key}/items/${idx}/description`,
				});
			}
		});
	}

	return bullets;
}

/** Get all skills mentioned in the resume (from skills section + bullet text) */
export function getResumeSkills(data: ResumeData): string[] {
	const skills: string[] = [];

	if (!data.sections.skills.hidden) {
		for (const item of data.sections.skills.items) {
			if (item.hidden) continue;
			if (item.name) skills.push(item.name);
			if (item.keywords) skills.push(...item.keywords);
		}
	}

	return skills;
}

/** Estimate page count based on content volume */
export function estimatePageCount(data: ResumeData): number {
	// Count total words across all visible resume content
	let text = "";
	text += stripHtml(data.summary.content) + " ";
	text += data.basics.name + " " + data.basics.headline + " ";

	const sectionKeys = Object.keys(data.sections) as (keyof typeof data.sections)[];
	for (const key of sectionKeys) {
		const section = data.sections[key];
		if (section.hidden) continue;
		for (const item of section.items) {
			if (item.hidden) continue;
			for (const [, val] of Object.entries(item)) {
				if (typeof val === "string") text += stripHtml(val) + " ";
				if (Array.isArray(val)) text += val.filter((v) => typeof v === "string").join(" ") + " ";
			}
		}
	}

	const wordCount = text.split(/\s+/).filter(Boolean).length;
	// ~675 words fits on 1 page — aligns with RECOMMENDED_WORD_RANGE.max
	return Math.max(1, Math.ceil(wordCount / 675));
}

/**
 * JD mode weights (must sum to 100).
 * When a job description is provided, relevance signals (KW, Tailoring) get more weight
 * and hygiene checks (Formatting, Brevity) become less important.
 */
const JD_MODE_WEIGHTS = {
	keywordMatch: 28, // +3 (vs 25) — most important signal for JD matching
	tailoring: 22, // +12 (vs 10) — summary/title/experience fit matters most
	impactMetrics: 20, // unchanged
	structure: 15, // -5 (vs 20) — hygiene but less critical vs relevance
	formatting: 10, // -5 (vs 15) — hygiene
	brevity: 5, // -5 (vs 10) — hygiene
} as const;

/** Rescale a CategoryScore to a new max (proportional, same quality ratio). */
function rescaleCategory(cat: CategoryScore, newMax: number): CategoryScore {
	if (cat.max === 0) return { ...cat, max: newMax };
	return {
		...cat,
		score: Math.round((cat.score / cat.max) * newMax),
		max: newMax,
	};
}

export async function scoreResume(
	resumeData: ResumeData,
	jobDescription?: string,
	includeAiSuggestions = true,
): Promise<ScoringResult> {
	const jdProvided = !!jobDescription && jobDescription.trim().length > 0;

	// Step 1: Extract keywords from JD (if provided)
	let jdAnalysis: JDAnalysis | null = null;
	if (jdProvided) {
		jdAnalysis = await extractKeywords(jobDescription!);
	}

	// Step 2: Split keywords by scoring tier
	// Tier A (hard scored): technical skills + tools — KW-1/KW-2 rules
	const requiredKeywords = jdAnalysis ? [...jdAnalysis.hardSkills, ...jdAnalysis.tools] : [];
	// Tier B (soft scored): soft skills + methodologies + certifications — KW-3 rule
	const softKeywords = jdAnalysis
		? [...jdAnalysis.softSkills, ...jdAnalysis.methodologies, ...jdAnalysis.certifications]
		: [];
	const allJdKeywords = [...requiredKeywords, ...softKeywords];

	// Step 3: Global Content Gate
	const { countResumeWords } = await import("./rules/brevity");
	const wordCount = countResumeWords(resumeData);
	const bullets = getAllBullets(resumeData);

	if (wordCount < 30) {
		const thinCategories: ScoringResult["categories"] = {
			keywordMatch: {
				score: 0,
				max: 25,
				details: [
					{
						ruleId: "KW-0",
						ruleName: "Insufficient Content",
						score: 0,
						maxScore: 25,
						details: "Resume is too short to provide a keyword analysis.",
					},
				],
			},
			impactMetrics: {
				score: 0,
				max: 20,
				details: [
					{
						ruleId: "IM-0",
						ruleName: "Insufficient Content",
						score: 0,
						maxScore: 20,
						details: "Add experience bullets to evaluate impact.",
					},
				],
			},
			structure: {
				score: 0,
				max: 20,
				details: [
					{
						ruleId: "SC-0",
						ruleName: "Insufficient Content",
						score: 0,
						maxScore: 20,
						details: "Complete your basic profile and sections.",
					},
				],
			},
			formatting: {
				score: 0,
				max: 15,
				details: [
					{
						ruleId: "FM-0",
						ruleName: "Insufficient Content",
						score: 0,
						maxScore: 15,
						details: "Formatting cannot be evaluated on an empty resume.",
					},
				],
			},
			brevity: {
				score: 0,
				max: 10,
				details: [
					{
						ruleId: "BR-0",
						ruleName: "Insufficient Content",
						score: 0,
						maxScore: 10,
						details: "Resume is too short.",
					},
				],
			},
			tailoring: {
				score: 0,
				max: 10,
				details: [
					{
						ruleId: jdProvided ? "TR-0" : "CQ-0",
						ruleName: "Insufficient Content",
						score: 0,
						maxScore: 10,
						details: jdProvided ? "Add headline and summary to check tailoring." : "Add content to evaluate quality.",
					},
				],
			},
		};
		const thinGen = includeAiSuggestions
			? await generateSuggestions(resumeData, jdAnalysis, [], [], {
					jdProvided,
					requiredJdKeywords: requiredKeywords,
					categories: thinCategories,
				})
			: { suggestions: [] as Suggestion[], aiRewriteUnavailable: false };

		return {
			overall: 0,
			categories: thinCategories,
			suggestions: thinGen.suggestions,
			metadata: {
				jdProvided,
				keywordsExtracted: allJdKeywords,
				keywordsMatched: [],
				keywordsMissing: allJdKeywords,
				totalBullets: bullets.length,
				estimatedPages: estimatePageCount(resumeData),
				aiRewriteUnavailable: thinGen.aiRewriteUnavailable,
				taxonomyMatchCount: jdProvided ? undefined : 0,
			},
		};
	}

	let [keywordMatch, impactMetrics, structure, formatting, brevity, sixthCategory] = await Promise.all([
		scoreKeywordMatch(resumeData, requiredKeywords, softKeywords),
		scoreImpactMetrics(resumeData),
		scoreStructure(resumeData),
		scoreFormatting(resumeData),
		scoreBrevity(resumeData),
		// Always compute a 6th category worth 10 pts — keeps the total always out of 100
		jdProvided ? scoreTailoring(resumeData, jdAnalysis!) : scoreContentQuality(resumeData),
	]);

	// Step 4: In JD mode, rebalance category weights so relevance signals dominate
	// (Tailoring +12, KW +3; Structure/Formatting/Brevity reduced as hygiene checks)
	if (jdProvided) {
		keywordMatch = rescaleCategory(keywordMatch, JD_MODE_WEIGHTS.keywordMatch);
		sixthCategory = rescaleCategory(sixthCategory, JD_MODE_WEIGHTS.tailoring);
		// impactMetrics stays at 20
		structure = rescaleCategory(structure, JD_MODE_WEIGHTS.structure);
		formatting = rescaleCategory(formatting, JD_MODE_WEIGHTS.formatting);
		brevity = rescaleCategory(brevity, JD_MODE_WEIGHTS.brevity);
	}

	// Step 5: Calculate overall score — always out of 100
	const rawScore =
		keywordMatch.score + impactMetrics.score + structure.score + formatting.score + brevity.score + sixthCategory.score;

	const overall = Math.round(Math.min(100, Math.max(0, rawScore)));

	// Step 6: Gather matched/missing keywords using the same matcher as the scoring rules
	const { keywordFoundInResumeText } = await import("./rules/keyword-match");
	const keywordsMatched = allJdKeywords.filter((kw) => keywordFoundInResumeText(kw, resumeData));
	const keywordsMissing = allJdKeywords.filter((kw) => !keywordFoundInResumeText(kw, resumeData));

	// Split missing keywords into required (hard scored) vs soft/nice-to-have
	const requiredSet = new Set(requiredKeywords.map((k) => k.toLowerCase()));
	const missingRequired = keywordsMissing.filter((kw) => requiredSet.has(kw.toLowerCase()));
	const missingNiceToHave = keywordsMissing.filter((kw) => !requiredSet.has(kw.toLowerCase()));

	// Step 7: Generate suggestions
	const categoriesResult: ScoringResult["categories"] = {
		keywordMatch,
		impactMetrics,
		structure,
		formatting,
		brevity,
		tailoring: sixthCategory,
	};

	const genResult = includeAiSuggestions
		? await generateSuggestions(resumeData, jdAnalysis, missingRequired, missingNiceToHave, {
				jdProvided,
				requiredJdKeywords: requiredKeywords,
				categories: categoriesResult,
			})
		: { suggestions: [] as Suggestion[], aiRewriteUnavailable: false };

	return {
		overall,
		categories: categoriesResult,
		suggestions: genResult.suggestions,
		metadata: {
			jdProvided,
			keywordsExtracted: allJdKeywords,
			keywordsMatched,
			keywordsMissing,
			totalBullets: bullets.length,
			estimatedPages: estimatePageCount(resumeData),
			aiRewriteUnavailable: genResult.aiRewriteUnavailable,
			taxonomyMatchCount: jdProvided ? undefined : getIndustryTaxonomyMatchCount(resumeData),
		},
	};
}
