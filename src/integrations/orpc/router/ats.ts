import { ORPCError } from "@orpc/client";
import z from "zod";
import type { ResumeData } from "@/schema/resume/data";
import { protectedProcedure } from "../context";
import { scoreResume } from "../services/ats";
import { editSection } from "../services/ats/section-editor";

export const atsRouter = {
	score: protectedProcedure
		.route({
			method: "POST",
			path: "/ats/score",
			tags: ["ATS"],
			operationId: "scoreResume",
			summary: "Score a resume for ATS compatibility",
			description:
				"Evaluates a resume against optional job description and produces an ATS score (0-100) with category breakdowns and actionable suggestions. Uses LLM-powered analysis with reproducible outputs.",
			successDescription: "The ATS scoring result with overall score, category breakdowns, and suggestions.",
		})
		.input(
			z.object({
				resumeId: z.string().describe("The ID of the resume to score."),
				jobDescription: z.string().optional().describe("Optional job description text to score against."),
				includeAiSuggestions: z.boolean().default(true).describe("Whether to generate AI-powered rewrite suggestions."),
			}),
		)
		.errors({
			NOT_FOUND: {
				message: "Resume not found.",
				status: 404,
			},
			BAD_GATEWAY: {
				message: "The AI provider returned an error.",
				status: 502,
			},
		})
		.handler(async ({ context, input }) => {
			// Dynamically import resume service to avoid circular deps
			const { resumeService } = await import("../services/resume");

			// getById throws NOT_FOUND if resume doesn't exist or doesn't belong to user
			const resume = await resumeService.getById({
				id: input.resumeId,
				userId: context.user.id,
			});

			try {
				const result = await scoreResume(resume.data as ResumeData, input.jobDescription, input.includeAiSuggestions);
				return result;
			} catch (error) {
				if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
					throw new ORPCError("BAD_GATEWAY", { message: error.message });
				}
				throw error;
			}
		}),

	edit: protectedProcedure
		.route({
			method: "POST",
			path: "/ats/edit-section",
			tags: ["ATS"],
			operationId: "editSection",
			summary: "AI-powered section editing",
		})
		.input(
			z.object({
				resumeId: z.string(),
				sectionType: z.string(),
				itemId: z.string().optional(),
				instruction: z.string().min(1).max(500),
				jobDescription: z.string().optional(),
			}),
		)
		.errors({
			NOT_FOUND: { message: "Resume not found.", status: 404 },
			BAD_GATEWAY: { message: "The AI provider returned an error.", status: 502 },
		})
		.handler(async ({ context, input }) => {
			const { resumeService } = await import("../services/resume");
			const resume = await resumeService.getById({
				id: input.resumeId,
				userId: context.user.id,
			});

			try {
				return await editSection(
					resume.data as ResumeData,
					input.sectionType,
					input.instruction,
					input.jobDescription,
					input.itemId,
				);
			} catch (error) {
				console.error("[ATS Edit Error]", error);
				if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
					throw new ORPCError("BAD_GATEWAY", { message: error.message });
				}
				throw new ORPCError("BAD_GATEWAY", {
					message: error instanceof Error ? error.message : "Failed to edit section",
				});
			}
		}),
};
