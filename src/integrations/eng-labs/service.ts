import { getEngLabsPool } from "./client";
import type { EngLabsLearnerProfile, FacultyInfo, OrgUnitRow, PlacementPackage, Section, StudentInfo } from "./types";

/**
 * Get students enrolled in a specific section (organisation unit).
 * Includes learners from `user_mappings` and from `users.enrollment_unit_id` when no mapping row exists.
 * Tenant is enforced via `organisation_units.tenant_id` (not `user_mappings.tenant_id`), which avoids empty
 * results when mappings omit or mismatch tenant.
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
		`SELECT DISTINCT q.id, q.name, q.email, q.roll_number, q.unit_id
		 FROM (
			 SELECT u.id, u.name, u.email, u.roll_number, um.unit_id
			 FROM user_mappings um
			 JOIN users u ON um.user_id = u.id
			 JOIN organisation_units ou ON um.unit_id = ou.id
			 WHERE um.unit_id = $1
			   AND u.type = 'LEARNER'
			   AND ou.tenant_id = $2
			 UNION
			 SELECT u.id, u.name, u.email, u.roll_number, u.enrollment_unit_id AS unit_id
			 FROM users u
			 JOIN organisation_units ou ON u.enrollment_unit_id = ou.id
			 WHERE u.enrollment_unit_id = $1
			   AND u.type = 'LEARNER'
			   AND ou.tenant_id = $2
		 ) q
		 ORDER BY q.roll_number, q.name`,
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
 * Same enrollment rules as {@link getStudentsBySection}: mappings + `enrollment_unit_id`, scoped by org unit tenant.
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
		`SELECT DISTINCT q.id, q.name, q.email, q.roll_number, q.unit_id, q.section_name, q.section_code
		 FROM (
			 SELECT u.id, u.name, u.email, u.roll_number, um.unit_id,
			        ou.name AS section_name, ou.code AS section_code
			 FROM user_mappings um
			 JOIN users u ON um.user_id = u.id
			 JOIN organisation_units ou ON um.unit_id = ou.id
			 WHERE um.unit_id = ANY($1)
			   AND u.type = 'LEARNER'
			   AND ou.tenant_id = $2
			 UNION
			 SELECT u.id, u.name, u.email, u.roll_number, u.enrollment_unit_id AS unit_id,
			        ou.name AS section_name, ou.code AS section_code
			 FROM users u
			 JOIN organisation_units ou ON u.enrollment_unit_id = ou.id
			 WHERE u.enrollment_unit_id = ANY($1)
			   AND u.type = 'LEARNER'
			   AND ou.tenant_id = $2
		 ) q
		 ORDER BY q.section_name, q.roll_number, q.name`,
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
 * All org unit IDs in the subtree under any of `rootIds` (including each root), for one tenant.
 * Instructor assignments often reference a parent (batch/stream) while `user_mappings` rows point at
 * descendant class units — expanding roots before {@link getStudentsBySections} fixes zero-student counts.
 */
export async function getDescendantOrgUnitIds(rootIds: string[], tenantId: string): Promise<string[]> {
	const pool = getEngLabsPool();
	if (!pool || rootIds.length === 0 || !tenantId || tenantId === "default") return rootIds;

	const { rows } = await pool.query<{ id: string }>(
		`WITH RECURSIVE subtree AS (
			SELECT id FROM organisation_units
			WHERE id = ANY($1) AND tenant_id = $2
			UNION
			SELECT ou.id
			FROM organisation_units ou
			INNER JOIN subtree st ON ou.parent_unit_id = st.id
			WHERE ou.tenant_id = $2
		)
		SELECT id FROM subtree`,
		[rootIds, tenantId],
	);

	const ids = rows.map((r) => r.id);
	return ids.length > 0 ? ids : rootIds;
}

/**
 * Tenant id from organisation_units for the given unit ids (faculty SSO often omits tenant in cookies).
 */
