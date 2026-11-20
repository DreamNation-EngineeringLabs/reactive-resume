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

test("the approved bank is all there: 228 comments over 14 sections, ids unique", () => {
	assert.equal(REVIEW_SUGGESTIONS.length, 228);
	assert.equal(SUGGESTION_SECTIONS.length, 14);
	assert.equal(new Set(REVIEW_SUGGESTIONS.map((s) => s.id)).size, 228);
});

test("third round of PO feedback: education short forms, languages, certifications", () => {
	const byId = (id: string) => REVIEW_SUGGESTIONS.find((s) => s.id === id)?.content ?? "";
	assert.match(byId("EDU-08"), /2025-26/);
	assert.match(byId("EDU-10"), /short form/);
	assert.match(byId("EDU-19"), /one line in short form/);
	assert.match(byId("EDU-20"), /short form, e\.g\. ECE/);
	assert.match(byId("ACH-16"), /own Certifications section/);
	for (const id of ["GEN-24", "GEN-25", "GEN-26", "CER-11", "CER-12", "CER-13", "LAN-01", "LAN-02"]) {
		assert.ok(byId(id), id);
	}
	assert.equal(suggestionsForSection("languages").length, 2);
});

test("a Languages heading gets the Languages comments, Programming Languages stays in skills", () => {
	const data = withCustom(
		{ id: "l", title: "Languages Known", type: "summary" },
		{ id: "p", title: "Programming Languages", type: "skills" },
	);
	assert.equal(suggestionSectionKey("l", data), "languages");
	assert.equal(suggestionSectionKey("p", data), "skills", "falls back to its type");
	assert.equal(suggestionSectionKey("languages"), "languages", "the built-in section");
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

test("research headings get the Internships comments, coursework gets Whole resume", () => {
	const data = withCustom(
		{ id: "r1", title: "Research Experience" },
		{ id: "r2", title: "Research Publication" },
		{ id: "r3", title: "Research Work" },
		{ id: "k1", title: "Relevant Coursework" },
		{ id: "k2", title: "Course Work" },
		{ id: "k3", title: "Online Courses" },
	);
	for (const id of ["r1", "r2", "r3"]) assert.equal(suggestionSectionKey(id, data), "experience", id);
	// "Remove the Relevant Coursework section" is a Whole resume comment, not a Certifications one.
	assert.equal(suggestionSectionKey("k1", data), WHOLE_RESUME);
	assert.equal(suggestionSectionKey("k2", data), WHOLE_RESUME);
	assert.equal(suggestionSectionKey("k3", data), "certifications", "courses taken are still certifications");
	assert.ok(suggestionsForSection(WHOLE_RESUME).some((s) => s.id === "GEN-07"));
	// Comments from the coursework picker are on the resume as a whole.
	assert.equal(anchorForSection(WHOLE_RESUME, data), undefined);
});

test("PO feedback is in the bank, without worked examples", () => {
	const ids = ["INT-13", "INT-14", "INT-15", "INT-16", "ACH-27"];
	for (const id of ids)
		assert.ok(
			REVIEW_SUGGESTIONS.some((s) => s.id === id),
			id,
		);
	const space = REVIEW_SUGGESTIONS.filter((s) => s.content.startsWith("Use space efficiently"));
	assert.deepEqual(
		space.map((s) => s.section).sort(),
		["awards", "basics", "certifications", "education", "experience", "general", "personal", "projects", "skills"],
		"one space comment in each of the 9 sections agreed",
	);
	assert.ok(!REVIEW_SUGGESTIONS.some((s) => /\bexample:/i.test(s.content)), "no comment carries an example");
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

test("second round of PO feedback: whole-resume comments, Diploma, publications order", () => {
	const byId = (id: string) => REVIEW_SUGGESTIONS.find((s) => s.id === id);
	for (const id of ["GEN-20", "GEN-21", "GEN-22", "GEN-23"]) assert.equal(byId(id)?.section, "general", id);
	assert.match(byId("EDU-03")?.content ?? "", /Intermediate \/ Diploma/);
	assert.doesNotMatch(byId("EDU-11")?.content ?? "", /e\.g\./);
	assert.match(byId("GEN-09")?.content ?? "", /Educational Details, Publications \/ Patents,/);
});
