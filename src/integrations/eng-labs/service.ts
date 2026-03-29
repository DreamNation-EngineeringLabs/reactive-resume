import { getEngLabsPool } from "./client";
import type { FacultyInfo, OrgUnitRow, PlacementPackage, Section, StudentInfo } from "./types";

/**
 * Get students enrolled in a specific section (organisation unit).
 * Uses user_mappings as the authoritative enrollment source.
 */
export async function getStudentsBySection(sectionId: string, tenantId: string): Promise<StudentInfo[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	const { rows } = await pool.query<{
		id: string;
		name: string;
		email: string;
		roll_number: string | null;
		unit_id: string;
	}>(
		`SELECT u.id, u.name, u.email, u.roll_number, um.unit_id
		 FROM user_mappings um
		 JOIN users u ON um.user_id = u.id
		 JOIN package_enrollments pe ON pe.user_id = u.id
		 WHERE um.unit_id = $1 
		   AND u.type = 'LEARNER' 
		   AND um.tenant_id = $2
		 GROUP BY u.id, u.name, u.email, u.roll_number, um.unit_id
		 ORDER BY u.roll_number, u.name`,
		[sectionId, tenantId],
	);

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		email: r.email,
		rollNumber: r.roll_number,
		sectionId: r.unit_id,
	}));
}

/**
 * Get students across multiple sections, with section name/code enriched.
 * Uses user_mappings as the authoritative enrollment source.
 */
export async function getStudentsBySections(sectionIds: string[], tenantId: string): Promise<StudentInfo[]> {
	const pool = getEngLabsPool();
	if (!pool || sectionIds.length === 0) return [];

	const { rows } = await pool.query<{
		id: string;
		name: string;
		email: string;
		roll_number: string | null;
		unit_id: string;
		section_name: string;
		section_code: string | null;
	}>(
		`SELECT u.id, u.name, u.email, u.roll_number, um.unit_id,
		        ou.name AS section_name, ou.code AS section_code
		 FROM user_mappings um
		 JOIN users u ON um.user_id = u.id
		 JOIN organisation_units ou ON um.unit_id = ou.id
		 JOIN package_enrollments pe ON pe.user_id = u.id
		 WHERE um.unit_id = ANY($1) 
		   AND u.type = 'LEARNER' 
		   AND um.tenant_id = $2
		 GROUP BY u.id, u.name, u.email, u.roll_number, um.unit_id, ou.name, ou.code
		 ORDER BY ou.name, u.roll_number, u.name`,
		[sectionIds, tenantId],
	);

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		email: r.email,
		rollNumber: r.roll_number,
		sectionId: r.unit_id,
		sectionName: r.section_name,
		sectionCode: r.section_code ?? undefined,
	}));
}

/**
 * Get all organisation units for a tenant, grouped by placement_packages.
 * Used by PO/Admin scope — same package grouping as the instructor view.
 */
export async function getAllSections(tenantId: string): Promise<Section[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	const { rows } = await pool.query<{
		id: string;
		name: string;
		code: string | null;
		type: string;
		parent_unit_id: string | null;
		package_id: string | null;
		package_name: string | null;
		package_code: string | null;
	}>(
		`SELECT ou.id, ou.name, ou.code, ou.type, ou.parent_unit_id,
		        parent.id   AS package_id,
		        parent.name AS package_name,
		        parent.code AS package_code
		 FROM organisation_units ou
		 LEFT JOIN organisation_units parent ON ou.parent_unit_id = parent.id
		 WHERE ou.tenant_id = $1
		   AND EXISTS (
		       SELECT 1 FROM user_mappings um
		       JOIN users lrn ON lrn.id = um.user_id AND lrn.type = 'LEARNER'
		       WHERE um.unit_id = ou.id
		   )
		 ORDER BY parent.name NULLS LAST, ou.name`,
		[tenantId],
	);

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		code: r.code,
		type: r.type,
		parentUnitId: r.parent_unit_id,
		packageId: r.package_id,
		packageName: r.package_name,
		packageCode: r.package_code,
	}));
}

/**
 * Get section details by specific IDs (for faculty's assigned sections from JWT),
 * including parent (package) info for grouping.
 */
export async function getSectionsByIds(sectionIds: string[]): Promise<Section[]> {
	const pool = getEngLabsPool();
	if (!pool || sectionIds.length === 0) return [];

	const { rows } = await pool.query<{
		id: string;
		name: string;
		code: string | null;
		type: string;
		parent_unit_id: string | null;
		package_id: string | null;
		package_name: string | null;
		package_code: string | null;
	}>(
		`SELECT s.id, s.name, s.code, s.type, s.parent_unit_id,
		        p.id   AS package_id,
		        p.name AS package_name,
		        p.code AS package_code
		 FROM organisation_units s
		 LEFT JOIN organisation_units p ON s.parent_unit_id = p.id
		 WHERE s.id = ANY($1)
		 ORDER BY p.name NULLS LAST, s.name`,
		[sectionIds],
	);

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		code: r.code,
		type: r.type,
		parentUnitId: r.parent_unit_id,
		packageId: r.package_id,
		packageName: r.package_name,
		packageCode: r.package_code,
	}));
}

