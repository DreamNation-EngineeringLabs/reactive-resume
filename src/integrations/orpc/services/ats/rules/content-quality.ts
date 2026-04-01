import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import z from "zod";
import type { ResumeData } from "@/schema/resume/data";
import { env } from "@/utils/env";
import type { CategoryScore, RuleResult } from "../index";
import { SCORING_LLM_CONFIG, getAllBullets, getResumeSkills, stripHtml } from "../index";

const MAX_SCORE = 10;

const contentQualitySchema = z.object({
	bulletSpecificity: z.number().min(0).max(4),
	summaryQuality: z.number().min(0).max(2),
	projectDepth: z.number().min(0).max(2),
	careerNarrative: z.number().min(0).max(2),
	bulletFeedback: z.string(),
	summaryFeedback: z.string(),
	projectFeedback: z.string(),
	narrativeFeedback: z.string(),
});

/**
 * Heuristic fallback for content quality scoring (no LLM available).
 * Intentionally strict — rewards only genuinely specific, substantive content.
 */
function heuristicContentQuality(data: ResumeData): z.infer<typeof contentQualitySchema> {
	const bullets = getAllBullets(data);
	const summary = stripHtml(data.summary.content).trim();
	const skills = getResumeSkills(data);

	// CQ-1: Bullet specificity — check for metrics, tech names, specific outcomes
	const technicalTermRegex =
		/\b(react|vue|angular|node|python|java|typescript|javascript|aws|docker|kubernetes|sql|api|rest|graphql|machine learning|deep learning|tensorflow|pytorch|spring|django|flask|express|mongodb|postgresql|redis|git|ci\/cd|agile|scrum)\b/i;
	const metricRegex = /\d+[%x]|\$[\d,.]+[KMB]?|\d+\s*(users|customers|ms|seconds|hours|requests|endpoints|records|transactions)/i;
	const vagueRegex = /^(developed|maintained|worked on|helped|assisted|was responsible|involved in|participated)(\s+a)?\s+(simple|basic|sample|website|app|application|project)\b/i;

	let specificBullets = 0;
	let vagueBullets = 0;
	for (const b of bullets) {
		const hasMetric = metricRegex.test(b.text);
		const hasTech = technicalTermRegex.test(b.text);
		const isVague = vagueRegex.test(b.text) || b.text.split(/\s+/).length < 7;
		if (isVague) vagueBullets++;
		else if (hasMetric || hasTech) specificBullets++;
	}

	const bulletCount = bullets.length;
	let bulletScore = 0;
	if (bulletCount === 0) {
		bulletScore = 0;
	} else if (bulletCount < 4) {
		bulletScore = 0;
	} else {
		const specificRatio = specificBullets / bulletCount;
		const vagueRatio = vagueBullets / bulletCount;
		bulletScore = Math.round(Math.max(0, (specificRatio - vagueRatio * 0.5) * 4));
	}

	// CQ-2: Summary quality — boilerplate detection
	const boilerplatePhrases = [
		"results-driven",
		"dynamic professional",
		"passionate about",
		"strong communication skills",
		"team player",
		"hardworking",
		"detail-oriented",
		"self-motivated",
		"fast learner",
		"quick learner",
		"seeking impactful opportunities",
		"adept at collaborating",
		"strong commitment to quality",
	];
	const summaryLower = summary.toLowerCase();
	const boilerplateCount = boilerplatePhrases.filter((p) => summaryLower.includes(p)).length;
	const summaryWords = summary.split(/\s+/).filter(Boolean).length;
	const summaryHasTech = technicalTermRegex.test(summary);
	const summaryHasMetric = metricRegex.test(summary);

	let summaryScore = 0;
	if (!summary) {
		summaryScore = 0;
	} else if (summaryWords < 20) {
		summaryScore = 0;
	} else if (boilerplateCount >= 3 && !summaryHasTech && !summaryHasMetric) {
		summaryScore = 0; // pure boilerplate
	} else if (boilerplateCount >= 2 || (!summaryHasTech && !summaryHasMetric)) {
		summaryScore = 1;
	} else {
		summaryScore = 2;
	}

	// CQ-3: Project depth
	const projects = data.sections.projects?.items.filter((i) => !i.hidden) ?? [];
	let projectScore = 0;
	for (const project of projects.slice(0, 3)) {
		const desc = stripHtml("description" in project ? (project as { description: string }).description : "").trim();
		const words = desc.split(/\s+/).filter(Boolean).length;
		const hasTech = technicalTermRegex.test(desc);
		if (words >= 20 && hasTech) projectScore += 1;
		else if (words >= 10) projectScore += 0.5;
		// "a simple project" or similar → 0
	}
	projectScore = Math.min(2, Math.round(projectScore));

	// CQ-4: Career narrative coherence
	const hasSkills = skills.length >= 3;
	const hasExperience = !data.sections.experience.hidden && data.sections.experience.items.filter((i) => !i.hidden).length > 0;
	const hasEducationDegree = data.sections.education.items.filter((i) => !i.hidden).some((i) => {
		const deg = String((i as { degree?: string }).degree ?? "").trim();
		const area = String((i as { area?: string }).area ?? "").trim();
		return deg.length > 0 || area.length > 0;
	});
	const narrativeScore = (hasSkills ? 1 : 0) + (hasExperience && hasEducationDegree ? 1 : 0);

	return {
		bulletSpecificity: bulletScore,
		summaryQuality: summaryScore,
		projectDepth: projectScore,
		careerNarrative: narrativeScore,
		bulletFeedback:
			bulletCount < 4
				? `Only ${bulletCount} bullet(s) found. Add at least 6 specific bullets per experience/project.`
				: vagueBullets > 0
					? `${vagueBullets}/${bulletCount} bullets are vague or too short. Name the technologies, scale, and outcomes explicitly.`
					: specificBullets < bulletCount / 2
						? "Most bullets lack specific technologies or measurable outcomes."
						: "Bullets have reasonable specificity.",
		summaryFeedback:
			!summary
				? "No summary found."
				: boilerplateCount >= 3
					? `Summary uses ${boilerplateCount} boilerplate phrase(s). Replace with specific achievements, technologies, and goals.`
					: "Summary is acceptable.",
		projectFeedback:
			projects.length === 0
				? "No projects found."
				: projectScore === 0
					? 'Project descriptions are too vague or empty (e.g. "a simple project"). Add: what the project does, the tech stack, your specific role, and outcomes.'
					: projectScore === 1
						? "Some projects need more depth — include the tech stack and specific outcomes."
						: "Projects have good depth.",
		narrativeFeedback:
			narrativeScore === 0
				? "Resume lacks a coherent narrative — add skills section and complete education details."
				: narrativeScore === 1
					? "Career story is incomplete — ensure skills, education, and experience all align."
					: "Career narrative is coherent.",
	};
}

