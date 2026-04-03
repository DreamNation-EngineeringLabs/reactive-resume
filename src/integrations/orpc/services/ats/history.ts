import type { InferSelectModel } from "drizzle-orm";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/integrations/drizzle/client";
import { type AtsMajorImprovement, atsScoreHistory } from "@/integrations/drizzle/schema";
import type { ScoringResult } from "./index";

type AtsScoreHistoryRow = InferSelectModel<typeof atsScoreHistory>;

const CATEGORY_LABELS: Record<string, string> = {
	keywordMatch: "Keyword Match",
	impactMetrics: "Impact & Metrics",
	structure: "Structure",
	formatting: "Formatting",
	brevity: "Brevity",
	tailoring: "Tailoring / Content Quality",
};

export type AtsHistoryEntry = {
	id: string;
	resumeId: string;
	overallScore: number;
	categoryScores: Record<string, { score: number; max: number }>;
	deltaScore: number | null;
	majorImprovements: AtsMajorImprovement[];
	jobDescriptionProvided: boolean;
	createdAt: Date;
};

export type AtsAdminStats = {
	totalChecks: number;
	avgScoreImprovement: number;
	avgCurrentScore: number;
	topImprovedCategories: Array<{ category: string; label: string; avgDelta: number }>;
	scoreDistribution: Array<{ bucket: string; count: number }>;
	checksByDay: Array<{ date: string; count: number; avgScore: number }>;
};

/**
 * Save a new ATS scoring run to history.
 * Computes delta and major improvements vs the most recent previous entry.
 */
export async function saveAtsScoreEntry(
	resumeId: string,
	userId: string,
	result: ScoringResult,
): Promise<AtsHistoryEntry> {
	// Fetch the most recent previous entry for delta calculation
	const [previous] = await db
		.select()
		.from(atsScoreHistory)
		.where(eq(atsScoreHistory.resumeId, resumeId))
		.orderBy(desc(atsScoreHistory.createdAt))
		.limit(1);

	const deltaScore = previous != null ? result.overall - previous.overallScore : null;

	// Build category snapshot map
	const categoryScores: Record<string, { score: number; max: number }> = {};
	for (const [key, cat] of Object.entries(result.categories)) {
		if (cat != null) {
			categoryScores[key] = { score: cat.score, max: cat.max };
		}
	}

	// Compute major improvements: categories where score percentage improved vs previous
	const majorImprovements: AtsMajorImprovement[] = [];
	if (previous?.categoryScores) {
		const prevCats = previous.categoryScores as Record<string, { score: number; max: number }>;
		for (const [key, curr] of Object.entries(categoryScores)) {
			const prev = prevCats[key];
			if (!prev || prev.max === 0) continue;
			const prevPct = prev.max > 0 ? (prev.score / prev.max) * 100 : 0;
			const currPct = curr.max > 0 ? (curr.score / curr.max) * 100 : 0;
			const delta = Math.round(currPct - prevPct);
			if (delta > 0) {
				majorImprovements.push({
					category: key,
					label: CATEGORY_LABELS[key] ?? key,
					delta,
				});
			}
		}
		// Sort by largest improvement first
		majorImprovements.sort((a, b) => b.delta - a.delta);
	}

	const [inserted] = await db
		.insert(atsScoreHistory)
		.values({
			resumeId,
			userId,
			overallScore: result.overall,
			categoryScores,
			deltaScore,
			majorImprovements,
			jobDescriptionProvided: result.metadata.jdProvided,
		})
		.returning();

	return {
		id: inserted.id,
		resumeId: inserted.resumeId,
		overallScore: inserted.overallScore,
		categoryScores: inserted.categoryScores as Record<string, { score: number; max: number }>,
		deltaScore: inserted.deltaScore ?? null,
		majorImprovements: (inserted.majorImprovements as AtsMajorImprovement[]) ?? [],
		jobDescriptionProvided: inserted.jobDescriptionProvided,
		createdAt: inserted.createdAt,
	};
}

/**
 * Retrieve all ATS scoring history for a resume, oldest-first.
 * Only returns entries owned by the given userId.
 */
