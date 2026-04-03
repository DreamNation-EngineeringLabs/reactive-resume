import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import z from "zod";
import skillsTaxonomy from "@/data/skills-taxonomy.json";
import { env } from "@/utils/env";
import { type JDAnalysis, SCORING_LLM_CONFIG } from "./index";

const jdAnalysisSchema = z.object({
	hardSkills: z
		.array(z.string())
		.describe(
			"Technical skills, programming languages, and frameworks that are EXPLICITLY stated as required or preferred in this job description. Only include what is actually written — do not infer or add skills that are merely implied. Examples: Python, React, SQL, Machine Learning.",
		),
	softSkills: z
		.array(z.string())
		.describe(
			"Interpersonal and behavioral skills that are EXPLICITLY named in this job description (e.g. 'communication skills', 'leadership', 'teamwork'). Do not add soft skills that are not directly stated.",
		),
	tools: z
		.array(z.string())
		.describe(
			"Specific software tools, platforms, cloud services, and DevOps/CI products that are EXPLICITLY named (e.g. Git, Docker, Jira, AWS). Only include what is actually written.",
		),
	certifications: z
		.array(z.string())
		.describe(
			"Professional certifications or credentials that are explicitly required or preferred (e.g. AWS Certified, PMP). Empty array if none mentioned.",
		),
	methodologies: z
		.array(z.string())
		.describe(
			"Development processes, engineering practices, and architectural patterns that are EXPLICITLY named (e.g. Agile, Scrum, TDD, CI/CD, REST, microservices). Do not infer — only include what is actually mentioned in the text.",
		),
	jobTitle: z
		.string()
		.describe(
			"The official job title/role as written in the job description heading or first line. If the JD starts with a role name like 'Graduate Engineer Trainee' or 'Senior Software Engineer', use that exactly. Never use section header names like 'Overview', 'Summary', or 'Requirements'. Never return an empty string.",
		),
	experienceLevel: z
		.string()
		.describe("Seniority level: one of 'entry', 'mid', 'senior', 'lead', 'principal', or 'director'."),
	requiredYears: z
		.number()
		.optional()
		.describe("Minimum years of experience explicitly required, if stated. Omit if not mentioned."),
	educationRequirements: z
		.array(z.string())
		.describe(
			"Degree or education requirements explicitly stated (e.g. 'Bachelor's in Computer Science'). Empty array if none specified.",
		),
});

/**
 * Common methodologies, practices, and architectural patterns to scan for statically.
 * All patterns use strict word boundaries (\b) to avoid false positives.
 */
const STATIC_METHODOLOGIES: [string, RegExp][] = [
	["Agile", /\bagile\b/i],
	["Scrum", /\bscrum\b/i],
	["Kanban", /\bkanban\b/i],
	["Waterfall", /\bwaterfall\b/i],
	["SAFe", /\bscaled agile\b/i],
	["TDD", /\btdd\b|\btest.driven development\b/i],
	["BDD", /\bbdd\b|\bbehavior.driven development\b/i],
	["DDD", /\bddd\b|\bdomain.driven design\b/i],
	["CI/CD", /\bci\/cd\b|\bcontinuous integration\b|\bcontinuous delivery\b|\bcontinuous deployment\b/i],
	["DevOps", /\bdevops\b/i],
	["GitOps", /\bgitops\b/i],
	["Code Review", /\bcode review\b|\bpeer review\b/i],
	["Pair Programming", /\bpair programming\b/i],
	["SOLID", /\bsolid principles\b/i],
	["Design Patterns", /\bdesign patterns\b/i],
	["REST", /\brestful\b|\brest api\b|\brest.based\b/i], // strict — "rest" alone is too common a word
	["GraphQL", /\bgraphql\b/i],
	["gRPC", /\bgrpc\b/i],
	["Microservices", /\bmicroservices?\b/i],
	["Event-Driven", /\bevent.driven\b/i],
	["Serverless", /\bserverless\b/i],
	["Distributed Systems", /\bdistributed systems?\b/i],
	["MVC", /\bmvc\b|\bmodel.view.controller\b/i],
];

/**
 * Words that are common in JD section headers but are NOT job titles.
 * Used to reject regex matches that accidentally capture section headings.
 */
