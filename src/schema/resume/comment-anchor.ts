import { z } from "zod";
import type { ResumeData } from "./data";

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

/** Starter comment bank for a tenant; reviewers add, use and delete their own from there. */
export const STARTER_SNIPPETS = [
	"Quantify the impact: add numbers, percentages or scale.",
	"Start this line with a strong action verb.",
	"Too long. Cut this to one line.",
	"Not relevant for placements. Remove it.",
	"Fix the grammar or spelling here.",
	"Add more detail here.",
];

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The object an anchor points at inside resume data: one entry, the basics, or the summary. */
export function anchorTarget(data: ResumeData, anchor: CommentAnchor): Record<string, unknown> | undefined {
	if (anchor.section === "basics") return data.basics;
	if (anchor.section === "summary") return data.summary;
	const section =
		data.customSections.find((s) => s.id === anchor.section) ??
		data.sections[anchor.section as keyof ResumeData["sections"]];
	return section?.items.find((item) => item.id === anchor.itemId);
}

/**
 * Where to write a reviewer's suggested rewrite: the one string field of `target` containing `exact`
 * (rich-text fields are HTML, so the text is matched and replaced HTML-escaped).
 * ponytail: null when the text spans formatting or appears more than once — the student copies the
 * suggestion instead. Upgrade path: map the quote through the HTML's text nodes.
 */
export function applySuggestion(target: unknown, exact: string, replacement: string) {
	const hits: { path: string[]; value: string; count: number }[] = [];
	const walk = (node: unknown, path: string[]) => {
		if (typeof node === "string") {
			const html = /<\/?[a-z][^>]*>/i.test(node);
			const needle = html ? escapeHtml(exact) : exact;
			const at = node.indexOf(needle);
			if (at === -1) return;
			const value = node.slice(0, at) + (html ? escapeHtml(replacement) : replacement) + node.slice(at + needle.length);
			hits.push({ path, value, count: node.split(needle).length - 1 });
		} else if (node && typeof node === "object") {
			for (const [key, child] of Object.entries(node)) if (key !== "id") walk(child, [...path, key]);
		}
	};
	walk(target, []);
	return hits.length === 1 && hits[0].count === 1 ? { path: hits[0].path, value: hits[0].value } : null;
}

/** Entries and header fields that differ between two versions of a resume (new entries count as changed). */
export function changedAnchors(before: ResumeData, after: ResumeData): CommentAnchor[] {
	const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
	const out: CommentAnchor[] = [];

	for (const key of ["name", "headline"] as const)
		if (!same(before.basics[key], after.basics[key])) out.push({ section: "basics", field: `basics-${key}` });
	for (const key of ["email", "phone", "location", "website"] as const)
		if (!same(before.basics[key], after.basics[key])) out.push({ section: "basics", field: `basics-item-${key}` });
	if (!same(before.summary.content, after.summary.content)) out.push({ section: "summary" });

	const items = (section: string, old: { id: string }[] = [], now: { id: string }[]) => {
		for (const item of now) {
			const prev = old.find((o) => o.id === item.id);
			if (!prev || !same(prev, item)) out.push({ section, itemId: item.id });
		}
	};
	for (const [key, section] of Object.entries(after.sections))
		items(key, before.sections[key as keyof ResumeData["sections"]]?.items, section.items);
	for (const section of after.customSections)
		items(section.id, before.customSections.find((s) => s.id === section.id)?.items, section.items);

	return out;
}

type EmailComment = { id: string; severity: string | null; content: string; anchor: CommentAnchor | null };

/** The one email a student gets when a reviewer sends their review (instead of one per comment). */
export function reviewSummaryEmail(input: {
	studentName: string;
	reviewerName: string;
	resumeName: string;
	approved: boolean;
	comments: EmailComment[];
	builderUrl: string;
}) {
	const lines = input.comments.map((c, i) => {
		const tag = c.severity === "MUST_FIX" ? "[Must fix] " : c.severity === "SUGGESTION" ? "[Suggestion] " : "";
		const quote = c.anchor?.quote ? `On "${c.anchor.quote.exact}": ` : "";
		const link = c.anchor ? `\n   ${input.builderUrl}?comment=${c.id}` : "";
		return `${i + 1}. ${tag}${quote}${c.content}${link}`;
	});

	const verdict = input.approved
		? `${input.reviewerName} approved your resume "${input.resumeName}".`
		: `${input.reviewerName} reviewed your resume "${input.resumeName}" and asked for changes.`;
	const body = lines.length
		? `Open feedback (${lines.length}):\n\n${lines.join("\n\n")}`
		: "There is no open feedback.";

	return {
		subject: input.approved
			? `Your resume was approved: ${input.resumeName}`
			: `Feedback on your resume: ${input.resumeName}`,
		text: `Hello ${input.studentName},\n\n${verdict}\n\n${body}\n\nOpen your resume: ${input.builderUrl}`,
	};
}
