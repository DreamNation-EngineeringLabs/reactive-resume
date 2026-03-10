import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import z from "zod";
import type { ResumeData } from "@/schema/resume/data";
import type { CategoryScore, RuleResult, JDAnalysis } from "../index";
import { stripHtml, SCORING_LLM_CONFIG } from "../index";
import { env } from "@/utils/env";

const MAX_SCORE = 10;

const tailoringResultSchema = z.object({
	titleMatch: z.number().min(0).max(3),
	summaryRelevance: z.number().min(0).max(3),
	experienceRelevance: z.number().min(0).max(2),
	educationMatch: z.number().min(0).max(2),
	suggestedHeadline: z.string().optional(),
	suggestedSummary: z.string().optional(),
});

export async function scoreTailoring(
	data: ResumeData,
	jdAnalysis: JDAnalysis,
): Promise<CategoryScore> {
	const details: RuleResult[] = [];

	try {
		const apiKey = env.OPENAI_API_KEY;
		if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

		const model = createOpenAI({ apiKey, baseURL: env.OPENAI_BASE_URL })
			.languageModel(SCORING_LLM_CONFIG.model);

		const headline = data.basics.headline;
		const summary = stripHtml(data.summary.content);
		const recentPositions = data.sections.experience.items
			.filter((item) => !item.hidden)
			.slice(0, 3)
			.map((item) => `${item.position} at ${item.company}`)
			.join("; ");

		const result = await generateText({
			model,
			temperature: SCORING_LLM_CONFIG.temperature,
			seed: SCORING_LLM_CONFIG.seed,
			output: Output.object({ schema: tailoringResultSchema }),
			messages: [
				{
					role: "system",
					content: `You are an ATS scoring engine. Score how well a resume is tailored to a specific job. Rate each dimension on the given scale. Be strict but fair.`,
				},
				{
					role: "user",
					content: `Job Title: ${jdAnalysis.jobTitle}
Experience Level: ${jdAnalysis.experienceLevel}
Required Years: ${jdAnalysis.requiredYears ?? "not specified"}
Education Requirements: ${jdAnalysis.educationRequirements.join(", ") || "none specified"}

Resume Headline: ${headline}
Resume Summary: ${summary}
Recent Positions: ${recentPositions}

Score:
- titleMatch (0-3): How well does the resume headline/recent titles match the JD title? 0=unrelated, 3=exact match
- summaryRelevance (0-3): Does the summary/objective mention the target role and key requirements? 0=generic, 3=perfectly tailored
- experienceRelevance (0-2): Are recent positions relevant to the target role? 0=unrelated, 2=highly relevant
- educationMatch (0-2): Does education meet JD requirements? 0=doesn't meet, 2=exceeds requirements`,
				},
			],
		});

		const scoring = result.output;

		details.push({
			ruleId: "TR-1", ruleName: "Title alignment",
			score: scoring.titleMatch, maxScore: 3,
			details: `Headline "${headline}" vs JD title "${jdAnalysis.jobTitle}" — match: ${scoring.titleMatch}/3.`,
		});
		details.push({
			ruleId: "TR-2", ruleName: "Summary relevance",
			score: scoring.summaryRelevance, maxScore: 3,
			details: `Summary relevance to target role: ${scoring.summaryRelevance}/3.`,
		});
		details.push({
			ruleId: "TR-3", ruleName: "Experience relevance",
			score: scoring.experienceRelevance, maxScore: 2,
			details: `Recent position relevance: ${scoring.experienceRelevance}/2.`,
		});
		details.push({
			ruleId: "TR-4", ruleName: "Education match",
			score: scoring.educationMatch, maxScore: 2,
			details: `Education match: ${scoring.educationMatch}/2.`,
		});

		const totalScore = Math.min(MAX_SCORE,
			scoring.titleMatch + scoring.summaryRelevance + scoring.experienceRelevance + scoring.educationMatch,
		);

		return { score: totalScore, max: MAX_SCORE, details };
	} catch {
		// Fallback: basic heuristic scoring
		const headline = data.basics.headline.toLowerCase();
		const jobTitle = jdAnalysis.jobTitle.toLowerCase();

		const titleMatch = headline.includes(jobTitle) ? 3 :
			jobTitle.split(" ").some((w) => headline.includes(w)) ? 1 : 0;

		details.push({
			ruleId: "TR-1", ruleName: "Title alignment",
			score: titleMatch, maxScore: 3,
			details: `Headline vs JD title (heuristic): ${titleMatch}/3.`,
		});
		details.push({ ruleId: "TR-2", ruleName: "Summary relevance", score: 1, maxScore: 3, details: "Heuristic fallback." });
		details.push({ ruleId: "TR-3", ruleName: "Experience relevance", score: 1, maxScore: 2, details: "Heuristic fallback." });
		details.push({ ruleId: "TR-4", ruleName: "Education match", score: 1, maxScore: 2, details: "Heuristic fallback." });

		return { score: Math.min(MAX_SCORE, titleMatch + 3), max: MAX_SCORE, details };
	}
}
