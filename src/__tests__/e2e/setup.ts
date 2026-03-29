/**
 * E2E Test Setup
 *
 * Database initialization, test data creation, and cleanup
 */

// @ts-expect-error: Mocking prisma to satisfy IDE while migrating to Drizzle
const prisma: any = {
	organisations: { upsert: async () => ({}) },
	organisation_entities: { create: async () => ({}) },
	organisation_units: { create: async () => ({}) },
	users: { create: async () => ({}) },
	user_mappings: { create: async () => ({}) },
	courses: { create: async () => ({}) },
	resumeNotification: { deleteMany: async () => ({}) },
	resumeUserMapping: { deleteMany: async () => ({}) },
	course_learner_enrollments: { deleteMany: async () => ({}) },
	course_instructor_assignments: { deleteMany: async () => ({}) },
};

// @ts-expect-error
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";

interface TestUser {
	id: string;
	email: string;
	name: string;
	role: "LEARNER" | "INSTRUCTOR" | "ADMIN" | "SUPER_ADMIN" | "COORDINATOR" | "EVALUATOR";
	tenantId: string;
}

interface TestContext {
	student: TestUser & { token: string };
	faculty: TestUser & { token: string };
	po: TestUser & { token: string };
	admin: TestUser & { token: string };
	tenantId: string;
	sectionId: string;
}

let testContext: TestContext | null = null;

/**
 * Generate a JWT token for testing
 */
export function generateToken(user: TestUser): string {
	return jwt.sign(
		{
			userId: user.id,
			orgId: "test-org-001",
			tenantId: user.tenantId,
			role: user.role,
			accessScope: "OWN",
			features: {},
		},
		JWT_SECRET,
		{ expiresIn: "1h" },
	);
}

/**
 * Initialize test database and create test data
 */
export async function setupTestDatabase(): Promise<TestContext> {
	if (testContext) {
		return testContext;
	}

	try {
		// Create test tenant/organisation
		const tenantId = `test-tenant-${Date.now()}`;
		const orgId = "test-org-001";

		// Ensure organisation exists
		await prisma.organisations.upsert({
			where: { id: orgId },
			update: {},
			create: {
				id: orgId,
				name: "Test Organisation",
				subdomain: `test-org-${Date.now()}`,
			},
		});

		// Create organisation entity (tenant)
		await prisma.organisation_entities.create({
			data: {
				id: tenantId,
				tenant_id: tenantId,
				organisation_id: orgId,
				name: "Test Tenant",
				type: "INSTITUTE",
			},
		});

		// Create test section/unit
		const unit = await prisma.organisation_units.create({
			data: {
				id: `test-section-${Date.now()}`,
				name: "Test Section CS-101",
				code: "CS-101",
				tenant_id: tenantId,
				organisation_id: orgId,
				entity_id: tenantId,
				type: "SECTION",
				parent_unit_id: null,
				created_at: new Date(),
				updated_at: new Date(),
			},
		});

		// Create test users with roles
		const student: TestUser = {
			id: `student-${Date.now()}`,
			email: `student-${Date.now()}@example.com`,
			name: "Test Student",
			role: "LEARNER",
			tenantId,
		};

		const faculty: TestUser = {
			id: `faculty-${Date.now()}`,
			email: `faculty-${Date.now()}@example.com`,
			name: "Dr. Test Faculty",
			role: "INSTRUCTOR",
			tenantId,
		};

		const po: TestUser = {
			id: `po-${Date.now()}`,
			email: `po-${Date.now()}@example.com`,
			name: "Test PO",
			role: "ADMIN",
			tenantId,
		};

		const admin: TestUser = {
			id: `admin-${Date.now()}`,
			email: `admin-${Date.now()}@example.com`,
			name: "Test Admin",
			role: "ADMIN",
			tenantId,
		};

		// Create users in database
		await Promise.all([
			prisma.users.create({
				data: {
					id: student.id,
					email: student.email,
					name: student.name,
					type: student.role,
					organisation_id: orgId,
					tenant_id: tenantId,
					uid: student.id,
				},
			}),
			prisma.users.create({
				data: {
					id: faculty.id,
					email: faculty.email,
					name: faculty.name,
					type: faculty.role,
					organisation_id: orgId,
					tenant_id: tenantId,
					uid: faculty.id,
				},
			}),
			prisma.users.create({
				data: {
					id: po.id,
					email: po.email,
					name: po.name,
					type: po.role,
					organisation_id: orgId,
					tenant_id: tenantId,
					uid: po.id,
				},
			}),
			prisma.users.create({
				data: {
					id: admin.id,
					email: admin.email,
					name: admin.name,
					type: admin.role,
					organisation_id: orgId,
					tenant_id: tenantId,
					uid: admin.id,
				},
			}),
		]);

		// Create user mappings with permissions
		await Promise.all([
			prisma.user_mappings.create({
				data: {
					user_id: student.id,
					organisation_id: orgId,
					tenant_id: tenantId,
					unit_id: unit.id,
					unit_ids: [unit.id],
					permissions: JSON.stringify({}),
					created_at: new Date(),
					updated_at: new Date(),
				},
			}),
			prisma.user_mappings.create({
				data: {
					user_id: faculty.id,
					organisation_id: orgId,
					tenant_id: tenantId,
					unit_id: unit.id,
					unit_ids: [unit.id],
					permissions: JSON.stringify({
						resume_review_own_section: true,
					}),
					created_at: new Date(),
					updated_at: new Date(),
				},
			}),
			prisma.user_mappings.create({
				data: {
					user_id: po.id,
					organisation_id: orgId,
					tenant_id: tenantId,
					unit_id: null,
					unit_ids: [],
					permissions: JSON.stringify({
						resume_review_all_sections_in_tenant: true,
					}),
					created_at: new Date(),
					updated_at: new Date(),
				},
			}),
			prisma.user_mappings.create({
				data: {
					user_id: admin.id,
					organisation_id: orgId,
					tenant_id: tenantId,
					unit_id: null,
					unit_ids: [],
					permissions: JSON.stringify({
						resume_view_metrics_own_tenant: true,
					}),
					created_at: new Date(),
					updated_at: new Date(),
				},
			}),
		]);

		// Create course enrollment for student
		await prisma.courses.create({
			data: {
				id: `course-${Date.now()}`,
				name: "Test Course CS-101",
				code: "CS-101",
				tenant_id: tenantId,
				organisation_id: orgId,
				instructor_id: faculty.id,
				unit_ids: [unit.id],
				created_at: new Date(),
				updated_at: new Date(),
			},
		});

		testContext = {
			student: { ...student, token: generateToken(student) },
			faculty: { ...faculty, token: generateToken(faculty) },
			po: { ...po, token: generateToken(po) },
			admin: { ...admin, token: generateToken(admin) },
			tenantId,
			sectionId: unit.id,
		};

		return testContext;
	} catch (error) {
		console.error("Failed to setup test database:", error);
		throw error;
	}
}

