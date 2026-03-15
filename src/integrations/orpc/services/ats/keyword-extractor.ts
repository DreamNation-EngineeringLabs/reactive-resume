import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import z from "zod";
import skillsTaxonomy from "@/data/skills-taxonomy.json";
import { env } from "@/utils/env";
import { type JDAnalysis, SCORING_LLM_CONFIG } from "./index";

const jdAnalysisSchema = z.object({
	hardSkills: z.array(z.string()),
	softSkills: z.array(z.string()),
	tools: z.array(z.string()),
	certifications: z.array(z.string()),
	jobTitle: z.string(),
	experienceLevel: z.string(),
	requiredYears: z.number().optional(),
	educationRequirements: z.array(z.string()),
});

function getATSModel() {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
	return createOpenAI({ apiKey, baseURL: env.OPENAI_BASE_URL }).languageModel(SCORING_LLM_CONFIG.model);
}

/** Fallback: extract keywords using the static taxonomy */
function extractFromTaxonomy(text: string): string[] {
	const found: string[] = [];
	const lowerText = text.toLowerCase();

	for (const category of Object.values(skillsTaxonomy.categories)) {
		for (const [skill, aliases] of Object.entries(category)) {
			const allForms = [skill, ...aliases].map((s) => s.toLowerCase());
			if (allForms.some((form) => lowerText.includes(form))) {
				found.push(skill);
			}
		}
	}

	return [...new Set(found)];
}

export async function extractKeywords(jobDescription: string): Promise<JDAnalysis> {
	try {
		const model = getATSModel();

		const result = await generateText({
			model,
			temperature: SCORING_LLM_CONFIG.temperature,
			seed: SCORING_LLM_CONFIG.seed,
			output: Output.object({ schema: jdAnalysisSchema }),
			messages: [
				{
					role: "system",
					content: `You are an expert ATS keyword extractor. Given a job description, extract all relevant keywords categorized by type. Be thorough — extract every skill, tool, technology, certification, and soft skill mentioned or implied. Normalize skill names to their canonical form (e.g., "JS" → "JavaScript", "K8s" → "Kubernetes").`,
				},
				{
					role: "user",
					content: jobDescription,
				},
			],
		});

		const analysis = result.output;

		// Supplement with taxonomy-based extraction for completeness
		const taxonomyKeywords = extractFromTaxonomy(jobDescription);
		const existingKeywords = new Set(
			[...analysis.hardSkills, ...analysis.tools, ...analysis.certifications].map((k) => k.toLowerCase()),
		);

		for (const kw of taxonomyKeywords) {
			if (!existingKeywords.has(kw.toLowerCase())) {
				analysis.hardSkills.push(kw);
			}
		}

		return analysis;
	} catch {
		// Fallback: taxonomy-only extraction
		const taxonomyKeywords = extractFromTaxonomy(jobDescription);
		return {
			hardSkills: taxonomyKeywords,
			softSkills: [],
			tools: [],
			certifications: [],
			jobTitle: "",
			experienceLevel: "mid",
			educationRequirements: [],
		};
	}
}
