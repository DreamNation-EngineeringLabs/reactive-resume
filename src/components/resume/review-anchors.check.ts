// Run: pnpm exec tsx --test src/components/resume/review-anchors.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { sampleResumeData } from "@/schema/resume/sample";

// tsx does not run the lingui macro; give `t` a plain template-tag stand-in before the module loads.
registerHooks({
	resolve(specifier, context, next) {
		if (specifier !== "@lingui/core/macro") return next(specifier, context);
		return {
			url: "data:text/javascript,export const t=(s,...v)=>String.raw({raw:s},...v)",
			shortCircuit: true,
		};
	},
});
const { anchorLabel } = await import("./review-anchors");

const data = structuredClone(sampleResumeData);
const custom = data.customSections[0];

test("label: built-in section with item name, summary, basics field", () => {
	const job = data.sections.experience.items[0];
	assert.equal(anchorLabel({ section: "experience", itemId: job.id }, data), `Experience › ${job.company}`);
	assert.equal(anchorLabel({ section: "basics", field: "basics-headline" }, data), "Basics › Headline");
});

test("label: custom section by its title, else by its type", () => {
	assert.equal(anchorLabel({ section: custom.id }, data), custom.title);
	const untitled = { ...data, customSections: [{ ...custom, title: "" }] };
	assert.equal(anchorLabel({ section: custom.id }, untitled), "Experience");
});

test("label: a section that no longer exists gets a generic label instead of throwing", () => {
	assert.equal(anchorLabel({ section: "deleted-section-id" }, data), "Section");
	assert.equal(anchorLabel({ section: "toString" }, data), "Section");
});
