import { ORPCError } from "@orpc/client";
import z from "zod";
import type { ResumeData } from "@/schema/resume/data";
import { protectedProcedure } from "../context";
import { checkPlacementCredit, consumePlacementCredit } from "../helpers/placement-access";
import { scoreResume } from "../services/ats";
import { getAtsAdminStats, getAtsScoreHistory, saveAtsScoreEntry } from "../services/ats/history";
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
			// Check ATS_SCORE credit before allowing scoring
			const creditCheck = await checkPlacementCredit(context.user.email, "ATS_SCORE");
			if (!creditCheck.allowed) {
				throw new ORPCError("FORBIDDEN", {
					message: "No ATS scoring credits remaining. Purchase a placement package to continue.",
				});
			}

			// Dynamically import resume service to avoid circular deps
			const { resumeService } = await import("../services/resume");

			// getById throws NOT_FOUND if resume doesn't exist or doesn't belong to user
			const resume = await resumeService.getById({
				id: input.resumeId,
				userId: context.user.id,
			});

			try {
				const dataForScoring = structuredClone(resume.data) as ResumeData;
				await resumeService.normalizePictureForPreview(dataForScoring);
				const result = await scoreResume(dataForScoring, input.jobDescription, input.includeAiSuggestions);

				// Consume credit after successful scoring
				await consumePlacementCredit(context.user.email, "ATS_SCORE");

				// Persist to history (fire-and-forget — don't fail the response if this errors)
				saveAtsScoreEntry(input.resumeId, context.user.id, result).catch((err) => {
					console.error("[ATS History] Failed to save score entry:", err);
				});

				return result;
			} catch (error) {
				if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
					throw new ORPCError("BAD_GATEWAY", { message: error.message });
				}
				throw error;
			}
		}),

	getHistory: protectedProcedure
		.route({
			method: "GET",
			path: "/ats/score/{resumeId}/history",
			tags: ["ATS"],
			operationId: "getAtsScoreHistory",
			summary: "Get ATS score history for a resume",
			description:
				"Returns all recorded ATS scoring runs for the given resume, oldest first, with delta scores and major improvements vs the previous run.",
			successDescription: "Ordered list of ATS scoring history entries.",
		})
		.input(
			z.object({
				resumeId: z.string().describe("The ID of the resume."),
			}),
		)
		.errors({
			NOT_FOUND: { message: "Resume not found.", status: 404 },
		})
		.handler(async ({ context, input }) => {
			// Verify resume ownership
			const { resumeService } = await import("../services/resume");
			await resumeService.getById({ id: input.resumeId, userId: context.user.id });

			return getAtsScoreHistory(input.resumeId, context.user.id);
		}),

	adminStats: protectedProcedure
		.route({
			method: "GET",
			path: "/ats/admin/stats",
			tags: ["ATS"],
			operationId: "getAtsAdminStats",
			summary: "Get aggregate ATS improvement statistics (tenant-scoped)",
			description:
				"Returns ATS scoring statistics scoped to the caller's tenant: total checks, average improvement, score distribution, top improved categories, and daily activity. Rejects learners.",
			successDescription: "Aggregate ATS statistics for the dashboard.",
		})
		.input(z.object({}))
		.handler(async ({ context }) => {
			const { getEngLabsUserByEmail } = await import("@/integrations/eng-labs");
			const engUser = await getEngLabsUserByEmail(context.user.email);
			if (!engUser) {
				throw new ORPCError("FORBIDDEN", {
					message: "Authenticated user is not provisioned in the institutional directory.",
				});
			}
			if (engUser.userType === "LEARNER") {
				throw new ORPCError("FORBIDDEN", { message: "Learners cannot view aggregate ATS statistics." });
			}
			if (!engUser.tenantId) {
				throw new ORPCError("FORBIDDEN", { message: "Authenticated user has no tenant assignment." });
			}
			return getAtsAdminStats({ tenantId: engUser.tenantId });
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
