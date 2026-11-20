/**
 * The Placement Officer's progress groups and the section helpers the screens share. The groups
 * themselves live with the printed report (validation-report.ts) so the screen and the sheet agree.
 */
export { type PoCounts, type PoGroup, poCounts, poGroup } from "./validation-report";

type StudentLike = { sectionId: string; engLabsUnitIds?: string[] };

/**
 * The students who belong to an org unit: linked to it or to any unit below it.
 *
 * The same rule the server uses for a card's "Total Students" (`computeUnitStatsRow`), so a card's
 * PO numbers and the list behind it cover exactly the students that total counts. Matching only a
 * student's first unit made every Department or Year card read 0.
 */
export function unitStudents<T extends StudentLike>(
	students: T[],
	unitId: string,
	orgUnits: { id: string; parentId: string | null }[],
): T[] {
	const children = new Map<string, string[]>();
	for (const unit of orgUnits) {
		if (!unit.parentId) continue;
		const list = children.get(unit.parentId);
		if (list) list.push(unit.id);
		else children.set(unit.parentId, [unit.id]);
	}

	const inUnit = new Set<string>([unitId]);
	const queue = [unitId];
	while (queue.length > 0) {
		const next = queue.pop() as string;
		for (const child of children.get(next) ?? []) {
			if (inUnit.has(child)) continue;
			inUnit.add(child);
			queue.push(child);
		}
	}

	return students.filter((s) => {
		const ids = s.engLabsUnitIds && s.engLabsUnitIds.length > 0 ? s.engLabsUnitIds : [s.sectionId];
		return ids.some((id) => inUnit.has(id));
	});
}

/** Roll-number order, the order of the college's own lists: "21A91A0409" before "21A91A0410". */
export function byRollNumber(a: { rollNumber: string | null }, b: { rollNumber: string | null }): number {
	if (!a.rollNumber) return b.rollNumber ? 1 : 0;
	if (!b.rollNumber) return -1;
	return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: "base" });
}
