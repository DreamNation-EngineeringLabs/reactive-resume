/**
 * Integration Test Setup
 *
 * Provides test utilities for:
 * - Test database setup/teardown
 * - Mock context creation
 * - Auth token generation
 * - API call helpers
 */

// Define minimal interfaces for Express Request/Response
interface Request {
	context: any;
	user_id: string;
	organisation_id: string;
	params: Record<string, string>;
	query: Record<string, string>;
	body: any;
	headers: Record<string, string>;
}

interface Response {
	statusCode: number;
	status(code: number): this;
	json(data: any): this;
	send(data: any): this;
	setHeader(key: string, value: string): this;
}

/**
 * Mock context for testing
 */
export function createMockContext(overrides?: Partial<any>) {
	return {
		userId: "test-user-123",
		uid: "test-user-123", // Firebase UID
		orgId: "test-org-456",
		tenantId: "test-tenant-789",
		role: "LEARNER",
		accessScope: ["OWN"],
		features: {},
		...overrides,
	};
}

/**
 * Create mock request object
 */
export function createMockRequest(overrides?: Partial<any>): Partial<Request> {
	return {
		context: createMockContext(),
		user_id: "test-user-123",
		organisation_id: "test-org-456",
		params: {},
		query: {},
		body: {},
		headers: {
			authorization: "Bearer test-token",
		},
		...overrides,
	};
}

/**
 * Extended response interface for mocking
 */
export interface MockResponse extends Response {
	body?: any;
	headers?: Record<string, string>;
}

/**
 * Create mock response object
 */
export function createMockResponse(): MockResponse {
	const res: MockResponse = {
		status: function (code: number) {
			this.statusCode = code;
			return this;
		},
		json: function (data: any) {
			this.body = data;
			return this;
		},
		send: function (data: any) {
			this.body = data;
			return this;
		},
		setHeader: function (key: string, value: string) {
			this.headers = this.headers || {};
			this.headers[key] = value;
			return this;
		},
		statusCode: 200,
		body: null,
		headers: {},
	};
	return res;
}

/**
 * Test data fixtures
 */
export const testFixtures = {
	users: {
		student: {
			id: "student-001",
			name: "John Student",
			email: "john@example.com",
			role: "LEARNER",
		},
		faculty: {
			id: "faculty-001",
			name: "Dr. Jane Faculty",
			email: "jane@example.com",
			role: "INSTRUCTOR",
		},
		po: {
			id: "po-001",
			name: "PO Officer",
			email: "po@example.com",
			role: "ADMIN",
		},
		admin: {
			id: "admin-001",
			name: "Admin User",
			email: "admin@example.com",
			role: "ADMIN",
		},
	},

	resumes: {
		resume1: {
			id: "resume-001",
			name: "Resume v1",
			studentId: "student-001",
		},
		resume2: {
			id: "resume-002",
			name: "Resume v2",
			studentId: "student-001",
		},
	},

	comments: {
		comment1: {
			id: "comment-001",
			content: "Great resume!",
			scope: "INDIVIDUAL",
			status: "PUBLISHED",
		},
		comment2: {
			id: "comment-002",
			content: "Needs improvement",
			scope: "SECTION",
			status: "PUBLISHED",
		},
	},

	checklists: {
		checklist1: {
			id: "checklist-001",
			title: "Technical Skills",
			items: [
				{ title: "Programming Languages", weight: 1.0 },
				{ title: "Project Experience", weight: 1.0 },
			],
		},
	},
};

/**
 * Assert helper functions
 */
export const assertions = {
	isSuccess: (response: Partial<Response>) => {
		return response.statusCode && response.statusCode >= 200 && response.statusCode < 300;
	},

	isError: (response: Partial<Response>, code?: number) => {
		if (code) {
			return response.statusCode === code;
		}
		return response.statusCode && response.statusCode >= 400;
	},

	hasData: (response: MockResponse) => {
		return response.body && response.body.responseData;
	},

	matchesFixture: (actual: any, fixture: any) => {
		return Object.keys(fixture).every((key) => actual[key] === fixture[key]);
	},
};