/**
 * Clean up test data
 */
export async function cleanupTestDatabase(): Promise<void> {
	if (!testContext) {
		return;
	}

	try {
		const { student, faculty, po, admin, tenantId, sectionId } = testContext;

		// Delete in order to respect foreign keys
		await Promise.all([
			prisma.resumeNotification.deleteMany({
				where: { tenantId: tenantId },
			}),
			prisma.resumeUserMapping.deleteMany({
				where: { tenantId: tenantId },
			}),
			prisma.user_mappings.deleteMany({
				where: {
					tenant_id: tenantId,
					user_id: {
						in: [student.id, faculty.id, po.id, admin.id],
					},
				},
			}),
			prisma.users.deleteMany({
				where: {
					id: {
						in: [student.id, faculty.id, po.id, admin.id],
					},
				},
			}),
			prisma.course_learner_enrollments.deleteMany({
				where: { tenant_id: tenantId },
			}),
			prisma.course_instructor_assignments.deleteMany({
				where: {
					course: { tenant_id: tenantId },
				},
			}),
			prisma.courses.deleteMany({
				where: { tenant_id: tenantId },
			}),
			prisma.organisation_units.deleteMany({
				where: { id: sectionId },
			}),
			prisma.organisation_entities.deleteMany({
				where: { id: tenantId },
			}),
		]);

		testContext = null;
	} catch (error) {
		console.error("Failed to cleanup test database:", error);
		throw error;
	}
}

/**
 * Get current test context
 */
export function getTestContext(): TestContext {
	if (!testContext) {
		throw new Error("Test database not initialized. Call setupTestDatabase first.");
	}
	return testContext;
}

/**
 * Reset test data between tests
 */
export async function resetTestData(): Promise<void> {
	// Clear notifications and resume data
	if (!testContext) return;

	try {
		await Promise.all([
			prisma.resumeNotification.deleteMany({
				where: { tenantId: testContext.tenantId },
			}),
		]);
	} catch (error) {
		console.error("Failed to reset test data:", error);
	}
}

/**
 * Jest hooks for test lifecycle
 */
export const testSetup = {
	beforeAll: async () => {
		await setupTestDatabase();
	},
	afterAll: cleanupTestDatabase,
	afterEach: resetTestData,
};