const SECTION_HEADER_RE =
	/^(overview|role overview|responsibilities|requirements|qualifications|about us|about the (company|role)|what you('ll| will) do|what we (offer|look for)|eligibility|benefits|perks|skills|summary|description|introduction|compensation|salary|location|job type|work type|key responsibilities)$/i;

/**
 * Strip noise from an extracted job title:
 * - Parenthetical batch/cohort/year suffixes: "(Batch of 2026)", "(Class of 2025)", "(2026 Cohort)", "(FY25)"
 * - Trailing punctuation and extra whitespace
 *
 * "Graduate Engineer Trainee (Batch of 2026)" → "Graduate Engineer Trainee"
 * "Software Engineer - 2026 Freshers" → "Software Engineer"
 */
function cleanJobTitle(raw: string): string {
	return raw
		// Remove parenthetical batch/cohort/year info
		.replace(/\s*\((?:batch|class|cohort|intake|fresher|graduate|hiring|fy|cy|q\d)[\s\w]*\d{2,4}[^)]*\)/gi, "")
		.replace(/\s*\(\d{4}[\s\w]*\)/gi, "") // e.g. "(2026)"
		// Remove trailing " - 2026 Freshers" style suffixes
		.replace(/\s*[-–]\s*\d{4}[\w\s]*/g, "")
		.replace(/\s*[-–]\s*(?:batch|class|cohort|fresher|graduate|new grad|campus hire)[\w\s]*/gi, "")
		.trim();
}

function getATSModel() {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
	return createOpenAI({ apiKey, baseURL: env.OPENAI_BASE_URL }).languageModel(SCORING_LLM_CONFIG.model);
}

/**
 * Best-effort job title extraction used when the LLM returns an empty title.
 *
 * Strategy (in priority order):
 * 1. "Position: X" / "Role: X" — explicit colon-delimited declaration (NOT "Role Overview")
 * 2. "We are hiring a X" / "looking for a X" patterns
 * 3. First non-empty line of the JD (very commonly the title in copy-pasted JDs)
 */
function extractJobTitleFallback(text: string): string {
	// Pattern 1: "Role: Senior Engineer" style — REQUIRES a colon so "Role Overview" is excluded
	const colonPattern =
		/(?:role|position|job title|title|opening|opportunity)\s*:\s*([A-Za-z][^\n.:,]{3,60})/i;
	const colonMatch = text.match(colonPattern);
	if (colonMatch?.[1]) {
		const candidate = cleanJobTitle(colonMatch[1].trim().replace(/\s+/g, " "));
		if (!SECTION_HEADER_RE.test(candidate) && candidate.split(" ").length <= 8) {
			return candidate;
		}
	}

	// Pattern 2: "looking for a Senior Software Engineer who..."
	const hiringPattern =
		/(?:hiring|seeking|looking for|searching for)\s+(?:a\s+|an\s+)?([A-Z][A-Za-z\s/&-]{3,50}?)(?:\s+(?:to|who|with|that)\b|\.|,|$)/i;
	const hiringMatch = text.match(hiringPattern);
	if (hiringMatch?.[1]) {
		const candidate = cleanJobTitle(hiringMatch[1].trim().replace(/\s+/g, " "));
		if (
			!SECTION_HEADER_RE.test(candidate) &&
			candidate.split(" ").length <= 6 &&
			!/\b(we|our|you|your|will|must|have|the|and|fresh|passionate)\b/i.test(candidate)
		) {
			return candidate;
		}
	}

	// Pattern 3 (last resort): first non-empty line — JDs typically start with the role name
	const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 3 && l.length < 100);
	for (const line of lines) {
		// Skip lines that look like section headers or metadata
		if (SECTION_HEADER_RE.test(line)) continue;
		if (/^(company|location|department|reports to|salary|job type|work type|employment type)\s*:/i.test(line)) continue;
		// Accept the first line that looks like a role name (not a full sentence)
		if (!/\b(we|our|you|are|is|the|will|must|please|join|apply)\b/i.test(line)) {
			return cleanJobTitle(line);
		}
	}

	return "";
}

/**
 * Normalize a term for word-boundary matching — same logic as keyword-match.ts.
 * Lowercase + replace non-alphanumeric (except +, #, .) with spaces.
 */
