// Run: pnpm exec tsx --test src/schema/resume/comment-anchor.check.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { commentAnchorSchema, findQuote } from "./comment-anchor";

const text = "Built tools in C++. Shipped tools in C++ to 3 studios.";

test("finds a unique quote", () => {
	assert.equal(findQuote(text, { exact: "Shipped", prefix: "", suffix: "" }), 20);
});

test("repeated text: surrounding context picks the right occurrence", () => {
	const second = text.indexOf("tools", 10);
	assert.equal(findQuote(text, { exact: "tools", prefix: "Shipped ", suffix: " in C++ to" }), second);
	assert.equal(findQuote(text, { exact: "tools", prefix: "Built ", suffix: " in C++." }), 6);
});

test("repeated text with lost context: closest to the original position wins", () => {
	assert.equal(findQuote(text, { exact: "tools", prefix: "x", suffix: "y" }, 25), text.indexOf("tools", 10));
});

test("edited away: -1 (shown as changed)", () => {
	assert.equal(findQuote(text, { exact: "Unreal Engine", prefix: "", suffix: "" }), -1);
});

test("anchor schema: section-only anchors are valid, empty quotes are not", () => {
	assert.ok(commentAnchorSchema.safeParse({ section: "skills" }).success);
	assert.ok(
		!commentAnchorSchema.safeParse({ section: "skills", quote: { exact: "", prefix: "", suffix: "" } }).success,
	);
});
