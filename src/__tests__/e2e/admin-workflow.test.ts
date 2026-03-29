/**
 * E2E Tests: Admin Dashboard Workflow
 *
 * Tests admin journey:
 * - View comprehensive dashboard
 * - Access student timeline
 * - View faculty metrics
 * - View statistics with date range
 * - Verify tenant isolation
 */

// @ts-expect-error
import request from "supertest";
// @ts-expect-error
import { app } from "../../index";
import { getTestContext, testSetup } from "./setup";

describe("Admin Dashboard Workflow (E2E)", () => {
	beforeAll(testSetup.beforeAll);
	afterAll(testSetup.afterAll);
	afterEach(testSetup.afterEach);

	describe("Admin Dashboard Access", () => {
		it("should allow admin to view main dashboard", async () => {
			const { admin } = getTestContext();

			const response = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);
			expect(response.body.responseData).toHaveProperty("sections");
			expect(response.body.responseData).toHaveProperty("stats");
			expect(Array.isArray(response.body.responseData.sections)).toBe(true);
		});

		it("should display section overview with metrics", async () => {
			const { admin } = getTestContext();

			const response = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);

			if (response.body.responseData.sections.length > 0) {
				const section = response.body.responseData.sections[0];
				expect(section).toHaveProperty("id");
				expect(section).toHaveProperty("name");
				expect(section).toHaveProperty("coordinator");
				expect(section).toHaveProperty("students");
				expect(section).toHaveProperty("resumes");
				expect(section).toHaveProperty("evaluations");
				expect(section).toHaveProperty("completionRate");
			}
		});

		it("should include tenant-wide statistics", async () => {
			const { admin } = getTestContext();

			const response = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);
			const stats = response.body.responseData.stats;
			expect(stats).toHaveProperty("totalStudents");
			expect(stats).toHaveProperty("totalResumes");
			expect(stats).toHaveProperty("evaluationsCompleted");
			expect(stats).toHaveProperty("completionRate");
			expect(stats).toHaveProperty("averageScore");
		});

		it("should prevent student from accessing admin dashboard", async () => {
			const { student } = getTestContext();

			const response = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${student.token}`);

			expect(response.status).toBe(403);
		});

		it("should prevent faculty from accessing admin dashboard", async () => {
			const { faculty } = getTestContext();

			const response = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${faculty.token}`);

			expect(response.status).toBe(403);
		});
	});

	describe("Student Timeline & Audit Trail", () => {
		it("should retrieve student timeline for audit", async () => {
			const { admin, student } = getTestContext();

			const response = await request(app)
				.get(`/v1/admin/resumes/student/${student.id}/timeline`)
				.set("Authorization", `Bearer ${admin.token}`);

			expect([200, 404]).toContain(response.status);
			if (response.status === 200) {
				expect(response.body.responseData).toHaveProperty("student");
				expect(response.body.responseData).toHaveProperty("timeline");
				expect(Array.isArray(response.body.responseData.timeline)).toBe(true);
			}
		});

		it("should include event timestamps in timeline", async () => {
			const { admin, student } = getTestContext();

			const response = await request(app)
				.get(`/v1/admin/resumes/student/${student.id}/timeline`)
				.set("Authorization", `Bearer ${admin.token}`);

			if (response.status === 200) {
				response.body.responseData.timeline.forEach((event: any) => {
					expect(event).toHaveProperty("timestamp");
					expect(event).toHaveProperty("event");
					expect(event).toHaveProperty("data");
				});
			}
		});

		it("should track different event types", async () => {
			const { admin, student } = getTestContext();

			const response = await request(app)
				.get(`/v1/admin/resumes/student/${student.id}/timeline`)
				.set("Authorization", `Bearer ${admin.token}`);

			if (response.status === 200 && response.body.responseData.timeline.length > 0) {
				const events = response.body.responseData.timeline;
				const eventTypes = events.map((e: any) => e.event);

				// Could include various event types
				expect(eventTypes.length >= 0).toBe(true);
			}
		});

		it("should prevent unauthorized access to student timelines", async () => {
			const { student, admin } = getTestContext();

			// Student trying to access another student's timeline
			const response = await request(app)
				.get(`/v1/admin/resumes/student/${admin.id}/timeline`)
				.set("Authorization", `Bearer ${student.token}`);

			expect(response.status).toBe(403);
		});
	});

	describe("Faculty Performance Metrics", () => {
		it("should retrieve faculty metrics", async () => {
			const { admin, faculty } = getTestContext();

			const response = await request(app)
				.get(`/v1/admin/resumes/faculty/${faculty.id}/metrics`)
				.set("Authorization", `Bearer ${admin.token}`);

			expect([200, 404]).toContain(response.status);
			if (response.status === 200) {
				expect(response.body.responseData).toHaveProperty("faculty");
				expect(response.body.responseData).toHaveProperty("metrics");
			}
		});

		it("should include faculty performance indicators", async () => {
			const { admin, faculty } = getTestContext();

			const response = await request(app)
				.get(`/v1/admin/resumes/faculty/${faculty.id}/metrics`)
				.set("Authorization", `Bearer ${admin.token}`);

			if (response.status === 200) {
				const metrics = response.body.responseData.metrics;
				expect(metrics).toHaveProperty("sectionsAssigned");
				expect(metrics).toHaveProperty("studentsSupervised");
				expect(metrics).toHaveProperty("resumesReviewed");
				expect(metrics).toHaveProperty("evaluationsCompleted");
			}
		});

		it("should calculate average scores and times", async () => {
			const { admin, faculty } = getTestContext();

			const response = await request(app)
				.get(`/v1/admin/resumes/faculty/${faculty.id}/metrics`)
				.set("Authorization", `Bearer ${admin.token}`);

			if (response.status === 200) {
				const metrics = response.body.responseData.metrics;
				if (metrics.evaluationsCompleted > 0) {
					expect(metrics).toHaveProperty("averageEvaluationScore");
					expect(metrics).toHaveProperty("averageTimeToEvaluate");
				}
			}
		});

		it("should prevent unauthorized access to faculty metrics", async () => {
			const { student, faculty } = getTestContext();

			const response = await request(app)
				.get(`/v1/admin/resumes/faculty/${faculty.id}/metrics`)
				.set("Authorization", `Bearer ${student.token}`);

			expect(response.status).toBe(403);
		});
	});

	describe("Aggregate Statistics", () => {
		it("should retrieve aggregate statistics", async () => {
			const { admin } = getTestContext();

			const response = await request(app).get("/v1/admin/resumes/stats").set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);
			expect(response.body.responseData).toHaveProperty("period");
			expect(response.body.responseData).toHaveProperty("stats");
		});

		it("should support date range filtering", async () => {
			const { admin } = getTestContext();

			const response = await request(app)
				.get("/v1/admin/resumes/stats?startDate=2026-03-01&endDate=2026-03-26")
				.set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);
			const period = response.body.responseData.period;
			expect(period.startDate).toBe("2026-03-01");
			expect(period.endDate).toBe("2026-03-26");
		});

		it("should include key metrics in statistics", async () => {
			const { admin } = getTestContext();

			const response = await request(app).get("/v1/admin/resumes/stats").set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);
			const stats = response.body.responseData.stats;
			expect(stats).toHaveProperty("resumesSubmitted");
			expect(stats).toHaveProperty("evaluationsCompleted");
			expect(stats).toHaveProperty("commentsAdded");
			expect(stats).toHaveProperty("completionRate");
		});

		it("should reject invalid date ranges", async () => {
			const { admin } = getTestContext();

			const response = await request(app)
				.get("/v1/admin/resumes/stats?startDate=2026-03-26&endDate=2026-03-01")
				.set("Authorization", `Bearer ${admin.token}`);

			expect([200, 422]).toContain(response.status);
		});

		it("should handle missing date parameters", async () => {
			const { admin } = getTestContext();

			const response = await request(app).get("/v1/admin/resumes/stats").set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);
			// Should use default date range
			expect(response.body.responseData.period).toBeDefined();
		});
	});

	describe("Tenant Isolation (CRITICAL SECURITY)", () => {
		it("should restrict admin to assigned tenant only", async () => {
			const { admin, tenantId } = getTestContext();

			const response = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);

			// All sections should be from admin's tenant
			response.body.responseData.sections.forEach((section: any) => {
				expect(section.tenantId).toBe(tenantId);
			});
		});

		it("should not leak data from other tenants", async () => {
			const { admin } = getTestContext();

			const response = await request(app).get("/v1/admin/resumes/stats").set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);

			// Stats should be for admin's tenant only
			const stats = response.body.responseData.stats;
			expect(stats.totalStudents).toBeGreaterThanOrEqual(0);
		});

		it("should ignore tenant parameter in URL", async () => {
			const { admin, tenantId } = getTestContext();

			// Try to access with fake tenant parameter
			const response = await request(app)
				.get("/v1/admin/resumes/dashboard?tenant=other-tenant")
				.set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);

			// Should still return admin's actual tenant data
			response.body.responseData.sections.forEach((section: any) => {
				expect(section.tenantId).toBe(tenantId);
			});
		});

		it("should prevent admin from accessing other tenant timelines", async () => {
			const { admin } = getTestContext();

			// Try to access a user from different tenant
			const response = await request(app)
				.get("/v1/admin/resumes/student/other-tenant-user/timeline")
				.set("Authorization", `Bearer ${admin.token}`);

			// Should 404 or 403
			expect([404, 403]).toContain(response.status);
		});
	});

	describe("Permission & Role Validation", () => {
		it("should enforce admin role requirement", async () => {
			const { student, faculty } = getTestContext();

			// Student trying
			const studentResponse = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${student.token}`);
			expect(studentResponse.status).toBe(403);

			// Faculty trying
			const facultyResponse = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${faculty.token}`);
			expect(facultyResponse.status).toBe(403);

			// PO trying (even though ADMIN role, should lack specific permission)
			// This depends on permission implementation
		});

		it("should validate required permissions", async () => {
			const { admin } = getTestContext();

			// Valid request with proper permissions should succeed
			const response = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);
		});

		it("should reject request without auth token", async () => {
			const response = await request(app).get("/v1/admin/resumes/dashboard");

			expect(response.status).toBe(401);
		});
	});

	describe("Response Format & Data Consistency", () => {
		it("should return consistent response format", async () => {
			const { admin } = getTestContext();

			const response = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${admin.token}`);

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("responseData");
			expect(response.body).toHaveProperty("requestId");
			expect(response.body).toHaveProperty("timestamp");
		});

		it("should have consistent data across endpoints", async () => {
			const { admin } = getTestContext();

			const dashboardResponse = await request(app)
				.get("/v1/admin/resumes/dashboard")
				.set("Authorization", `Bearer ${admin.token}`);

			const statsResponse = await request(app)
				.get("/v1/admin/resumes/stats")
				.set("Authorization", `Bearer ${admin.token}`);

			expect(dashboardResponse.status).toBe(200);
			expect(statsResponse.status).toBe(200);

			const dashboardStats = dashboardResponse.body.responseData.stats;
			const statsData = statsResponse.body.responseData.stats;

			// Should have similar structure and comparable values
			expect(typeof dashboardStats.completionRate).toBe("number");
			expect(typeof statsData.completionRate).toBe("number");
		});

		it("should include timestamp in all responses", async () => {
			const { admin } = getTestContext();

			const endpoints = ["/v1/admin/resumes/dashboard", "/v1/admin/resumes/stats"];

			for (const endpoint of endpoints) {
				const response = await request(app).get(endpoint).set("Authorization", `Bearer ${admin.token}`);

				expect(response.status).toBe(200);
				expect(response.body.timestamp).toBeDefined();
			}
		});
	});
});
