import z from "zod";
import { withEngLabsClient } from "@/integrations/drizzle/eng-labs-client";
import { protectedProcedure } from "../context";
import { checkPlacementCredit } from "../helpers/placement-access";

const creditStatusSchema = z.object({
	allowed: z.boolean(),
	remaining: z.number(),
	total: z.number(),
	used: z.number(),
});

export const quotaRouter = {
	myCredits: protectedProcedure
		.route({
			method: "GET",
			path: "/quota/my-credits",
			tags: ["Quota"],
			operationId: "getMyCredits",
			summary: "Get current user's credit balances",
			description:
				"Returns the credit balance for RESUME_CREATE and ATS_SCORE. remaining = -1 means unlimited (no quota configured for this user).",
			successDescription: "Credit balances for the authenticated user.",
		})
		.output(
			z.object({
				resumeCreate: creditStatusSchema,
				atsScore: creditStatusSchema,
			}),
		)
		.handler(async ({ context }) => {
			const [resumeCreate, atsScore] = await Promise.all([
				checkPlacementCredit(context.user.email, "RESUME_CREATE"),
				checkPlacementCredit(context.user.email, "ATS_SCORE"),
			]);
			return { resumeCreate, atsScore };
		}),

	myUsageLog: protectedProcedure
		.route({
			method: "GET",
			path: "/quota/my-usage",
			tags: ["Quota"],
			operationId: "getMyUsageLog",
			summary: "Get recent credit usage log",
			description:
				"Returns the 20 most recent credit usage events for the authenticated user from the eng-labs quota_usage_logs table.",
			successDescription: "Recent usage log entries.",
		})
		.output(
			z.array(
				z.object({
					id: z.string(),
					serviceType: z.string(),
					amount: z.number(),
					timestamp: z.date(),
				}),
			),
		)
		.handler(async ({ context }) => {
			const rows = await withEngLabsClient(async (client) => {
				const userResult = await client.query<{ id: string }>(
					"SELECT id FROM users WHERE email = $1 LIMIT 1",
					[context.user.email],
				);
				const engLabsUserId = userResult.rows[0]?.id;
				if (!engLabsUserId) return [];

				const { rows: logRows } = await client.query<{
					id: string;
					service_type: string;
					amount: number;
					timestamp: Date;
				}>(
					`SELECT id, service_type, amount, timestamp
					   FROM quota_usage_logs
					  WHERE user_id = $1
					    AND service_type IN ('RESUME_CREATE', 'ATS_SCORE')
					  ORDER BY timestamp DESC
					  LIMIT 20`,
					[engLabsUserId],
				);

				return logRows.map((r) => ({
					id: r.id,
					serviceType: r.service_type,
					amount: r.amount,
					timestamp: r.timestamp,
				}));
			});

			return rows ?? [];
		}),
};
