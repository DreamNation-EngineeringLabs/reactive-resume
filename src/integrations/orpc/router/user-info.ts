import { protectedProcedure } from "../context";
import { userInfoDto } from "../dto/user-info";
import { userInfoService } from "../services/user-info";

export const userInfoRouter = {
	get: protectedProcedure
		.route({
			method: "GET",
			path: "/user-info",
			tags: ["User Info"],
			operationId: "getUserInfo",
			summary: "Get the user's master profile info",
			description:
				"Returns the authenticated user's saved profile information (basics, experience, education, etc.) that is used to pre-populate new resumes. Returns null if no info has been saved yet.",
			successDescription: "The user's profile info, or null.",
		})
		.output(userInfoDto.get.output)
		.handler(async ({ context }) => {
			return await userInfoService.get({ userId: context.user.id });
		}),

	upsert: protectedProcedure
		.route({
			method: "PUT",
			path: "/user-info",
			tags: ["User Info"],
			operationId: "upsertUserInfo",
			summary: "Create or update the user's master profile info",
			description:
				"Saves the user's master profile information. If info already exists, it is fully replaced. This data is used to pre-populate new resumes so users don't need to re-enter details.",
			successDescription: "The user info was saved successfully.",
		})
		.input(userInfoDto.upsert.input)
		.output(userInfoDto.upsert.output)
		.handler(async ({ context, input }) => {
			await userInfoService.upsert({ userId: context.user.id, data: input });
		}),
};