function normalizeTerm(term: string): string {
	return term.toLowerCase().replace(/[^a-z0-9+#.]/g, " ").trim();
}

/**
 * Check if a term appears in text with word-boundary awareness.
 * Short terms (≤2 meaningful chars: C, R, Go, JS) require exact word match.
 * Longer terms use substring matching (SQL matches MySQL/PostgreSQL intentionally).
 *
 * This prevents "C" matching "c++" and "R" matching "relational" or "or".
 */
function termFoundInText(term: string, paddedNormalizedText: string): boolean {
	const normalized = normalizeTerm(term);
	const alphaLen = normalized.replace(/\s+/g, "").length;
	if (alphaLen <= 2) {
		// Require the term to be surrounded by spaces (word boundaries in normalized text)
		return paddedNormalizedText.includes(` ${normalized} `);
	}
	return paddedNormalizedText.includes(normalized);
}

/**
 * Scan the JD text against the static skill taxonomy.
 * Uses word-boundary-aware matching to avoid false positives like "C" matching "c++".
 */
function extractFromTaxonomy(text: string): string[] {
	// Pad with spaces so word-boundary checks work at string edges
	const paddedText = " " + normalizeTerm(text) + " ";
	const found: string[] = [];

	for (const category of Object.values(skillsTaxonomy.categories)) {
		for (const [skill, aliases] of Object.entries(category)) {
			const allForms = [skill, ...aliases];
			if (allForms.some((form) => termFoundInText(form, paddedText))) {
				found.push(skill);
			}
		}
	}

	return [...new Set(found)];
}

/** Scan for methodology/practice keywords using the curated static list (all already use \b boundaries). */
function extractMethodologiesStatic(text: string): string[] {
	const found: string[] = [];
	for (const [name, pattern] of STATIC_METHODOLOGIES) {
		if (pattern.test(text)) {
			found.push(name);
		}
	}
	return found;
}

export async function extractKeywords(jobDescription: string): Promise<JDAnalysis> {
	try {
		const model = getATSModel();

		const result = await generateText({
			model,
			temperature: 0,
			// No seed — extraction needs the model's best answer, not a reproducible one.
			// At temperature=0 the output is already near-deterministic without a seed.
			// Using seed=42 (from SCORING_LLM_CONFIG) locks in a fixed internal random state
			// that can produce systematically wrong job titles / keyword sets for certain JD formats.
			output: Output.object({ schema: jdAnalysisSchema }),
			messages: [
				{
					role: "system",
					content: `You are a precise ATS keyword extractor. Given a job description:
1. Extract ONLY skills, tools, and attributes that are explicitly written — do not infer or hallucinate requirements.
2. Normalize skill names to canonical form (e.g. "JS" → "JavaScript", "K8s" → "Kubernetes", "OOP" → "Object-Oriented Programming").
3. For programming languages like "C++", "C#", extract the full name — never fragment them into "C" alone.
4. The jobTitle should be the core role name only — strip any batch/cohort/year info in parentheses. For example: "Graduate Engineer Trainee (Batch of 2026)" → "Graduate Engineer Trainee". Never use section headers like "Overview", "Summary", or "Requirements" as the job title.
5. Only include soft skills and methodologies that are explicitly mentioned by name.`,
				},
				{
					role: "user",
					content: jobDescription,
				},
			],
		});

		const analysis = result.output;

		// Supplement hard skills with taxonomy scan for any explicitly present terms the LLM missed.
		// Word-boundary matching prevents "C" from being extracted from "C++" etc.
		const taxonomyKeywords = extractFromTaxonomy(jobDescription);
		const existingTechKeywords = new Set(
			[...analysis.hardSkills, ...analysis.tools].map((k) => k.toLowerCase()),
		);
		for (const kw of taxonomyKeywords) {
			if (!existingTechKeywords.has(kw.toLowerCase())) {
				analysis.hardSkills.push(kw);
			}
		}

		// Supplement methodologies with static scan
		const staticMethodologies = extractMethodologiesStatic(jobDescription);
		const existingMethodologies = new Set(analysis.methodologies.map((m) => m.toLowerCase()));
		for (const m of staticMethodologies) {
			if (!existingMethodologies.has(m.toLowerCase())) {
				analysis.methodologies.push(m);
			}
		}

		// Always clean the LLM-extracted title (strips batch/cohort suffixes)
		analysis.jobTitle = cleanJobTitle(analysis.jobTitle.trim());

		// If LLM returned empty or a section-header name, fall back to text extraction
		if (!analysis.jobTitle || SECTION_HEADER_RE.test(analysis.jobTitle)) {
			analysis.jobTitle = extractJobTitleFallback(jobDescription);
		}

		return analysis;
	} catch {
		// Full fallback: taxonomy + static methodology extraction only
		const taxonomyKeywords = extractFromTaxonomy(jobDescription);
		const methodologies = extractMethodologiesStatic(jobDescription);
		return {
			hardSkills: taxonomyKeywords,
			softSkills: [],
			tools: [],
			certifications: [],
			methodologies,
			jobTitle: extractJobTitleFallback(jobDescription),
			experienceLevel: "mid",
			educationRequirements: [],
		};
	}
}
