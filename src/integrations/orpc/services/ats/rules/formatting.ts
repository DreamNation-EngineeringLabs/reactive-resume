import type { ResumeData } from "@/schema/resume/data";
import type { CategoryScore, RuleResult } from "../index";
import { stripHtml } from "../index";

const MAX_SCORE = 15;

export const ATS_SAFE_FONTS = [
	"arial", "calibri", "cambria", "georgia", "garamond", "helvetica",
	"times new roman", "trebuchet ms", "verdana", "tahoma", "book antiqua",
	"century gothic", "lucida sans", "palatino linotype",
	// Common system fonts that also work well
	"lato", "open sans", "roboto", "source sans pro", "inter",
	"ibm plex sans", "ibm plex serif",
];

export const ATS_SAFE_TEMPLATES = [
	"azurill", "bronzor", "chikorita", "ditto", "kakuna",
	"nosepass", "onyx", "pikachu", "leafish", "gengar",
];

/** Check if a date string uses standard format */
export function isStandardDateFormat(dateStr: string): boolean {
	if (!dateStr.trim()) return true;
	// Accept: "Jan 2023", "January 2023", "January, 2023", "2023", "01/2023", "2023-01", "Present", "Current"
	return /^(present|current|\d{4}|[a-z]+\.?,?\s*\d{4}|\d{2}\/\d{4}|\d{4}-\d{2})/i.test(dateStr.trim());
}

/** Regex matching emoji/icon unicode ranges */
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2B50}\u{2B55}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{2934}-\u{2935}\u{2B05}-\u{2B07}]/u;

/** Find all emoji occurrences in text, return the emojis found */
export function findEmojis(text: string): string[] {
	const matches = text.match(new RegExp(EMOJI_REGEX.source, "gu"));
	return matches ?? [];
}

export async function scoreFormatting(data: ResumeData): Promise<CategoryScore> {
	const details: RuleResult[] = [];

	// FM-1: ATS-safe font (4 pts)
	const bodyFont = (data.metadata.typography?.body?.fontFamily ?? "").toLowerCase();
	const headingFont = (data.metadata.typography?.heading?.fontFamily ?? "").toLowerCase();
	const fontFamily = bodyFont || headingFont;
	const isAtsSafeFont = fontFamily === "" || ATS_SAFE_FONTS.some((f) => fontFamily.includes(f));
	const fm1Score = isAtsSafeFont ? 4 : 0;

	details.push({
		ruleId: "FM-1",
		ruleName: "ATS-safe font",
		score: fm1Score,
		maxScore: 4,
		details: isAtsSafeFont
			? `Font "${fontFamily || "default"}" is ATS-safe.`
			: `Font "${fontFamily}" may not be ATS-safe. Consider using Arial, Calibri, or similar.`,
	});

	// FM-2: No profile picture visible (2 pts)
	const pictureHidden = data.picture.hidden;
	const fm2Score = pictureHidden ? 2 : 0;

	details.push({
		ruleId: "FM-2",
		ruleName: "No profile picture",
		score: fm2Score,
		maxScore: 2,
		details: pictureHidden
			? "Profile picture is hidden — ATS-friendly."
			: "Profile picture is visible. Most ATS systems can't parse images — consider hiding it.",
	});

	// FM-3: ATS-safe template (4 pts)
	const template = data.metadata.template?.toLowerCase() ?? "";
	const isAtsSafeTemplate = template === "" || ATS_SAFE_TEMPLATES.includes(template);
	const fm3Score = isAtsSafeTemplate ? 4 : 2; // Give partial credit for unknown templates

	details.push({
		ruleId: "FM-3",
		ruleName: "ATS-safe template",
		score: fm3Score,
		maxScore: 4,
		details: isAtsSafeTemplate
			? `Template "${template || "default"}" is verified ATS-safe.`
			: `Template "${template}" hasn't been verified as ATS-safe. Single-column templates are generally safer.`,
	});

	// FM-4: Standard date formats (4 pts)
	const itemsWithDates: { section: string; period: string }[] = [];

	for (const key of ["experience", "education", "projects", "volunteer"] as const) {
		const section = data.sections[key];
		if (section.hidden) continue;
		for (const item of section.items) {
			if (item.hidden) continue;
			if ("period" in item && typeof (item as { period?: string }).period === "string") {
				const period = (item as { period: string }).period;
				if (period.trim()) {
					itemsWithDates.push({ section: key, period });
				}
			}
		}
	}

	const nonStandardDates = itemsWithDates.filter((d) => {
		// Split period by common separators (dashes, en/em-dashes, or "to") and check each part
		const parts = d.period.split(/\s*(?:[-–—]+|\bto\b)\s*/i);
		return parts.some((part) => part.length > 0 && !isStandardDateFormat(part));
	});

	const fm4Score = itemsWithDates.length === 0 ? 4 :
		Math.round((1 - nonStandardDates.length / itemsWithDates.length) * 4);

	details.push({
		ruleId: "FM-4",
		ruleName: "Standard date formats",
		score: fm4Score,
		maxScore: 4,
		details: nonStandardDates.length > 0
			? `${nonStandardDates.length} date(s) use non-standard formats. Use "Jan 2023" or "2023" style.`
			: "All dates use standard ATS-readable formats.",
	});

	// FM-5: No emojis or icons (1 pt)
	// Scan all visible text for emoji characters
	const allText = [
		data.basics.name, data.basics.headline, data.basics.email, data.basics.phone, data.basics.location,
		stripHtml(data.summary.content),
	];
	const sectionKeys = ["experience", "projects", "volunteer", "education", "skills", "awards", "certifications", "publications"] as const;
	for (const key of sectionKeys) {
		const section = data.sections[key];
		if (section.hidden) continue;
		for (const item of section.items) {
			if (item.hidden) continue;
			for (const val of Object.values(item)) {
				if (typeof val === "string") allText.push(val);
			}
		}
	}
	const emojiCount = allText.reduce((count, t) => count + findEmojis(t).length, 0);
	const fm5Score = emojiCount === 0 ? 1 : 0;

	details.push({
		ruleId: "FM-5",
		ruleName: "No emojis or icons",
		score: fm5Score,
		maxScore: 1,
		details: emojiCount > 0
			? `Found ${emojiCount} emoji(s) in your resume. ATS parsers cannot read emojis — remove them.`
			: "No emojis found — ATS-friendly.",
	});

	const totalScore = Math.min(MAX_SCORE, fm1Score + fm2Score + fm3Score + fm4Score + fm5Score);
	return { score: totalScore, max: MAX_SCORE, details };
}
