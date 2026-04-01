import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import z from "zod";
import type { ResumeData } from "@/schema/resume/data";
import { env } from "@/utils/env";
import { SCORING_LLM_CONFIG, stripHtml } from "./index";

const patchSchema = z.object({
	patches: z.array(
		z.object({
			op: z.enum(["replace", "add", "remove"]),
			path: z.string(),
			value: z.unknown().optional(),
		}),
	),
	explanation: z.string(),
});

function getModel() {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
	return createOpenAI({ apiKey, baseURL: env.OPENAI_BASE_URL }).languageModel(SCORING_LLM_CONFIG.model);
}

function extractSectionData(data: ResumeData, sectionType: string): unknown {
	if (sectionType === "summary") {
		return { title: data.summary.title, content: stripHtml(data.summary.content), hidden: data.summary.hidden };
	}
	if (sectionType === "basics") {
		return data.basics;
	}
	const sections = data.sections as Record<string, unknown>;
	return sections[sectionType] ?? null;
}

export async function editSection(
	data: ResumeData,
	sectionType: string,
	instruction: string,
	jobDescription?: string,
	itemId?: string,
): Promise<{ patches: Array<{ op: string; path: string; value?: unknown }>; explanation: string }> {
	const model = getModel();
	let sectionData = extractSectionData(data, sectionType);
	let scopeContext = "";

	// If an itemId is provided, scope to that specific item
	if (itemId && sectionType !== "summary" && sectionType !== "basics") {
		const section = sectionData as { items?: Array<{ id: string }> };
		if (section?.items) {
			const itemIndex = section.items.findIndex((item) => item.id === itemId);
			if (itemIndex >= 0) {
				sectionData = section.items[itemIndex];
				scopeContext = `\nYou are editing ONLY item at index ${itemIndex} (id: "${itemId}"). All patch paths must target this specific item, e.g. "/sections/${sectionType}/items/${itemIndex}/...".`;
			}
		}
	}

	if (!sectionData) {
		throw new Error(`Section "${sectionType}" not found in resume data.`);
	}

	const sectionPath = sectionType === "summary" ? "" : sectionType === "basics" ? "" : `/sections/${sectionType}`;

	const jdContext = jobDescription
		? `\n\nJob Description (align changes with this if relevant):\n${jobDescription}`
		: "";

	const result = await generateText({
		model,
		temperature: 0,
		seed: 42,
		providerOptions: { openai: { response_format: { type: "json_object" } } },
		messages: [
			{
				role: "system",
				content: `You are an expert resume editor. The user wants to modify a specific section of their resume. You must return a JSON object with "patches" (array of JSON Patch operations) and "explanation" (string).

Each patch must have: "op" ("replace"|"add"|"remove"), "path" (string), and optionally "value".

Rules:
- Every bullet point MUST start with a strong action verb (Led, Developed, Implemented, Optimized, etc.)
- Include quantified metrics where possible (%, $, numbers)
- Follow XYZ formula: "Accomplished [X] by doing [Y], resulting in [Z]"
- Keep bullet points concise (under 20 words when possible)
- No emojis or icons
- Use standard date formats: "Jan 2023", "2023", "Present"
- Do NOT add fake data or fake metrics the user hasn't mentioned
- For description fields, use HTML: wrap bullets in <ul><li>...</li></ul>
- When removing items, use "remove" op with the item's array index path
- When adding items, use "add" op with path ending in "/-" to append
- All new item objects must include: id (use a UUID format like "new-1", "new-2"), hidden: false, options: { showLinkInTitle: false }

The section being edited is: "${sectionType}"
The base path for patches is: "${sectionPath}"
- For summary section: use paths like "/summary/content"
- For other sections: use paths like "/sections/${sectionType}/items/0/description"

Current section data:
${JSON.stringify(sectionData, null, 2)}${scopeContext}${jdContext}`,
			},
			{
				role: "user",
				content: instruction,
			},
		],
	});

	const parsed = patchSchema.safeParse(JSON.parse(result.text));
	if (!parsed.success) {
		throw new Error("AI returned an invalid response format. Please try again.");
	}

	return parsed.data;
}
