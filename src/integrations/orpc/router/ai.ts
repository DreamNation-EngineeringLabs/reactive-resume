import { ORPCError } from "@orpc/client";
import { type } from "@orpc/server";
import { AISDKError, type UIMessage } from "ai";
import { OllamaError } from "ai-sdk-ollama";
import z, { ZodError } from "zod";
import type { ResumeData } from "@/schema/resume/data";
import { env } from "@/utils/env";
import { protectedProcedure } from "../context";
import { aiCredentialsOptionalSchema, aiCredentialsSchema, aiProviderSchema, aiService, fileInputSchema, formatZodError } from "../services/ai";

// Helper to merge optional credentials with environment defaults
function getAICredentialsWithDefaults(
	input?: Partial<z.infer<typeof aiCredentialsSchema>>,
): z.infer<typeof aiCredentialsSchema> {
	const provider = (input?.provider || "openai") as z.infer<typeof aiProviderSchema>;
	const model = input?.model || env.OPENAI_MODEL;
	const apiKey = input?.apiKey || env.OPENAI_API_KEY || "";
	const baseURL = input?.baseURL || env.OPENAI_BASE_URL;

	if (!apiKey) {
		throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file.");
	}

	return { provider, model, apiKey, baseURL };
}

type AIProvider = z.infer<typeof aiProviderSchema>;

export const aiRouter = {
	testConnection: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/test-connection",
			tags: ["AI"],
			operationId: "testAiConnection",
			summary: "Test AI provider connection",
			description:
				"Validates the connection to an AI provider by sending a simple test prompt. Requires the provider type, model name, API key, and an optional base URL. Supported providers: OpenAI, Anthropic, Google Gemini, Ollama, and Vercel AI Gateway. Requires authentication.",
			successDescription: "The AI provider connection was successful.",
		})
		.input(
			z.object({
				provider: aiProviderSchema,
				model: z.string(),
				apiKey: z.string(),
				baseURL: z.string(),
			}),
		)
		.errors({
			BAD_GATEWAY: {
				message: "The AI provider returned an error or is unreachable.",
				status: 502,
			},
		})
		.handler(async ({ input }) => {
			try {
				return await aiService.testConnection(input);
			} catch (error) {
				if (error instanceof AISDKError || error instanceof OllamaError) {
					throw new ORPCError("BAD_GATEWAY", { message: error.message });
				}

				throw error;
			}
		}),

	parsePdf: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/parse-pdf",
			tags: ["AI"],
			operationId: "parseResumePdf",
			summary: "Parse a PDF file into resume data",
			description:
				"Extracts structured resume data from a PDF file using the configured AI provider (OpenAI). The file should be sent as a base64-encoded string. AI credentials are configured server-side. Returns a complete ResumeData object. Requires authentication.",
			successDescription: "The PDF was successfully parsed into structured resume data.",
		})
		.input(
			z.object({
				...aiCredentialsOptionalSchema.shape,
				file: fileInputSchema,
			}),
		)
		.errors({
			BAD_GATEWAY: {
				message: "The AI provider returned an error or is unreachable.",
				status: 502,
			},
		})
		.handler(async ({ input }): Promise<ResumeData> => {
			try {
				console.log("[AI Router] Step 5: parsePdf handler called");
				console.log("[AI Router] Step 6: Input file name:", input.file.name);
				
				const credentials = getAICredentialsWithDefaults(input);
				console.log("[AI Router] Step 7: Credentials loaded, provider:", credentials.provider, "model:", credentials.model);

				console.log("[AI Router] Step 8: Calling aiService.parsePdf");
				const result = await aiService.parsePdf({
					...credentials,
					file: input.file,
				});
				console.log("[AI Router] Step 9: Received result from aiService");
				
				return result;
			} catch (error) {
				if (error instanceof AISDKError) {
					throw new ORPCError("BAD_GATEWAY", { message: error.message });
				}

				if (error instanceof ZodError) {
					throw new Error(formatZodError(error));
				}
				throw error;
			}
		}),

	parseDocx: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/parse-docx",
			tags: ["AI"],
			operationId: "parseResumeDocx",
			summary: "Parse a DOCX file into resume data",
			description:
				"Extracts structured resume data from a DOCX or DOC file using the configured AI provider (OpenAI). The file should be sent as a base64-encoded string. AI credentials are configured server-side. Returns a complete ResumeData object. Requires authentication.",
			successDescription: "The DOCX was successfully parsed into structured resume data.",
		})
		.input(
			z.object({
				...aiCredentialsOptionalSchema.shape,
				file: fileInputSchema,
				mediaType: z.enum([
					"application/msword",
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				]),
			}),
		)
		.errors({
			BAD_GATEWAY: {
				message: "The AI provider returned an error or is unreachable.",
				status: 502,
			},
		})
		.handler(async ({ input }) => {
			try {
				const credentials = getAICredentialsWithDefaults(input);

				return await aiService.parseDocx({
					...credentials,
					file: input.file,
					mediaType: input.mediaType,
				});
			} catch (error) {
				if (error instanceof AISDKError) {
					throw new ORPCError("BAD_GATEWAY", { message: error.message });
				}

				if (error instanceof ZodError) {
					throw new Error(formatZodError(error));
				}

				throw error;
			}
		}),

	chat: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/chat",
			tags: ["AI"],
			operationId: "aiChat",
			summary: "Chat with AI to modify resume",
			description:
				"Streams a chat response from the configured AI provider. The LLM can call the patch_resume tool to generate JSON Patch operations that modify the resume. Requires authentication and AI provider credentials.",
		})
		.input(
			type<{
				provider: AIProvider;
				model: string;
				apiKey: string;
				baseURL: string;
				messages: UIMessage[];
				resumeData: ResumeData;
			}>(),
		)
		.handler(async ({ input }) => {
			try {
				return await aiService.chat(input);
			} catch (error) {
				if (error instanceof AISDKError || error instanceof OllamaError) {
					throw new ORPCError("BAD_GATEWAY", { message: error.message });
				}

				throw error;
			}
		}),
};
