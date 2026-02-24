import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { defaultResumeData, resumeDataSchema, type ResumeData } from "@/schema/resume/data";
import type { UserInfoData } from "@/schema/resume/user-info";
import { env } from "@/utils/env";
import atsRules from "../../../../ATS_RULES.md?raw";

const SYSTEM_PROMPT = `You are an expert resume writer specializing in ATS-optimized resumes. Your task is to generate a professional resume from the user's profile information, tailored for a specific job description.

## ATS RULES (MUST FOLLOW)
${atsRules}

## INSTRUCTIONS

1. You will receive the user's complete profile information (experience, education, skills, projects, etc.) and optionally a job description.
2. Your job is to generate a structured resume JSON that:
   - Uses the user's ACTUAL data — never invent, hallucinate, or fabricate information
   - Follows ALL ATS rules above
   - If a job description is provided, tailor the resume to match:
     * Reorder sections to highlight the most relevant experience
     * Use keywords from the job description naturally in descriptions
     * Prioritize relevant skills, experience, and projects
     * Craft a targeted professional summary
   - Write impact-driven bullet points using the XYZ formula
   - Use action verbs (Architected, Implemented, Optimized, Spearheaded, etc.)
   - Quantify achievements wherever the data supports it
   - Use standard section headings
   - Keep descriptions as HTML-formatted strings using <p> and <ul><li> tags

3. CRITICAL: Only use information provided by the user. If a field is empty, leave it empty.
   Do NOT make up metrics, dates, company names, or any other data.

4. For the summary: Write a concise, impactful professional summary (3-4 sentences)
   that highlights the user's key qualifications relevant to the job description.
   If no job description is provided, write a general professional summary.

5. For experience descriptions: Rewrite bullet points to be impact-driven following ATS best practices,
   but ONLY based on information the user actually provided. Do not add fictional achievements.

6. Set appropriate section titles:
   - "Experience" or "Work Experience" for experience
   - "Education" for education
   - "Projects" for projects
   - "Skills" for skills
   - "Certifications" for certifications
   - "Achievements" for awards
   - "Languages" for languages
   - etc.

## OUTPUT
Output ONLY valid JSON conforming to the resume data schema. No markdown, no explanations.
`;

type GenerateInput = {
	userInfo: UserInfoData;
	jobDescription: string;
};

/**
 * Generates resume data from user info, optionally tailored to a job description.
 * Falls back to a simple data mapping if AI is not configured.
 */
async function generateFromUserInfo(input: GenerateInput): Promise<ResumeData> {
	const { userInfo, jobDescription } = input;

	// If OpenAI is not configured, fall back to simple mapping
	if (!env.OPENAI_API_KEY) {
		return mapUserInfoToResumeData(userInfo);
	}

	try {
		const openai = createOpenAI({
			apiKey: env.OPENAI_API_KEY,
			baseURL: env.OPENAI_BASE_URL,
		});

		const userPrompt = buildUserPrompt(userInfo, jobDescription);

		const result = await generateText({
			model: openai.languageModel(env.OPENAI_MODEL),
			output: Output.object({ schema: resumeDataSchema }),
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: userPrompt },
			],
		});

		// Merge AI output with defaults for metadata/picture/custom sections
		return resumeDataSchema.parse({
			...result.output,
			customSections: [],
			picture: userInfo.picture,
			metadata: defaultResumeData.metadata,
		});
	} catch (error) {
		console.error("[Resume AI] Failed to generate resume via AI, falling back to simple mapping:", error);
		return mapUserInfoToResumeData(userInfo);
	}
}

function buildUserPrompt(userInfo: UserInfoData, jobDescription: string): string {
	let prompt = `Here is the user's profile information:\n\n${JSON.stringify(userInfo, null, 2)}`;

	if (jobDescription.trim()) {
		prompt += `\n\nHere is the job description the resume should be tailored for:\n\n${jobDescription}`;
	} else {
		prompt += `\n\nNo specific job description provided. Generate a strong general-purpose resume.`;
	}

	return prompt;
}

/**
 * Simple fallback: maps UserInfoData directly to ResumeData without AI processing.
 * Used when AI credentials are not configured.
 */
function mapUserInfoToResumeData(userInfo: UserInfoData): ResumeData {
	return {
		...defaultResumeData,
		picture: userInfo.picture,
		basics: userInfo.basics,
		summary: {
			title: "Summary",
			columns: 1,
			hidden: !userInfo.summary,
			content: userInfo.summary,
		},
		sections: {
			profiles: {
				title: "Profiles",
				columns: 1,
				hidden: userInfo.profiles.length === 0,
				items: userInfo.profiles,
			},
			experience: {
				title: "Experience",
				columns: 1,
				hidden: userInfo.experience.length === 0,
				items: userInfo.experience,
			},
			education: {
				title: "Education",
				columns: 1,
				hidden: userInfo.education.length === 0,
				items: userInfo.education,
			},
			projects: {
				title: "Projects",
				columns: 1,
				hidden: userInfo.projects.length === 0,
				items: userInfo.projects,
			},
			skills: {
				title: "Skills",
				columns: 1,
				hidden: userInfo.skills.length === 0,
				items: userInfo.skills,
			},
			languages: {
				title: "Languages",
				columns: 1,
				hidden: userInfo.languages.length === 0,
				items: userInfo.languages,
			},
			interests: {
				title: "Interests",
				columns: 1,
				hidden: userInfo.interests.length === 0,
				items: userInfo.interests,
			},
			awards: {
				title: "Achievements",
				columns: 1,
				hidden: userInfo.awards.length === 0,
				items: userInfo.awards,
			},
			certifications: {
				title: "Certifications",
				columns: 1,
				hidden: userInfo.certifications.length === 0,
				items: userInfo.certifications,
			},
			publications: {
				title: "Publications",
				columns: 1,
				hidden: userInfo.publications.length === 0,
				items: userInfo.publications,
			},
			volunteer: {
				title: "Volunteer Experience",
				columns: 1,
				hidden: userInfo.volunteer.length === 0,
				items: userInfo.volunteer,
			},
			references: {
				title: "References",
				columns: 1,
				hidden: userInfo.references.length === 0,
				items: userInfo.references,
			},
		},
	};
}

export const aiService = {
	generateFromUserInfo,
};
