// Run: pnpm exec tsx --test src/schema/resume/review-suggestions.check.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { SUGGESTION_SECTIONS, suggestionSectionKey, suggestionsForSection } from "./review-suggestions";

test("a section with standard feedback is its own picker key", () => {
	for (const { key } of SUGGESTION_SECTIONS) assert.equal(suggestionSectionKey(key), key);
});

test("a dotted section falls back to the part before the dot, like the suggestion list", () => {
	assert.equal(suggestionSectionKey("projects.abc123"), "projects");
	assert.deepEqual(suggestionsForSection("projects.abc123"), suggestionsForSection("projects"));
});

test("a section with no standard feedback has no picker key, so the picker shows nothing chosen", () => {
	assert.equal(suggestionSectionKey("basics-but-not-a-key"), null);
	assert.equal(suggestionSectionKey("xYz123nanoid"), null);
});

test("every picker key has at least one suggestion to show", () => {
	for (const { key } of SUGGESTION_SECTIONS) assert.ok(suggestionsForSection(key).length > 0, key);
});
