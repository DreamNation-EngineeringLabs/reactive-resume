import type { ResumeData } from "@/schema/resume/data";
import { extractKeywords } from "./keyword-extractor";
import { scoreBrevity } from "./rules/brevity";
import { scoreFormatting } from "./rules/formatting";
import { scoreImpactMetrics } from "./rules/impact-metrics";
import { scoreKeywordMatch } from "./rules/keyword-match";
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

export interface Suggestion {
	id: string;
	ruleId: string;
	category: string;
	severity: "critical" | "warning" | "info";
	title: string;
	description: string;
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
	};
}

export interface JDAnalysis {
	hardSkills: string[];
	softSkills: string[];
	tools: string[];
	certifications: string[];
	jobTitle: string;
	experienceLevel: string;
	requiredYears?: number;
	educationRequirements: string[];
}

export const SCORING_LLM_CONFIG = {
	model: "gpt-4o",
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

	// Step 2: Split keywords into required (scored) and nice-to-have (not scored)
	const requiredKeywords = jdAnalysis ? [...jdAnalysis.hardSkills, ...jdAnalysis.tools] : [];
	const niceToHaveKeywords = jdAnalysis ? [...jdAnalysis.softSkills, ...jdAnalysis.certifications] : [];
	const allJdKeywords = [...requiredKeywords, ...niceToHaveKeywords];

	const [keywordMatch, impactMetrics, structure, formatting, brevity, tailoring] = await Promise.all([
		scoreKeywordMatch(resumeData, requiredKeywords),
		scoreImpactMetrics(resumeData),
		scoreStructure(resumeData),
		scoreFormatting(resumeData),
		scoreBrevity(resumeData),
		jdProvided ? scoreTailoring(resumeData, jdAnalysis!) : Promise.resolve(null),
	]);

	// Step 3: Calculate overall score
	const maxPossible = jdProvided ? 100 : 90;
	const rawScore =
		keywordMatch.score +
		impactMetrics.score +
		structure.score +
		formatting.score +
		brevity.score +
		(tailoring?.score ?? 0);

	const overall = Math.round(Math.min(100, Math.max(0, (rawScore / maxPossible) * 100)));

	// Step 4: Gather matched/missing keywords
	const resumeSkills = getResumeSkills(resumeData);
	const bullets = getAllBullets(resumeData);
	const allResumeText = [
		...resumeSkills,
		...bullets.map((b) => b.text),
		stripHtml(resumeData.summary.content),
		resumeData.basics.headline,
	]
		.join(" ")
		.toLowerCase();

	const keywordsMatched = allJdKeywords.filter((kw) => allResumeText.includes(kw.toLowerCase()));
	const keywordsMissing = allJdKeywords.filter((kw) => !allResumeText.includes(kw.toLowerCase()));

	// Split missing keywords into required vs nice-to-have
	const requiredSet = new Set(requiredKeywords.map((k) => k.toLowerCase()));
	const missingRequired = keywordsMissing.filter((kw) => requiredSet.has(kw.toLowerCase()));
	const missingNiceToHave = keywordsMissing.filter((kw) => !requiredSet.has(kw.toLowerCase()));

	// Step 5: Generate suggestions
	const suggestions = includeAiSuggestions
		? await generateSuggestions(resumeData, jdAnalysis, missingRequired, missingNiceToHave)
		: [];

	return {
		overall,
		categories: {
			keywordMatch,
			impactMetrics,
			structure,
			formatting,
			brevity,
			tailoring,
		},
		suggestions,
		metadata: {
			jdProvided,
			keywordsExtracted: allJdKeywords,
			keywordsMatched,
			keywordsMissing,
			totalBullets: bullets.length,
			estimatedPages: estimatePageCount(resumeData),
		},
	};
}