/**
 * Batch-enrich eng-labs user info by emails.
 */
export async function enrichByEmails(emails: string[]): Promise<Map<string, StudentInfo>> {
	const pool = getEngLabsPool();
	const map = new Map<string, StudentInfo>();
	if (!pool || emails.length === 0) return map;

	const { rows } = await pool.query<{
		id: string;
		name: string;
		email: string;
		roll_number: string | null;
		enrollment_unit_id: string | null;
	}>(
		`SELECT id, name, email, roll_number, enrollment_unit_id
		 FROM users
		 WHERE email = ANY($1)`,
		[emails],
	);

	for (const r of rows) {
		map.set(r.email, {
			id: r.id,
			name: r.name,
			email: r.email,
			rollNumber: r.roll_number,
			sectionId: r.enrollment_unit_id ?? "",
		});
	}

	return map;
}

/**
 * Get student info by their eng-labs ID.
 */
export async function getStudentById(id: string): Promise<StudentInfo | null> {
	const pool = getEngLabsPool();
	if (!pool) return null;

	const { rows } = await pool.query<{
		id: string;
		name: string;
		email: string;
		roll_number: string | null;
		enrollment_unit_id: string | null;
	}>(
		`SELECT id, name, email, roll_number, enrollment_unit_id
		 FROM users
		 WHERE id = $1`,
		[id],
	);

	if (rows.length === 0) return null;

	const r = rows[0];
	return {
		id: r.id,
		name: r.name,
		email: r.email,
		rollNumber: r.roll_number,
		sectionId: r.enrollment_unit_id ?? "",
	};
}

/**
 * Get all faculty for a tenant (for admin dashboard).
 */
export async function getFacultyList(tenantId: string): Promise<FacultyInfo[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	const { rows } = await pool.query<{
		id: string;
		name: string;
		email: string;
	}>(
		`SELECT id, name, email
		 FROM users
		 WHERE type = 'FACULTY' AND tenant_id = $1
		 ORDER BY name`,
		[tenantId],
	);

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		email: r.email,
	}));
}

/**
 * Get an eng-labs user by their email address.
 */
export async function getEngLabsUserByEmail(email: string): Promise<(StudentInfo & { tenantId?: string }) | null> {
	const pool = getEngLabsPool();
	if (!pool) return null;

	const { rows } = await pool.query<{
		id: string;
		name: string;
		email: string;
		roll_number: string | null;
		enrollment_unit_id: string | null;
		tenant_id: string | null;
	}>(
		`SELECT id, name, email, roll_number, enrollment_unit_id, tenant_id
		 FROM users
		 WHERE email = $1`,
		[email],
	);

	if (rows.length === 0) return null;

	const r = rows[0];
	return {
		id: r.id,
		name: r.name,
		email: r.email,
		rollNumber: r.roll_number,
		sectionId: r.enrollment_unit_id ?? "",
		tenantId: r.tenant_id ?? undefined,
	};
}

/**
 * Get a student's enrollment context: their enrolled org unit + its parent (package-level) unit.
 */
export async function getStudentEnrollmentInfo(engLabsUserId: string): Promise<{
	unitId: string;
	unitName: string;
	unitType: string;
	parentId: string | null;
	parentName: string | null;
	parentType: string | null;
} | null> {
	const pool = getEngLabsPool();
	if (!pool) return null;

	const { rows } = await pool.query<{
		unit_id: string;
		unit_name: string;
		unit_type: string;
		parent_id: string | null;
		parent_name: string | null;
		parent_type: string | null;
	}>(
		`SELECT ou.id AS unit_id, ou.name AS unit_name, ou.type AS unit_type,
		        p.id   AS parent_id,  p.name AS parent_name, p.type AS parent_type
		 FROM users u
		 JOIN organisation_units ou ON u.enrollment_unit_id = ou.id
		 LEFT JOIN organisation_units p ON ou.parent_unit_id = p.id
		 WHERE u.id = $1
		 LIMIT 1`,
		[engLabsUserId],
	);

	if (rows.length === 0) return null;
	const r = rows[0];
	return {
		unitId: r.unit_id,
		unitName: r.unit_name,
		unitType: r.unit_type,
		parentId: r.parent_id,
		parentName: r.parent_name,
		parentType: r.parent_type,
	};
}

/**
 * Get all sections assigned to an instructor (Professor/PO) via the placement_instructor tables.
 */
