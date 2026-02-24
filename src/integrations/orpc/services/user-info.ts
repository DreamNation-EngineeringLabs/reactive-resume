import { eq } from "drizzle-orm";
import { db } from "@/integrations/drizzle/client";
import * as schema from "@/integrations/drizzle/schema";
import type { UserInfoData } from "@/schema/resume/user-info";
import { generateId } from "@/utils/string";

export const userInfoService = {
	get: async (input: { userId: string }): Promise<UserInfoData | null> => {
		const [result] = await db
			.select({ data: schema.userInfo.data })
			.from(schema.userInfo)
			.where(eq(schema.userInfo.userId, input.userId))
			.limit(1);

		return result?.data ?? null;
	},

	upsert: async (input: { userId: string; data: UserInfoData }): Promise<void> => {
		const [existing] = await db
			.select({ id: schema.userInfo.id })
			.from(schema.userInfo)
			.where(eq(schema.userInfo.userId, input.userId))
			.limit(1);

		if (existing) {
			await db
				.update(schema.userInfo)
				.set({ data: input.data })
				.where(eq(schema.userInfo.userId, input.userId));
		} else {
			await db.insert(schema.userInfo).values({
				id: generateId(),
				userId: input.userId,
				data: input.data,
			});
		}
	},
};
