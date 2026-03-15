import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import z from "zod";
import type { ResumeData } from "@/schema/resume/data";
import { env } from "@/utils/env";
import type { CategoryScore, JDAnalysis, RuleResult } from "../index";
import { SCORING_LLM_CONFIG, stripHtml } from "../index";

const MAX_SCORE = 10;

const tailoringResultSchema = z.object({
	titleMatch: z.number().min(0).max(3),
	summaryRelevance: z.number().min(0).max(3),
	experienceRelevance: z.number().min(0).max(2),
	educationMatch: z.number().min(0).max(2),
	suggestedHeadline: z.string().optional(),
	suggestedSummary: z.string().optional(),
});

export async function scoreTailoring(data: ResumeData, jdAnalysis: JDAnalysis): Promise<CategoryScore> {
	const details: RuleResult[] = [];

	try {
		const apiKey = env.OPENAI_API_KEY;
		if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

		const model = createOpenAI({ apiKey, baseURL: env.OPENAI_BASE_URL }).languageModel(SCORING_LLM_CONFIG.model);

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
			ruleId: "TR-1",
			ruleName: "Title alignment",
			score: scoring.titleMatch,
			maxScore: 3,
			details: `Headline "${headline}" vs JD title "${jdAnalysis.jobTitle}" — match: ${scoring.titleMatch}/3.`,
		});
		details.push({
			ruleId: "TR-2",
			ruleName: "Summary relevance",
			score: scoring.summaryRelevance,
			maxScore: 3,
			details: `Summary relevance to target role: ${scoring.summaryRelevance}/3.`,
		});
		details.push({
			ruleId: "TR-3",
			ruleName: "Experience relevance",
			score: scoring.experienceRelevance,
			maxScore: 2,
			details: `Recent position relevance: ${scoring.experienceRelevance}/2.`,
		});
		details.push({
			ruleId: "TR-4",
			ruleName: "Education match",
			score: scoring.educationMatch,
			maxScore: 2,
			details: `Education match: ${scoring.educationMatch}/2.`,
		});

		const totalScore = Math.min(
			MAX_SCORE,
			scoring.titleMatch + scoring.summaryRelevance + scoring.experienceRelevance + scoring.educationMatch,
		);

		return { score: totalScore, max: MAX_SCORE, details };
	} catch {
		// Fallback: heuristic scoring based on content analysis
		const headline = data.basics.headline.toLowerCase();
		const jobTitle = jdAnalysis.jobTitle.toLowerCase();
		const jdKeyTerms = [...jdAnalysis.hardSkills, ...jdAnalysis.tools].map((s) => s.toLowerCase());

		// TR-1: title match
		const titleMatch = headline.includes(jobTitle)
			? 3
			: jobTitle.split(" ").some((w) => w.length > 3 && headline.includes(w))
				? 1
				: 0;

		details.push({
			ruleId: "TR-1",
			ruleName: "Title alignment",
			score: titleMatch,
			maxScore: 3,
			details:
				titleMatch === 3
					? `Headline matches JD title "${jdAnalysis.jobTitle}".`
					: `Headline "${data.basics.headline}" doesn't match JD title "${jdAnalysis.jobTitle}".`,
		});

		// TR-2: summary relevance — check actual summary content
		const summaryText = stripHtml(data.summary.content).toLowerCase();
		const summaryMentionsRole =
			summaryText.includes(jobTitle) ||
			jobTitle
				.split(" ")
				.filter((w) => w.length > 3)
				.every((w) => summaryText.includes(w));
		const summarySkillMatches = jdKeyTerms.filter((t) => summaryText.includes(t));
		const summaryScore = !summaryText.trim()
			? 0
			: summaryMentionsRole && summarySkillMatches.length >= 2
				? 3
				: summaryMentionsRole || summarySkillMatches.length >= 1
					? 2
					: 1;
		const missingSummarySkills = jdKeyTerms.filter((t) => !summaryText.includes(t)).slice(0, 4);

		details.push({
			ruleId: "TR-2",
			ruleName: "Summary relevance",
			score: summaryScore,
			maxScore: 3,
			details: !summaryText.trim()
				? "Summary is empty — add a summary mentioning the target role and key JD skills."
				: summaryScore === 3
					? "Summary mentions the target role and key skills."
					: `Summary ${!summaryMentionsRole ? `doesn't mention "${jdAnalysis.jobTitle}"` : "mentions the role"} and matches ${summarySkillMatches.length}/${jdKeyTerms.length} JD skills.${missingSummarySkills.length > 0 ? ` Add: ${missingSummarySkills.join(", ")}.` : ""}`,
		});

		// TR-3: experience relevance — check bullet content
		const expBullets = data.sections.experience.items
			.filter((item) => !item.hidden)
			.slice(0, 3)
			.flatMap((item) => stripHtml(item.description).toLowerCase().split(/\s+/));
		const expText = expBullets.join(" ");
		const expSkillMatches = jdKeyTerms.filter((t) => expText.includes(t));
		const expScore = expSkillMatches.length >= 3 ? 2 : expSkillMatches.length >= 1 ? 1 : 0;
		const missingExpSkills = jdKeyTerms.filter((t) => !expText.includes(t)).slice(0, 4);

		details.push({
			ruleId: "TR-3",
			ruleName: "Experience relevance",
			score: expScore,
			maxScore: 2,
			details:
				expScore === 2
					? "Experience bullets mention key JD skills."
					: `Experience mentions ${expSkillMatches.length}/${jdKeyTerms.length} JD skills.${missingExpSkills.length > 0 ? ` Missing: ${missingExpSkills.join(", ")}.` : ""}`,
		});

		// TR-4: education match
		const eduText = data.sections.education.items
			.filter((item) => !item.hidden)
			.map((item) => `${item.degree} ${item.area} ${item.school}`.toLowerCase())
			.join(" ");
		const eduReqs = jdAnalysis.educationRequirements.map((r) => r.toLowerCase());
		const eduMatched = eduReqs.filter((req) => eduText.includes(req));
		const eduScore = eduReqs.length === 0 ? 2 : eduMatched.length >= eduReqs.length ? 2 : eduMatched.length > 0 ? 1 : 0;
		const missingEdu = jdAnalysis.educationRequirements.filter((r) => !eduText.includes(r.toLowerCase()));

		details.push({
			ruleId: "TR-4",
			ruleName: "Education match",
			score: eduScore,
			maxScore: 2,
			details:
				eduReqs.length === 0
					? "No specific education requirements in JD."
					: eduScore === 2
						? "Education matches JD requirements."
						: `Education matches ${eduMatched.length}/${eduReqs.length} JD requirements.${missingEdu.length > 0 ? ` Missing: ${missingEdu.join(", ")}.` : ""}`,
		});

		const totalScore = Math.min(MAX_SCORE, titleMatch + summaryScore + expScore + eduScore);
		return { score: totalScore, max: MAX_SCORE, details };
	}
}
