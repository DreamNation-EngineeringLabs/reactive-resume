// Run: pnpm exec tsx --test src/schema/resume/comment-anchor.check.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	anchorText,
	applySuggestion,
	changedAnchors,
	commentAnchorSchema,
	commentHighlight,
	commentSeveritySchema,
	findQuote,
	reviewSummaryEmail,
} from "./comment-anchor";
import { sampleResumeData } from "./sample";

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

test("suggestion: replaces the quote in the one field that holds it, HTML-escaped in rich text", () => {
	const item = { id: "x", company: "Acme", description: "<ul><li><p>Cut costs by 40% &amp; time</p></li></ul>" };
	assert.deepEqual(applySuggestion(item, "Cut costs by 40% & time", "Cut AWS costs by 40% (₹12L/yr) & <time>"), {
		path: ["description"],
		value: "<ul><li><p>Cut AWS costs by 40% (₹12L/yr) &amp; &lt;time&gt;</p></li></ul>",
	});
	assert.deepEqual(applySuggestion({ basics: { headline: "CSE Student" } }, "CSE Student", "SDE Intern"), {
		path: ["basics", "headline"],
		value: "SDE Intern",
	});
});

test("suggestion: ambiguous or formatted text is not auto-applied", () => {
	assert.equal(applySuggestion({ a: "Led team", b: "Led team" }, "Led team", "x"), null);
	assert.equal(applySuggestion({ a: "Led team. Led team." }, "Led team", "x"), null);
	assert.equal(applySuggestion({ a: "<p>Led <strong>team</strong></p>" }, "Led team", "x"), null);
});

test("changes since review: edited and new entries, header fields and summary", () => {
	const before = structuredClone(sampleResumeData);
	const after = structuredClone(sampleResumeData);
	assert.deepEqual(changedAnchors(before, after), []);

	after.basics.headline = "SDE Intern";
	after.summary.content = "<p>New</p>";
	after.sections.experience.items[0].position = "Lead";
	after.sections.skills.items.push({ ...after.sections.skills.items[0], id: "new-skill" });
	assert.deepEqual(changedAnchors(before, after), [
		{ section: "basics", field: "basics-headline" },
		{ section: "summary" },
		{ section: "experience", itemId: after.sections.experience.items[0].id },
		{ section: "skills", itemId: "new-skill" },
	]);
});

test("review email: one message, open items with where and a deep link", () => {
	const mail = reviewSummaryEmail({
		studentName: "Meera",
		reviewerName: "Prof. Menon",
		resumeName: "Placement Resume",
		approved: false,
		builderUrl: "http://app/resume/builder/r1",
		comments: [
			{
				id: "c1",
				severity: "HIGH",
				content: "Quantify it.",
				anchor: { section: "x", quote: { exact: "by 40%", prefix: "", suffix: "" } },
			},
			{ id: "c2", severity: null, content: "Nice overall.", anchor: null },
		],
	});
	assert.equal(mail.subject, "Feedback on your resume: Placement Resume");
	assert.match(mail.text, /1\. \[High\] On "by 40%": Quantify it\.\n {3}http:\/\/app\/resume\/builder\/r1\?comment=c1/);
	assert.match(mail.text, /2\. Nice overall\.\n/);
});

test("anchor schema: section-only anchors are valid, empty quotes are not", () => {
	assert.ok(commentAnchorSchema.safeParse({ section: "skills" }).success);
	assert.ok(
		!commentAnchorSchema.safeParse({ section: "skills", quote: { exact: "", prefix: "", suffix: "" } }).success,
	);
});

test("severity: optional low / medium / high, each with its own highlighter colour", () => {
	assert.deepEqual(commentSeveritySchema.options, ["HIGH", "MEDIUM", "LOW"]);
	assert.equal(commentHighlight({ severity: "HIGH", status: "OPEN" }, false), "review-comment-high");
	assert.equal(commentHighlight({ severity: "MEDIUM", status: "OPEN" }, false), "review-comment-medium");
	assert.equal(commentHighlight({ severity: "LOW", status: "OPEN" }, false), "review-comment-low");
	assert.equal(commentHighlight({ severity: null, status: "OPEN" }, false), "review-comment-medium");
});

test("highlights: addressed or resolved feedback is no longer painted, unless it is the selected comment", () => {
	assert.equal(commentHighlight({ severity: "HIGH", status: "ADDRESSED" }, false), null);
	assert.equal(commentHighlight({ severity: "HIGH", status: "RESOLVED" }, false), null);
	assert.equal(commentHighlight({ severity: "HIGH", status: "ADDRESSED" }, true), "review-comment-high");
	// The selection being commented on has no status yet.
	assert.equal(commentHighlight({}, true), "review-comment-medium");
});

test("before / after: the text an anchor points at, as plain text", () => {
	const data = structuredClone(sampleResumeData);
	const job = data.sections.experience.items[0];
	job.description = "<ul><li><p>Cut costs by 40% &amp; time</p></li></ul>";
	assert.equal(
		anchorText(data, { section: "experience", itemId: job.id, field: "experience-item-description" }),
		"Cut costs by 40% & time",
	);
	job.description = "<ul><li><p>Led a team</p></li><li><p>Shipped v2</p></li></ul>";
	assert.equal(
		anchorText(data, { section: "experience", itemId: job.id, field: "experience-item-description" }),
		"Led a team Shipped v2",
		"bullets stay separate words",
	);
	data.basics.headline = "SDE Intern";
	assert.equal(anchorText(data, { section: "basics", field: "basics-headline" }), "SDE Intern");
	data.summary.content = "<p>Gameplay <strong>programmer</strong>.</p>";
	assert.equal(anchorText(data, { section: "summary" }), "Gameplay programmer.");
	assert.match(anchorText(data, { section: "experience", itemId: job.id }) ?? "", new RegExp(job.company));
	job.hidden = true;
	assert.equal(
		anchorText(data, { section: "experience", itemId: job.id }),
		null,
		"hidden entries are gone from the resume",
	);
	assert.equal(anchorText(data, { section: "experience", itemId: "deleted" }), null);
});