export async function getTenantIdForOrgUnits(unitIds: string[]): Promise<string | null> {
	const pool = getEngLabsPool();
	if (!pool || unitIds.length === 0) return null;

	const { rows } = await pool.query<{ tenant_id: string }>(
		`SELECT DISTINCT tenant_id::text AS tenant_id
		 FROM organisation_units
		 WHERE id = ANY($1)
		 LIMIT 1`,
		[unitIds],
	);

	return rows[0]?.tenant_id ?? null;
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

const sectionRowSelect = `ou.id, ou.name, ou.code, ou.type, ou.parent_unit_id,
		        parent.id   AS package_id,
		        parent.name AS package_name,
		        parent.code AS package_code`;

function mapSectionRows(
	rows: Array<{
		id: string;
		name: string;
		code: string | null;
		type: string;
		parent_unit_id: string | null;
		package_id: string | null;
		package_name: string | null;
		package_code: string | null;
	}>,
): Section[] {
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
 * Sections with learners, limited to org units under `placement_instructor_unit_assignments`
 * (package-linked roots + descendants). Falls back to "any org that owns a placement package"
 * when there are no assignment rows yet.
 */
export async function getPlacementScopedSections(tenantId: string): Promise<Section[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	const { rows: assignedRows } = await pool.query<{
		id: string;
		name: string;
		code: string | null;
		type: string;
		parent_unit_id: string | null;
		package_id: string | null;
		package_name: string | null;
		package_code: string | null;
	}>(
		`WITH RECURSIVE subtree AS (
			SELECT DISTINCT piua.unit_id AS id
			FROM placement_instructor_unit_assignments piua
			INNER JOIN placement_packages pp ON pp.id = piua.package_id AND pp.tenant_id = $1
			UNION
			SELECT ou.id
			FROM organisation_units ou
			INNER JOIN subtree st ON ou.parent_unit_id = st.id
			WHERE ou.tenant_id = $1
		)
		SELECT ${sectionRowSelect}
		 FROM organisation_units ou
		 LEFT JOIN organisation_units parent ON ou.parent_unit_id = parent.id
		 WHERE ou.tenant_id = $1
		   AND ou.id IN (SELECT id FROM subtree)
		   AND EXISTS (
		       SELECT 1 FROM user_mappings um
		       JOIN users lrn ON lrn.id = um.user_id AND lrn.type = 'LEARNER'
		       WHERE um.unit_id = ou.id
		   )
		 ORDER BY parent.name NULLS LAST, ou.name`,
		[tenantId],
	);

	if (assignedRows.length > 0) {
		return mapSectionRows(assignedRows);
	}

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
		`SELECT ${sectionRowSelect}
		 FROM organisation_units ou
		 LEFT JOIN organisation_units parent ON ou.parent_unit_id = parent.id
		 WHERE ou.tenant_id = $1
		   AND ou.organisation_id IN (
		       SELECT DISTINCT organisation_id FROM placement_packages WHERE tenant_id = $1
		   )
		   AND EXISTS (
		       SELECT 1 FROM user_mappings um
		       JOIN users lrn ON lrn.id = um.user_id AND lrn.type = 'LEARNER'
		       WHERE um.unit_id = ou.id
		   )
		 ORDER BY parent.name NULLS LAST, ou.name`,
		[tenantId],
	);

	return mapSectionRows(rows);
}

/**
 * All organisation unit IDs in the placement subtree for a tenant (PIUA roots + descendants,
 * or fallback: all units under orgs that own a placement package).
 */
export async function getPlacementSubtreeOrgUnitIds(tenantId: string): Promise<string[]> {
	const pool = getEngLabsPool();
	if (!pool) return [];

	const { rows: assignedRows } = await pool.query<{ id: string }>(
		`WITH RECURSIVE subtree AS (
			SELECT DISTINCT piua.unit_id AS id
			FROM placement_instructor_unit_assignments piua
			INNER JOIN placement_packages pp ON pp.id = piua.package_id AND pp.tenant_id = $1
			UNION
			SELECT ou.id
			FROM organisation_units ou
			INNER JOIN subtree st ON ou.parent_unit_id = st.id
			WHERE ou.tenant_id = $1
		)
		SELECT id FROM subtree`,
		[tenantId],
	);

	if (assignedRows.length > 0) {
		return [...new Set(assignedRows.map((r) => r.id))];
	}

	const { rows } = await pool.query<{ id: string }>(
		`SELECT ou.id
		 FROM organisation_units ou
		 WHERE ou.tenant_id = $1
		   AND ou.organisation_id IN (
		       SELECT DISTINCT organisation_id FROM placement_packages WHERE tenant_id = $1
		   )`,
		[tenantId],
	);

	return [...new Set(rows.map((r) => r.id))];
}

/**
 * For resume-app emails: full eng-labs learner profile including every org unit (enrollment +
 * user_mappings), scoped to tenant. Used to cohort from resume DB first, then filter by placement /
 * instructor subtree / department filters without missing department-only or class-only links.
 */
export async function getEngLabsLearnerProfilesByEmails(
	normalizedEmails: string[],
	tenantId: string,
): Promise<EngLabsLearnerProfile[]> {
	const pool = getEngLabsPool();
	if (!pool || normalizedEmails.length === 0 || !tenantId || tenantId === "default") return [];

	const unique = [...new Set(normalizedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
	if (unique.length === 0) return [];

	const { rows } = await pool.query<{
		id: string;
		name: string;
		email: string;
		roll_number: string | null;
		enrollment_unit_id: string | null;
		unit_ids: string[] | null;
	}>(
		`SELECT u.id,
		        u.name,
		        u.email,
		        u.roll_number,
		        u.enrollment_unit_id,
		        COALESCE((
		          SELECT array_agg(DISTINCT q.unit_id)
		          FROM (
		            SELECT u.enrollment_unit_id::text AS unit_id
		            WHERE u.enrollment_unit_id IS NOT NULL
		            UNION
		            SELECT um.unit_id::text AS unit_id
		            FROM user_mappings um
		            INNER JOIN organisation_units ou ON ou.id = um.unit_id AND ou.tenant_id = $2
		            WHERE um.user_id = u.id
		          ) q
		        ), ARRAY[]::text[]) AS unit_ids
		 FROM users u
		 WHERE u.type = 'LEARNER'
		   AND u.tenant_id = $2
		   AND LOWER(TRIM(u.email)) = ANY($1::text[])`,
		[unique, tenantId],
	);

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		email: r.email,
		rollNumber: r.roll_number,
		enrollmentUnitId: r.enrollment_unit_id,
		unitIds: r.unit_ids ?? [],
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
export async function getEngLabsUserByEmail(
	email: string,
): Promise<(StudentInfo & { tenantId?: string; userType?: string }) | null> {
	const pool = getEngLabsPool();
	if (!pool) return null;

	const { rows } = await pool.query<{
		id: string;
		name: string;
		email: string;
		roll_number: string | null;
		enrollment_unit_id: string | null;
		tenant_id: string | null;
		user_type: string | null;
	}>(
		`SELECT u.id, u.name, u.email, u.roll_number, u.enrollment_unit_id, u.tenant_id,
		        UPPER(u.type::text) AS user_type
		 FROM users u
		 WHERE LOWER(TRIM(u.email)) = LOWER(TRIM($1))
		 ORDER BY CASE UPPER(u.type::text)
		   WHEN 'INSTRUCTOR' THEN 0
		   WHEN 'FACULTY' THEN 0
		   WHEN 'PLACEMENT_OFFICER' THEN 0
		   WHEN 'ADMIN' THEN 0
		   ELSE 1
		 END,
		 u.id
		 LIMIT 1`,
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
		userType: r.user_type ?? undefined,
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
 * Students this faculty member personally mentors, via `package_enrollments.mentor_id`.
 *
 * Complements {@link getInstructorSections}, which only knows about
 * `placement_instructor_unit_assignments`. A unit assignment covers a whole section, but a section
 * is commonly split between two faculty by roll range — there is no org unit for "half of CSE-A", so
 * that split can only be expressed per student. Faculty scoped this way have NO unit assignment at
 * all, so without this query they resolve to zero sections and every dashboard tab renders empty.
 *
 * Kept deliberately to a single query with no hierarchy logic. eng-labs owns the real rule
 * (`FacultyScopeService.facultyStudentIds` = unit-assigned students UNION mentees, with subtree
 * expansion and package narrowing); duplicating that here is what would drift. The caller composes
 * the union from this plus {@link getInstructorSections}.
 *
 * Returns the same shape as {@link getStudentsBySections} so callers can treat both alike, including
 * `sectionId`, which lets a mentor-only faculty's section cards be derived from where their mentees
 * actually sit.
 */
export async function getMenteeStudents(userId: string, tenantId: string): Promise<StudentInfo[]> {
	const pool = getEngLabsPool();
	if (!pool || !userId || !tenantId) return [];

	const { rows } = await pool.query<{
		id: string;
		name: string;
		email: string;
		roll_number: string | null;
		unit_id: string | null;
		section_name: string | null;
		section_code: string | null;
	}>(
		// Enrolments carry no tenant of their own — scope through the package, matching
		// FacultyScopeService. The CLASS join is LEFT so a mentee with no class mapping is still
		// returned (and simply contributes no section card) rather than silently dropped.
		// DISTINCT is wrapped in a subquery so the ORDER BY can reference the aliases — Postgres and
		// CockroachDB both reject `SELECT DISTINCT ... ORDER BY ou.name` because the ordering
		// expression is not in the select list. Same pattern as getStudentsBySections above.
		`SELECT * FROM (
			 SELECT DISTINCT u.id, u.name, u.email, u.roll_number,
			        ou.id   AS unit_id,
			        ou.name AS section_name,
			        ou.code AS section_code
			 FROM package_enrollments e
			 JOIN placement_packages p ON p.id = e.package_id
			 JOIN users u ON u.id = e.user_id
			 LEFT JOIN user_mappings um ON um.user_id = u.id
			 LEFT JOIN organisation_units ou
			        ON ou.id = um.unit_id AND ou.type = 'CLASS' AND ou.tenant_id = $2
			 WHERE e.mentor_id = $1
			   AND p.tenant_id = $2
			   AND u.type = 'LEARNER'
		 ) q
		 ORDER BY q.section_name NULLS LAST, q.roll_number, q.name`,
		[userId, tenantId],
	);

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		email: r.email,
		rollNumber: r.roll_number,
		sectionId: r.unit_id ?? "",
		sectionName: r.section_name ?? undefined,
		sectionCode: r.section_code ?? undefined,
	}));
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
		 FROM placement_instructor_unit_assignments piua
		 JOIN organisation_units ou ON piua.unit_id = ou.id
		 LEFT JOIN placement_packages p ON piua.package_id = p.id
		 LEFT JOIN organisation_units parent ON ou.parent_unit_id = parent.id
		 WHERE piua.user_id = $1
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
		`SELECT DISTINCT pp.id, pp.name, pp.organisation_id
		 FROM placement_instructor_unit_assignments piua
		 JOIN placement_packages pp ON pp.id = piua.package_id
		 WHERE piua.user_id = $1 AND piua.package_id IS NOT NULL
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
		`SELECT DISTINCT piua.user_id
         FROM placement_instructor_unit_assignments piua
         WHERE piua.unit_id = ANY($1)`,
		[unitIds],
	);

	return rows.map((r) => r.user_id);
}

/**
 * Returns the subset of input emails whose owners have at least one active
 * `user_quota_grants` row for `RESUME_CREATE` in eng-labs. Active = expiry_date IS NULL OR > NOW().
 * Returns null when eng-labs is not configured — callers should treat that as "no filter applied".
 */
export async function filterEmailsWithResumeBuilderAccess(emails: string[]): Promise<Set<string> | null> {
	const pool = getEngLabsPool();
	if (!pool) return null;
	if (emails.length === 0) return new Set();

	const normalized = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter((e) => e.length > 0))];
	if (normalized.length === 0) return new Set();

	const { rows } = await pool.query<{ email: string }>(
		`SELECT DISTINCT LOWER(TRIM(u.email)) AS email
		 FROM users u
		 JOIN user_quota_grants g ON g.user_id = u.id
		 WHERE LOWER(TRIM(u.email)) = ANY($1)
		   AND g.service_type = 'RESUME_CREATE'
		   AND (g.expiry_date IS NULL OR g.expiry_date > NOW())`,
		[normalized],
	);
	return new Set(rows.map((r) => r.email));
}