/**
 * LLM-powered content quality scoring. Used when no job description is provided.
 * Evaluates the inherent quality of the resume content regardless of target role.
 */
export async function scoreContentQuality(data: ResumeData): Promise<CategoryScore> {
	const details: RuleResult[] = [];

	const bullets = getAllBullets(data);
	const summary = stripHtml(data.summary.content).trim();
	const skills = getResumeSkills(data);

	const projectDescriptions = (data.sections.projects?.items ?? [])
		.filter((i) => !i.hidden)
		.map((i) => {
			const name = String((i as { name?: string }).name ?? "");
			const desc = stripHtml("description" in i ? (i as { description: string }).description : "").trim();
			return `${name}: ${desc || "(no description)"}`;
		})
		.join("\n");

	let scoring: z.infer<typeof contentQualitySchema>;

	try {
		const apiKey = env.OPENAI_API_KEY;
		if (!apiKey) throw new Error("No API key");

		const model = createOpenAI({ apiKey, baseURL: env.OPENAI_BASE_URL }).languageModel(SCORING_LLM_CONFIG.model);

		const bulletSample = bullets
			.slice(0, 10)
			.map((b, i) => `${i + 1}. ${b.text}`)
			.join("\n");

		const result = await generateText({
			model,
			temperature: 0,
			seed: 42,
			output: Output.object({ schema: contentQualitySchema }),
			messages: [
				{
					role: "system",
					content: `You are a strict, professional resume coach evaluating a student's resume quality.
Your job is to score the CONTENT QUALITY — not the format, but the actual substance.
Be STRICT. Generic boilerplate summaries, vague bullets ("developed a website", "a simple project"),
and placeholder content should score 0. Only reward specific, verifiable, technical, quantified content.
A recent graduate with 1 vague bullet and a boilerplate summary should score 1-3/10 total.`,
				},
				{
					role: "user",
					content: `Score this resume's content quality strictly.

SUMMARY:
${summary || "(no summary)"}

EXPERIENCE/PROJECT BULLETS (up to 10):
${bulletSample || "(none)"}

PROJECTS:
${projectDescriptions || "(none)"}

SKILLS: ${skills.join(", ") || "(none)"}

Rate each dimension:
- bulletSpecificity (0-4): Are bullets specific? Do they name technologies, scale, outcomes? 0=vague/absent, 1=some specifics, 2=moderate, 3=good, 4=excellent with metrics
- summaryQuality (0-2): Is the summary specific and tailored? 0=boilerplate/empty, 1=partially specific, 2=strong and specific
- projectDepth (0-2): Do projects describe what was built, tech used, and impact? 0=placeholder/empty, 1=partial, 2=complete
- careerNarrative (0-2): Does the resume tell a coherent career story with consistent depth? 0=incoherent/thin, 1=partial, 2=strong

Also provide 1-sentence feedback for each dimension explaining the specific issue.`,
				},
			],
		});

		scoring = result.output;
	} catch {
		scoring = heuristicContentQuality(data);
	}

	const totalScore = Math.min(
		MAX_SCORE,
		scoring.bulletSpecificity + scoring.summaryQuality + scoring.projectDepth + scoring.careerNarrative,
	);

	details.push({
		ruleId: "CQ-1",
		ruleName: "Bullet specificity & impact",
		score: scoring.bulletSpecificity,
		maxScore: 4,
		details: scoring.bulletFeedback,
	});

	details.push({
		ruleId: "CQ-2",
		ruleName: "Summary quality",
		score: scoring.summaryQuality,
		maxScore: 2,
		details: scoring.summaryFeedback,
	});

	details.push({
		ruleId: "CQ-3",
		ruleName: "Project depth",
		score: scoring.projectDepth,
		maxScore: 2,
		details: scoring.projectFeedback,
	});

	details.push({
		ruleId: "CQ-4",
		ruleName: "Career narrative",
		score: scoring.careerNarrative,
		maxScore: 2,
		details: scoring.narrativeFeedback,
	});

	return { score: totalScore, max: MAX_SCORE, details };
}
