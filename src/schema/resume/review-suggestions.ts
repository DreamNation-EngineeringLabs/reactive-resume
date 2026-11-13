import type { CommentAnchor, CommentSeverity } from "./comment-anchor";
import type { ResumeData } from "./data";
import { REVIEW_SUGGESTION_BANK } from "./review-suggestion-bank";

/**
 * The standard feedback a reviewer can send on each resume section, one click each.
 *
 * These are curated by the placement team and ship with the app rather than living in
 * `review_snippet`: that table is per-tenant, has no section of its own, and lets any reviewer
 * delete a row for everybody. The list itself is in `review-suggestion-bank.ts`.
 *
 * `severity` decides the highlight colour: HIGH must be fixed before the resume is verified, MEDIUM
 * weakens it noticeably, LOW is polish. The reviewer can still override it before sending.
 */
export type ReviewSuggestion = {
	/** Stable id from the approved comment bank, e.g. "PRJ-13". Faculty refer to lines by it. */
	id: string;
	/** A key from `SUGGESTION_SECTIONS`. */
	section: string;
	/** Sub-heading inside a long section, e.g. "Links" under Projects. */
	group?: string;
	content: string;
	severity: CommentSeverity;
};

export const REVIEW_SUGGESTIONS: readonly ReviewSuggestion[] = REVIEW_SUGGESTION_BANK;

/** Picker key for comments on the resume as a whole: they point at no section. */
export const WHOLE_RESUME = "general";

/**
 * Sections that have standard feedback, in the order a resume is read.
 *
 * Most keys are the builder's own sections. Strengths, Personal Details and Declaration are not:
 * students add them as custom sections, so `title` is how one is recognised (see `customSectionKey`).
 * Built-in sections a student renamed are found by their key, whatever the heading says.
 */
export const SUGGESTION_SECTIONS: readonly { key: string; label: string; builtIn: boolean; title?: RegExp }[] = [
	// A "Relevant Coursework" section is feedback on the resume as a whole: remove it (GEN-07).
	{ key: WHOLE_RESUME, label: "Whole resume", builtIn: false, title: /course ?work/i },
	{ key: "basics", label: "Header", builtIn: true },
	{ key: "summary", label: "Career Objective", builtIn: true, title: /objective|summary|profile|about/i },
	{ key: "education", label: "Educational Details", builtIn: true, title: /educat|academ|qualif/i },
	{ key: "skills", label: "Technical Skills", builtIn: true, title: /skill|technolog|tools/i },
	{ key: "experience", label: "Internships", builtIn: true, title: /intern|experience|employ|research/i },
	{ key: "projects", label: "Projects", builtIn: true, title: /project/i },
	{
		key: "awards",
		label: "Achievements",
		builtIn: true,
		title: /achiev|award|honou?r|accomplish|curricular|activit/i,
	},
	{ key: "certifications", label: "Certifications", builtIn: true, title: /certif|course/i },
	{ key: "strengths", label: "Strengths", builtIn: false, title: /strength/i },
	{ key: "interests", label: "Hobbies", builtIn: true, title: /hobb|interest/i },
	{ key: "personal", label: "Personal Details", builtIn: false, title: /personal/i },
	{ key: "declaration", label: "Declaration", builtIn: false, title: /declar/i },
];

// Specific headings first: "Personal Projects" is projects, "Technical Skills" is not "Technical…" anything else,
// and "Relevant Coursework" is not Certifications.
const TITLE_ORDER = [
	WHOLE_RESUME,
	"strengths",
	"declaration",
	"projects",
	"personal",
	"interests",
	"certifications",
	"awards",
	"experience",
	"skills",
	"education",
	"summary",
];

/** The picker key a custom section's heading names, e.g. "My Strengths" → "strengths". */
function customSectionKey(title: string): string | null {
	for (const key of TITLE_ORDER) {
		if (SUGGESTION_SECTIONS.find((s) => s.key === key)?.title?.test(title)) return key;
	}
	return null;
}

/** The standard feedback for one picker key. */
export function suggestionsForSection(section: string | null | undefined): readonly ReviewSuggestion[] {
	if (!section) return [];
	return REVIEW_SUGGESTIONS.filter((s) => s.section === section);
}

/**
 * The picker key for the section an anchor points at, or null when it has no standard feedback.
 *
 * A built-in section is its own key. A custom section is an id, so it is looked up in the resume and
 * recognised by its heading; a dotted id falls back to the part before the dot.
 */
export function suggestionSectionKey(section: string, data?: ResumeData): string | null {
	if (SUGGESTION_SECTIONS.some((s) => s.builtIn && s.key === section)) return section;
	const custom = data?.customSections.find((s) => s.id === section);
	if (custom) return customSectionKey(custom.title) ?? suggestionSectionKey(custom.type);
	const base = section.split(".")[0];
	return base !== section ? suggestionSectionKey(base, data) : null;
}

/**
 * What a comment posted from the picker points at: the section on this resume that matches the key,
 * or nothing — a comment on the resume as a whole — when the key is "Whole resume" or the student has
 * no such section (the usual case for "Add a Strengths section").
 *
 * A built-in section is used unless it is empty while a custom section with a matching heading has
 * entries: students often keep achievements in a custom "Achievements" section and leave Awards empty.
 */
export function anchorForSection(key: string, data: ResumeData): CommentAnchor | undefined {
	if (key === WHOLE_RESUME) return undefined;
	const custom = data.customSections.find((s) => customSectionKey(s.title) === key);
	const entry = SUGGESTION_SECTIONS.find((s) => s.key === key);
	if (!entry?.builtIn) return custom ? { section: custom.id } : undefined;
	if (key === "basics" || key === "summary") return { section: key };
	const builtIn = data.sections[key as keyof ResumeData["sections"]];
	if (custom && custom.items.length > 0 && (!builtIn || builtIn.items.length === 0)) return { section: custom.id };
	return { section: key };
}

/** Label for a picker key. */
export function suggestionSectionLabel(section: string): string {
	return SUGGESTION_SECTIONS.find((s) => s.key === section)?.label ?? section;
}
