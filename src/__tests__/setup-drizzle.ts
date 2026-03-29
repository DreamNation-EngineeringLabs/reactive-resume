/**
 * Drizzle Test Setup for reactive-resume
 *
 * Database initialization, test data creation, and cleanup
 * Uses Drizzle ORM instead of Prisma
 */

// @ts-expect-error: jsonwebtoken types might be missing in some environments
import jwt from "jsonwebtoken";
import { db } from "@/integrations/drizzle/client";
import { user } from "@/integrations/drizzle/schema";
import { generateId } from "@/utils/string";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";

export interface TestUser {
	id: string;
	email: string;
	name: string;
	username: string;
	displayUsername: string;
}

export interface TestContext {
	student: TestUser & { token: string };
	faculty: TestUser & { token: string };
	po: TestUser & { token: string };
	admin: TestUser & { token: string };
	tenantId: string;
	orgId: string;
}

let testContext: TestContext | null = null;

/**
 * Generate a JWT token for testing
 */
export function generateToken(userId: string, email: string): string {
	return jwt.sign(
		{
			sub: userId,
			email,
			role: "user",
			iat: Math.floor(Date.now() / 1000),
		},
		JWT_SECRET,
		{ expiresIn: "1h", algorithm: "HS256" },
	);
}

/**
 * Generate bridge token (for eng-labs cross-service auth)
 */
export function generateBridgeToken(userId: string, tenantId: string, orgId: string): string {
	return jwt.sign(
		{
			engLabsUserId: userId,
			tenantId,
			orgId,
			role: "LEARNER",
			permissions: {},
		},
		JWT_SECRET,
		{ expiresIn: "15m", algorithm: "HS256" },
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
		const tenantId = `test-tenant-${Date.now()}`;
		const orgId = "test-org-001";

		// Create test users
		const studentId = generateId();
		const facultyId = generateId();
		const poId = generateId();
		const adminId = generateId();

		// Create student user
		await db
			.insert(user)
			.values({
				id: studentId,
				name: "Test Student",
				email: "student@example.com",
				username: `student_${Date.now()}`,
				displayUsername: `Student ${Date.now()}`,
				emailVerified: true,
			})
			.onConflictDoNothing();

		// Create faculty user
		await db
			.insert(user)
			.values({
				id: facultyId,
				name: "Dr. Test Faculty",
				email: "faculty@example.com",
				username: `faculty_${Date.now()}`,
				displayUsername: `Faculty ${Date.now()}`,
				emailVerified: true,
			})
			.onConflictDoNothing();

		// Create PO user
		await db
			.insert(user)
			.values({
				id: poId,
				name: "Test PO",
				email: "po@example.com",
				username: `po_${Date.now()}`,
				displayUsername: `PO ${Date.now()}`,
				emailVerified: true,
			})
			.onConflictDoNothing();

		// Create admin user
		await db
			.insert(user)
			.values({
				id: adminId,
				name: "Test Admin",
				email: "admin@example.com",
				username: `admin_${Date.now()}`,
				displayUsername: `Admin ${Date.now()}`,
				emailVerified: true,
			})
			.onConflictDoNothing();

		testContext = {
			student: {
				id: studentId,
				name: "Test Student",
				email: "student@example.com",
				username: `student_${Date.now()}`,
				displayUsername: `Student ${Date.now()}`,
				token: generateToken(studentId, "student@example.com"),
			},
			faculty: {
				id: facultyId,
				name: "Dr. Test Faculty",
				email: "faculty@example.com",
				username: `faculty_${Date.now()}`,
				displayUsername: `Faculty ${Date.now()}`,
				token: generateToken(facultyId, "faculty@example.com"),
			},
			po: {
				id: poId,
				name: "Test PO",
				email: "po@example.com",
				username: `po_${Date.now()}`,
				displayUsername: `PO ${Date.now()}`,
				token: generateToken(poId, "po@example.com"),
			},
			admin: {
				id: adminId,
				name: "Test Admin",
				email: "admin@example.com",
				username: `admin_${Date.now()}`,
				displayUsername: `Admin ${Date.now()}`,
				token: generateToken(adminId, "admin@example.com"),
			},
			tenantId,
			orgId,
		};

		return testContext;
	} catch (error) {
		console.error("Test database setup failed:", error);
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
		// Delete test data in reverse order of dependencies
		// This is a simplified cleanup - adjust based on your schema

		// For now, just reset the context
		testContext = null;
	} catch (error) {
		console.error("Test database cleanup failed:", error);
		throw error;
	}
}

/**
 * Get current test context
 */
export function getTestContext(): TestContext {
	if (!testContext) {
		throw new Error("Test context not initialized. Call setupTestDatabase() first.");
	}
	return testContext;
}

/**
 * Test fixtures for common test data
 */
export const testFixtures = {
	resumes: {
		resume1: {
			id: generateId(),
			userId: "student-001",
			name: "Resume 1",
			slug: "resume-1",
			tags: ["experience"],
			data: { summary: "Test resume" },
			isPublic: false,
			isLocked: false,
		},
		resume2: {
			id: generateId(),
			userId: "student-001",
			name: "Resume 2",
			slug: "resume-2",
			tags: ["education"],
			data: { summary: "Another resume" },
			isPublic: false,
			isLocked: false,
		},
	},
	comments: {
		comment1: {
			id: generateId(),
			resumeId: "resume-001",
			studentId: "student-001",
			authorId: "faculty-001",
			content: "Good work on the summary",
			scope: "INDIVIDUAL" as const,
			status: "PUBLISHED" as const,
		},
		comment2: {
			id: generateId(),
			resumeId: "resume-001",
			studentId: "student-001",
			authorId: "faculty-001",
			content: "Consider adding more details",
			scope: "SECTION" as const,
			status: "PUBLISHED" as const,
		},
	},
	evaluations: {
		evaluation1: {
			id: generateId(),
			resumeId: "resume-001",
			checklistId: "checklist-001",
			overallScore: 4.5,
			feedback: "Excellent resume",
			status: "COMPLETED" as const,
		},
	},
	checklists: {
		checklist1: {
			id: generateId(),
			title: "Resume Quality Check",
			items: [
				{ id: generateId(), label: "Grammar and spelling", completed: true },
				{ id: generateId(), label: "Format consistency", completed: true },
				{ id: generateId(), label: "Contact information", completed: false },
			],
		},
	},
};