export async function getInstructorSections(userId: string): Promise<Section[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	// First try: sections explicitly assigned via placement_instructor_unit_assignments
	const { rows } = await pool.query<{
		id: string;
		name: string;
		code: string | null;
		type: string;
		parent_unit_id: string | null;
		package_id: string | null;
		package_name: string | null;
		package_code: string | null;
	}>(
		`SELECT ou.id, ou.name, ou.code, ou.type, ou.parent_unit_id,
		        p.id   AS package_id,
		        p.name AS package_name,
		        parent.code AS package_code
		 FROM placement_instructor_assignments pia
		 JOIN placement_instructor_unit_assignments piua ON pia.id = piua.assignment_id
		 JOIN organisation_units ou ON piua.unit_id = ou.id
		 LEFT JOIN placement_packages p ON pia.package_id = p.id
		 LEFT JOIN organisation_units parent ON ou.parent_unit_id = parent.id
		 WHERE pia.user_id = $1
		 ORDER BY p.name NULLS LAST, ou.name`,
		[userId],
	);

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		code: r.code,
		type: r.type,
		parentUnitId: r.parent_unit_id,
		packageId: r.package_id,
		packageName: r.package_name,
		packageCode: r.package_code,
	}));
}

// ─────────────────────────────────────────────────────────────────────────────
// Placement Packages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get ALL placement packages for a given org (used by PO / Admin).
 */
export async function getPlacementPackages(tenantId: string, organisationId: string): Promise<PlacementPackage[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	const { rows } = await pool.query<{ id: string; name: string; organisation_id: string }>(
		`SELECT id, name, organisation_id
		 FROM placement_packages
		 WHERE tenant_id = $1 AND organisation_id = $2
		 ORDER BY name`,
		[tenantId, organisationId],
	);

	return rows.map((r) => ({ id: r.id, name: r.name, organisationId: r.organisation_id }));
}

/**
 * Get only the packages an instructor is assigned to (used by INSTRUCTOR role).
 */
export async function getInstructorPackages(userId: string): Promise<PlacementPackage[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	const { rows } = await pool.query<{ id: string; name: string; organisation_id: string }>(
		`SELECT pp.id, pp.name, pp.organisation_id
		 FROM placement_instructor_assignments pia
		 JOIN placement_packages pp ON pp.id = pia.package_id
		 WHERE pia.user_id = $1
		 ORDER BY pp.name`,
		[userId],
	);

	return rows.map((r) => ({ id: r.id, name: r.name, organisationId: r.organisation_id }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit Schema Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get distinct unit types from unit_schemas for the org (e.g. STREAM, DEPARTMENT, CLASS).
 */
export async function getUnitSchemaTypes(tenantId: string, organisationId: string): Promise<string[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	const { rows } = await pool.query<{ type: string }>(
		`SELECT type FROM unit_schemas
		 WHERE tenant_id = $1 AND organisation_id = $2
		 ORDER BY type`,
		[tenantId, organisationId],
	);

	return rows.map((r) => r.type);
}

// ─────────────────────────────────────────────────────────────────────────────
// All Org Units (for filter picker)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all org units for the filter picker, ordered by type and name.
 * The frontend uses this to populate unit chips when a unit type is selected.
 */
export async function getAllOrgUnits(tenantId: string, organisationId: string): Promise<OrgUnitRow[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	const { rows } = await pool.query<{ id: string; name: string; type: string; parent_unit_id: string | null }>(
		`SELECT id, name, type, parent_unit_id
		 FROM organisation_units
		 WHERE tenant_id = $1 AND organisation_id = $2
		 ORDER BY type, name`,
		[tenantId, organisationId],
	);

	return rows.map((r) => ({ id: r.id, name: r.name, type: r.type, parentId: r.parent_unit_id }));
}
// ─────────────────────────────────────────────────────────────────────────────
// Unit Hierarchy & Instructor assignments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all ancestor unit IDs for a given unit (including the unit itself).
 */
export async function getUnitAncestors(unitId: string): Promise<string[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	const { rows } = await pool.query<{ id: string }>(
		`WITH RECURSIVE ancestors AS (
            SELECT id, parent_unit_id FROM organisation_units WHERE id = $1
            UNION ALL
            SELECT ou.id, ou.parent_unit_id FROM organisation_units ou
            JOIN ancestors a ON ou.id = a.parent_unit_id
        )
        SELECT id FROM ancestors`,
		[unitId],
	);

	return rows.map((r) => r.id);
}

/**
 * Get all instructor user IDs assigned to a set of units.
 */
export async function getInstructorsForUnits(unitIds: string[]): Promise<string[]> {
	const pool = getEngLabsPool();
	if (!pool || unitIds.length === 0) return [];

	const { rows } = await pool.query<{ user_id: string }>(
		`SELECT DISTINCT pia.user_id
         FROM placement_instructor_assignments pia
         JOIN placement_instructor_unit_assignments piua ON pia.id = piua.assignment_id
         WHERE piua.unit_id = ANY($1)`,
		[unitIds],
	);

	return rows.map((r) => r.user_id);
}
