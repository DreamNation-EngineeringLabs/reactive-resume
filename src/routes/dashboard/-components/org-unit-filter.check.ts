// Run: pnpm exec tsx --test src/routes/dashboard/-components/org-unit-filter.check.ts
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

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
const { unitFilterOptions } = await import("./org-unit-filter");

const unit = (id: string, name: string, type: string, parentId: string | null) => ({ id, name, type, parentId });
const units = [
	unit("stream", "Engineering", "STREAM", null),
	unit("civil", "Civil Engineering", "DEPARTMENT", "stream"),
	unit("mech", "Mechanical Engineering", "DEPARTMENT", "stream"),
	unit("civil-23", "Civil Engineering 2023", "YEAR", "civil"),
	unit("civil-24", "Civil Engineering 2024", "YEAR", "civil"),
	unit("mech-24", "Mechanical Engineering 2024", "YEAR", "mech"),
	unit("civil-24-a", "Civil A 2024", "CLASS", "civil-24"),
	unit("mech-24-a", "Mech A 2024", "CLASS", "mech-24"),
];

test("batches: every admission year, newest first, until a branch is chosen", () => {
	assert.deepEqual(unitFilterOptions(units).batches, ["2024", "2023"]);
});

test("batches: only the years the chosen branch has, so a pick always selects something", () => {
	assert.deepEqual(unitFilterOptions(units, "civil").batches, ["2024", "2023"]);
	assert.deepEqual(unitFilterOptions(units, "mech").batches, ["2024"]);
	assert.deepEqual(unitFilterOptions(units, "mech-24-a").batches, ["2024"]);
});

test("selection: branch, batch and section are read back from the unit id", () => {
	const f = unitFilterOptions(units, "civil-24-a");
	assert.deepEqual([f.branch, f.batch, f.section], ["civil", "2024", "civil-24-a"]);
	assert.deepEqual(
		unitFilterOptions(units, "civil-24,mech-24").sections.map((s) => s.id),
		["civil-24-a", "mech-24-a"],
	);
});