export async function getAtsScoreHistory(resumeId: string, userId: string): Promise<AtsHistoryEntry[]> {
	const rows = await db
		.select()
		.from(atsScoreHistory)
		.where(eq(atsScoreHistory.resumeId, resumeId))
		.orderBy(asc(atsScoreHistory.createdAt));

	// Safety: only return rows belonging to this user
	return (rows as AtsScoreHistoryRow[])
		.filter((r) => r.userId === userId)
		.map((r) => ({
			id: r.id,
			resumeId: r.resumeId,
			overallScore: r.overallScore,
			categoryScores: r.categoryScores as Record<string, { score: number; max: number }>,
			deltaScore: r.deltaScore ?? null,
			majorImprovements: (r.majorImprovements as AtsMajorImprovement[]) ?? [],
			jobDescriptionProvided: r.jobDescriptionProvided,
			createdAt: r.createdAt,
		}));
}

/**
 * Admin aggregate stats across all resumes (or a specific tenant if implemented later).
 * Returns summary metrics suitable for a dashboard.
 */
export async function getAtsAdminStats(): Promise<AtsAdminStats> {
	// 1. Total checks
	const [totalResult] = await db.select({ count: sql<number>`count(*)::int` }).from(atsScoreHistory);
	const totalChecks = totalResult?.count ?? 0;

	// 2. Average improvement (only for entries that have a delta)
	const [avgDeltaResult] = await db
		.select({ avg: sql<number>`avg(delta_score)::float` })
		.from(atsScoreHistory)
		.where(sql`delta_score is not null`);
	const avgScoreImprovement = Math.round((avgDeltaResult?.avg ?? 0) * 10) / 10;

	// 3. Average current score per resume (latest entry per resume)
	const [avgScoreResult] = await db.select({ avg: sql<number>`avg(overall_score)::float` }).from(atsScoreHistory);
	const avgCurrentScore = Math.round(avgScoreResult?.avg ?? 0);

	// 4. Score distribution buckets: 0-20, 21-40, 41-60, 61-80, 81-100
	const allScores = await db.select({ score: atsScoreHistory.overallScore }).from(atsScoreHistory);

	const buckets = [
		{ bucket: "0–20", min: 0, max: 20, count: 0 },
		{ bucket: "21–40", min: 21, max: 40, count: 0 },
		{ bucket: "41–60", min: 41, max: 60, count: 0 },
		{ bucket: "61–80", min: 61, max: 80, count: 0 },
		{ bucket: "81–100", min: 81, max: 100, count: 0 },
	];
	for (const { score } of allScores) {
		const bucket = buckets.find((b) => score >= b.min && score <= b.max);
		if (bucket) bucket.count++;
	}

	// 5. Checks by day (last 14 days)
	const last14 = await db
		.select({
			date: sql<string>`date_trunc('day', created_at)::date::text`,
			count: sql<number>`count(*)::int`,
			avgScore: sql<number>`avg(overall_score)::float`,
		})
		.from(atsScoreHistory)
		.where(sql`created_at >= now() - interval '14 days'`)
		.groupBy(sql`date_trunc('day', created_at)`)
		.orderBy(sql`date_trunc('day', created_at) asc`);

	const checksByDay = (last14 as Array<{ date: string; count: number; avgScore: number }>).map((r) => ({
		date: r.date,
		count: r.count,
		avgScore: Math.round(r.avgScore ?? 0),
	}));

	// 6. Top improved categories — from majorImprovements jsonb array
	// Aggregate deltas per category across all entries that have improvements
	const rows = await db
		.select({ improvements: atsScoreHistory.majorImprovements })
		.from(atsScoreHistory)
		.where(sql`jsonb_array_length(major_improvements) > 0`);

	const catDeltaSum: Record<string, { sum: number; count: number; label: string }> = {};
	for (const row of rows) {
		const improvements = (row.improvements as AtsMajorImprovement[]) ?? [];
		for (const imp of improvements) {
			if (!catDeltaSum[imp.category]) {
				catDeltaSum[imp.category] = { sum: 0, count: 0, label: imp.label };
			}
			catDeltaSum[imp.category].sum += imp.delta;
			catDeltaSum[imp.category].count++;
		}
	}

	const topImprovedCategories = Object.entries(catDeltaSum)
		.map(([category, { sum, count, label }]) => ({
			category,
			label,
			avgDelta: Math.round((sum / count) * 10) / 10,
		}))
		.sort((a, b) => b.avgDelta - a.avgDelta)
		.slice(0, 5);

	return {
		totalChecks,
		avgScoreImprovement,
		avgCurrentScore,
		topImprovedCategories,
		scoreDistribution: buckets.map(({ bucket, count }) => ({ bucket, count })),
		checksByDay,
	};
}
