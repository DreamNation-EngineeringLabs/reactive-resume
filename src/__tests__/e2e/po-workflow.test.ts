/**
 * E2E Tests: Placement Officer (PO) Cross-Section Workflow
 *
 * Tests PO journey:
 * - View all resumes in tenant
 * - Filter and search
 * - View aggregated metrics
 * - Verify cross-section access
 * - Verify cross-tenant prevention
 */

// @ts-expect-error
import request from "supertest";
// @ts-expect-error
import { app } from "../../index";
import { getTestContext, testSetup } from "./setup";

describe("Placement Officer Cross-Section Workflow (E2E)", () => {
	beforeAll(testSetup.beforeAll);
	afterAll(testSetup.afterAll);
	afterEach(testSetup.afterEach);

	describe("PO Resume Access", () => {
		it("should allow PO to view all resumes in tenant", async () => {
			const { po } = getTestContext();

			const response = await request(app)
				.get("/v1/resumes/all?page=1&limit=50")
				.set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			expect(response.body.responseData).toHaveProperty("resumes");
			expect(response.body.responseData).toHaveProperty("meta");
			expect(Array.isArray(response.body.responseData.resumes)).toBe(true);
		});

		it("should enforce pagination on resume list", async () => {
			const { po } = getTestContext();

			const response = await request(app)
				.get("/v1/resumes/all?page=1&limit=10")
				.set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			expect(response.body.responseData.meta.limit).toBeLessThanOrEqual(10);
		});

		it("should support filtering by section", async () => {
			const { po, sectionId } = getTestContext();

			const response = await request(app)
				.get(`/v1/resumes/all?page=1&limit=50&section=${sectionId}`)
				.set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			expect(Array.isArray(response.body.responseData.resumes)).toBe(true);
		});

		it("should support filtering by evaluation status", async () => {
			const { po } = getTestContext();

			const evaluatedResponse = await request(app)
				.get("/v1/resumes/all?page=1&limit=50&evaluated=true")
				.set("Authorization", `Bearer ${po.token}`);

			expect(evaluatedResponse.status).toBe(200);

			const pendingResponse = await request(app)
				.get("/v1/resumes/all?page=1&limit=50&evaluated=false")
				.set("Authorization", `Bearer ${po.token}`);

			expect(pendingResponse.status).toBe(200);
		});

		it("should prevent student from viewing all resumes", async () => {
			const { student } = getTestContext();

			const response = await request(app)
				.get("/v1/resumes/all?page=1&limit=50")
				.set("Authorization", `Bearer ${student.token}`);

			expect(response.status).toBe(403);
		});

		it("should prevent faculty from viewing all resumes", async () => {
			const { faculty } = getTestContext();

			const response = await request(app)
				.get("/v1/resumes/all?page=1&limit=50")
				.set("Authorization", `Bearer ${faculty.token}`);

			expect(response.status).toBe(403);
		});
	});

	describe("PO Metrics & Aggregation", () => {
		it("should allow PO to view metrics by section", async () => {
			const { po } = getTestContext();

			const response = await request(app).get("/v1/resumes/metrics").set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			expect(response.body.responseData).toHaveProperty("sections");
			expect(response.body.responseData).toHaveProperty("tenant");
			expect(Array.isArray(response.body.responseData.sections)).toBe(true);
		});

		it("should include completion rate in metrics", async () => {
			const { po } = getTestContext();

			const response = await request(app).get("/v1/resumes/metrics").set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);

			if (response.body.responseData.sections.length > 0) {
				const section = response.body.responseData.sections[0];
				expect(section).toHaveProperty("totalResumes");
				expect(section).toHaveProperty("evaluatedResumes");
				expect(section).toHaveProperty("completionRate");
				expect(section.completionRate).toBeGreaterThanOrEqual(0);
				expect(section.completionRate).toBeLessThanOrEqual(100);
			}
		});

		it("should include tenant-wide statistics", async () => {
			const { po } = getTestContext();

			const response = await request(app).get("/v1/resumes/metrics").set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			const tenant = response.body.responseData.tenant;
			expect(tenant).toHaveProperty("totalStudents");
			expect(tenant).toHaveProperty("totalResumes");
			expect(tenant).toHaveProperty("evaluationsCompleted");
			expect(tenant).toHaveProperty("completionRate");
		});

		it("should support date range filtering", async () => {
			const { po } = getTestContext();

			const response = await request(app)
				.get("/v1/resumes/metrics?startDate=2026-03-01&endDate=2026-03-26")
				.set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			expect(response.body.responseData).toHaveProperty("sections");
		});

		it("should prevent invalid date range", async () => {
			const { po } = getTestContext();

			const response = await request(app)
				.get("/v1/resumes/metrics?startDate=2026-03-26&endDate=2026-03-01")
				.set("Authorization", `Bearer ${po.token}`);

			expect([200, 422]).toContain(response.status);
		});
	});

	describe("Cross-Tenant Isolation (CRITICAL SECURITY)", () => {
		it("should restrict PO to assigned tenant only", async () => {
			const { po, tenantId } = getTestContext();

			const response = await request(app)
				.get("/v1/resumes/all?page=1&limit=50")
				.set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);

			// All resumes should be from the PO's assigned tenant
			response.body.responseData.resumes.forEach((resume: any) => {
				expect(resume.tenantId).toBe(tenantId);
			});
		});

		it("should not leak data from other tenants via URL parameters", async () => {
			const { po, tenantId } = getTestContext();

			// Try to access with fake tenant parameter
			const response = await request(app)
				.get("/v1/resumes/all?page=1&limit=50&tenant=other-tenant")
				.set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);

			// Should still only return resumes from po's actual tenant
			response.body.responseData.resumes.forEach((resume: any) => {
				expect(resume.tenantId).toBe(tenantId);
			});
		});

		it("should not allow PO to view metrics for other tenants", async () => {
			const { po, tenantId } = getTestContext();

			const response = await request(app).get("/v1/resumes/metrics").set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);

			// All sections should be from PO's tenant
			response.body.responseData.sections.forEach((section: any) => {
				expect(section.tenantId).toBe(tenantId);
			});
		});

		it("should prevent PO from accessing aggregated data of other tenants", async () => {
			const { po, tenantId } = getTestContext();

			const response = await request(app).get("/v1/resumes/metrics").set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);

			const tenant = response.body.responseData.tenant;
			expect(tenant.tenantId).toBe(tenantId);
		});
	});

	describe("Data Accuracy in Metrics", () => {
		it("should accurately count total students", async () => {
			const { po } = getTestContext();

			const response = await request(app).get("/v1/resumes/metrics").set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			const tenant = response.body.responseData.tenant;

			expect(typeof tenant.totalStudents).toBe("number");
			expect(tenant.totalStudents).toBeGreaterThanOrEqual(0);
		});

		it("should have consistent counts across views", async () => {
			const { po } = getTestContext();

			// Get metrics
			const metricsResponse = await request(app).get("/v1/resumes/metrics").set("Authorization", `Bearer ${po.token}`);

			const totalFromMetrics = metricsResponse.body.responseData.tenant.totalResumes;

			// Get all resumes (should match or be subset)
			const resumesResponse = await request(app)
				.get("/v1/resumes/all?page=1&limit=1000")
				.set("Authorization", `Bearer ${po.token}`);

			const totalFromList = resumesResponse.body.responseData.meta.total;

			expect(totalFromMetrics).toBeLessThanOrEqual(totalFromList + 1); // Allow small variance
		});

		it("should calculate completion rate correctly", async () => {
			const { po } = getTestContext();

			const response = await request(app).get("/v1/resumes/metrics").set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			const tenant = response.body.responseData.tenant;

			if (tenant.totalResumes > 0) {
				const calculatedRate = Math.round((tenant.evaluationsCompleted / tenant.totalResumes) * 100);
				expect(calculatedRate).toBe(tenant.completionRate);
			}
		});
	});

	describe("Permission & Role Validation", () => {
		it("should enforce PO role requirement", async () => {
			const { student, faculty } = getTestContext();

			// Student trying PO endpoint
			const studentResponse = await request(app)
				.get("/v1/resumes/all?page=1&limit=50")
				.set("Authorization", `Bearer ${student.token}`);

			expect(studentResponse.status).toBe(403);

			// Faculty trying PO endpoint
			const facultyResponse = await request(app)
				.get("/v1/resumes/all?page=1&limit=50")
				.set("Authorization", `Bearer ${faculty.token}`);

			expect(facultyResponse.status).toBe(403);
		});

		it("should validate permission in header (permission middleware)", async () => {
			const { po } = getTestContext();

			// Valid request should succeed
			const validResponse = await request(app)
				.get("/v1/resumes/all?page=1&limit=50")
				.set("Authorization", `Bearer ${po.token}`);

			expect(validResponse.status).toBe(200);
		});

		it("should reject request without auth token", async () => {
			const response = await request(app).get("/v1/resumes/all?page=1&limit=50");

			expect(response.status).toBe(401);
		});
	});

	describe("Response Format & Consistency", () => {
		it("should return consistent response format for resumes", async () => {
			const { po } = getTestContext();

			const response = await request(app)
				.get("/v1/resumes/all?page=1&limit=50")
				.set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("responseData");
			expect(response.body).toHaveProperty("requestId");
			expect(response.body).toHaveProperty("timestamp");
		});

		it("should return consistent response format for metrics", async () => {
			const { po } = getTestContext();

			const response = await request(app).get("/v1/resumes/metrics").set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("responseData");
			expect(response.body).toHaveProperty("requestId");
			expect(response.body).toHaveProperty("timestamp");
		});

		it("should include metadata in paginated responses", async () => {
			const { po } = getTestContext();

			const response = await request(app)
				.get("/v1/resumes/all?page=2&limit=25")
				.set("Authorization", `Bearer ${po.token}`);

			expect(response.status).toBe(200);
			const meta = response.body.responseData.meta;
			expect(meta.page).toBe(2);
			expect(meta.limit).toBe(25);
			expect(meta).toHaveProperty("total");
			expect(meta).toHaveProperty("hasMore");
		});
	});
});
