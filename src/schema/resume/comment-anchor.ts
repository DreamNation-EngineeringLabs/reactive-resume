import { z } from "zod";

/**
 * Where a reviewer comment points on a resume. Anchored to resume data (section → item → field),
 * not to page coordinates, so it survives template switches and layout changes.
 * - section only: the whole section (e.g. reviewer selected the "Skills" title)
 * - + itemId: one entry (e.g. one job)
 * - + field + quote: an exact span of text inside that entry's field
 */
export const commentAnchorSchema = z.object({
	section: z.string().min(1).max(100),
	itemId: z.string().max(100).optional(),
	field: z.string().max(100).optional(),
	quote: z
		.object({
			exact: z.string().min(1).max(2000),
			prefix: z.string().max(64),
			suffix: z.string().max(64),
		})
		.optional(),
	start: z.number().int().min(0).optional(),
});

export type CommentAnchor = z.infer<typeof commentAnchorSchema>;

export const commentSeveritySchema = z.enum(["MUST_FIX", "SUGGESTION"]);

export type CommentSeverity = z.infer<typeof commentSeveritySchema>;

/** Best index of `quote.exact` in `text`: matching context wins, then closeness to where it was. -1 if gone. */
export function findQuote(text: string, quote: NonNullable<CommentAnchor["quote"]>, hint = 0) {
	let best = -1;
	let bestScore = Number.NEGATIVE_INFINITY;
	for (let i = text.indexOf(quote.exact); i !== -1; i = text.indexOf(quote.exact, i + 1)) {
		const before = text.slice(Math.max(0, i - quote.prefix.length), i);
		const after = text.slice(i + quote.exact.length, i + quote.exact.length + quote.suffix.length);
		const score =
			Number(before === quote.prefix) + Number(after === quote.suffix) - Math.abs(i - hint) / (text.length + 1);
		if (score > bestScore) {
			best = i;
			bestScore = score;
		}
	}
	return best;
}
