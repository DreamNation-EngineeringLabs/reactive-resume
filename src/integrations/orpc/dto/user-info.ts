import z from "zod";
import { userInfoDataSchema } from "@/schema/resume/user-info";

export const userInfoDto = {
	get: {
		output: userInfoDataSchema.nullable(),
	},

	upsert: {
		input: userInfoDataSchema,
		output: z.void(),
	},
};
