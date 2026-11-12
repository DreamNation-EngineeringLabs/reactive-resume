// Run: pnpm exec tsx --test src/schema/resume/review-suggestions.check.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { type CustomSectionType, defaultResumeData, type ResumeData } from "./data";
import {
	anchorForSection,
	REVIEW_SUGGESTIONS,
	SUGGESTION_SECTIONS,
	suggestionSectionKey,
	suggestionsForSection,
	WHOLE_RESUME,
} from "./review-suggestions";

/** A resume with the given custom sections; `items` only needs a length for these checks. */
function withCustom(...sections: { id: string; title: string; type?: CustomSectionType; items?: number }[]) {
	return {
		...defaultResumeData,
		customSections: sections.map(({ id, title, type = "summary", items = 0 }) => ({
			...defaultResumeData.sections.awards,
			id,
			title,
			type,
			items: Array.from({ length: items }, (_, i) => ({ id: `${id}-${i}` })),
		})),
	} as unknown as ResumeData;
}

test("the approved bank is all there: 201 comments over 13 sections, ids unique", () => {
	assert.equal(REVIEW_SUGGESTIONS.length, 201);
	assert.equal(SUGGESTION_SECTIONS.length, 13);
	assert.equal(new Set(REVIEW_SUGGESTIONS.map((s) => s.id)).size, 201);
});

test("every suggestion belongs to a section in the picker, and every section has suggestions", () => {
	const keys = new Set(SUGGESTION_SECTIONS.map((s) => s.key));
	for (const s of REVIEW_SUGGESTIONS) assert.ok(keys.has(s.section), s.id);
	for (const { key } of SUGGESTION_SECTIONS) assert.ok(suggestionsForSection(key).length > 0, key);
});

test("a built-in section is its own picker key", () => {
	for (const { key, builtIn } of SUGGESTION_SECTIONS) {
		if (builtIn) assert.equal(suggestionSectionKey(key), key);
	}
});

test("a custom section is recognised by its heading", () => {
	const data = withCustom(
		{ id: "c1", title: "Strengths" },
		{ id: "c2", title: "PERSONAL DETAILS" },
		{ id: "c3", title: "Declaration" },
		{ id: "c4", title: "Achievements" },
		{ id: "c5", title: "Hobbies" },
		{ id: "c6", title: "Personal Projects" },
		{ id: "c7", title: "Co-curricular Activities" },
	);
	assert.equal(suggestionSectionKey("c1", data), "strengths");
	assert.equal(suggestionSectionKey("c2", data), "personal");
	assert.equal(suggestionSectionKey("c3", data), "declaration");
	assert.equal(suggestionSectionKey("c4", data), "awards");
	assert.equal(suggestionSectionKey("c5", data), "interests");
	assert.equal(suggestionSectionKey("c6", data), "projects", "a heading that names projects is projects");
	assert.equal(suggestionSectionKey("c7", data), "awards");
});

test("a custom section with an unknown heading falls back to its type, then to nothing", () => {
	const data = withCustom({ id: "p", title: "Things I built", type: "projects" }, { id: "x", title: "Misc" });
	assert.equal(suggestionSectionKey("p", data), "projects");
	assert.equal(suggestionSectionKey("x", data), "summary", "type summary is a key too");
	assert.equal(suggestionSectionKey("gone", data), null, "a deleted custom section has no key");
});

test("whole resume, and a section the student does not have, post with no anchor", () => {
	assert.equal(anchorForSection(WHOLE_RESUME, defaultResumeData), undefined);
	assert.equal(anchorForSection("strengths", defaultResumeData), undefined, "e.g. 'Add a Strengths section'");
});

test("a custom Strengths section is where Strengths comments go", () => {
	assert.deepEqual(anchorForSection("strengths", withCustom({ id: "s", title: "My Strengths" })), { section: "s" });
});

test("a built-in section is used unless it is empty and a matching custom one is not", () => {
	assert.deepEqual(anchorForSection("awards", defaultResumeData), { section: "awards" });
	assert.deepEqual(anchorForSection("awards", withCustom({ id: "a", title: "Achievements", items: 3 })), {
		section: "a",
	});
	assert.deepEqual(anchorForSection("awards", withCustom({ id: "a", title: "Achievements", items: 0 })), {
		section: "awards",
	});
	assert.deepEqual(anchorForSection("basics", defaultResumeData), { section: "basics" });
});
