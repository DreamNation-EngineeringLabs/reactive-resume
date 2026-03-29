/**
 * An org unit used for per-section stats (leaf CLASS units with enrolled learners).
 * packageId/packageName here are the *placement_packages* fields, not parent org units.
 */
export interface Section {
	id: string;
	name: string;
	code: string | null;
	type: string;
	parentUnitId: string | null;
	packageId: string | null;
	packageName: string | null;
	packageCode: string | null;
}

/** A placement package from the placement_packages table. */
export interface PlacementPackage {
	id: string;
	name: string;
	organisationId: string;
}

/** An org unit row for the filter picker (any type: ROOT/STREAM/DEPARTMENT/CLASS). */
export interface OrgUnitRow {
	id: string;
	name: string;
	type: string;
	parentId: string | null;
}

export interface StudentInfo {
	id: string;
	name: string;
	email: string;
	rollNumber: string | null;
	sectionId: string;
	sectionName?: string;
	sectionCode?: string;
}

export interface FacultyInfo {
	id: string;
	name: string;
	email: string;
}
