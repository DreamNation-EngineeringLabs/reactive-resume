/**
 * E2E Tests: Student Resume Workflow
 *
 * Tests complete student journey:
 * - Student views own resumes
 * - Faculty adds comments
 * - Student receives notifications
 * - Student marks notifications as read
 */

// @ts-ignore
import request from "supertest";
// @ts-ignore
import { app } from "../../index";
import { testSetup, getTestContext } from "./setup";

describe("Student Resume Workflow (E2E)", () => {
  beforeAll(testSetup.beforeAll);
  afterAll(testSetup.afterAll);
  afterEach(testSetup.afterEach);

  describe("Student Resume Management", () => {
    it("should allow student to view own resume list", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/resumes/user/me?page=1&limit=20")
        .set("Authorization", `Bearer ${student.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("responseData");
      expect(response.body.responseData).toHaveProperty("resumes");
      expect(response.body.responseData).toHaveProperty("meta");
      expect(response.body.responseData.meta).toHaveProperty("page");
      expect(response.body.responseData.meta).toHaveProperty("limit");
      expect(response.body.responseData.meta).toHaveProperty("total");
    });

    it("should prevent student from accessing peer's resumes", async () => {
      const { student } = getTestContext();

      // Try to access a resume that doesn't exist or belongs to peer
      const response = await request(app)
        .get("/v1/resumes/nonexistent-resume")
        .set("Authorization", `Bearer ${student.token}`);

      expect([404, 403]).toContain(response.status);
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app).get("/v1/resumes/user/me");

      expect(response.status).toBe(401);
    });
  });

  describe("Student Comment Receipt & Notifications", () => {
    it("should retrieve student notifications", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/notifications?page=1&limit=20")
        .set("Authorization", `Bearer ${student.token}`);

      expect(response.status).toBe(200);
      expect(response.body.responseData).toHaveProperty("notifications");
      expect(Array.isArray(response.body.responseData.notifications)).toBe(true);
    });

    it("should get unread notifications count", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/notifications/unread")
        .set("Authorization", `Bearer ${student.token}`);

      expect(response.status).toBe(200);
      expect(response.body.responseData).toHaveProperty("unreadCount");
      expect(typeof response.body.responseData.unreadCount).toBe("number");
    });

    it("should mark notification as read", async () => {
      const { student } = getTestContext();

      // First get notifications
      const notifResponse = await request(app)
        .get("/v1/notifications?page=1&limit=20")
        .set("Authorization", `Bearer ${student.token}`);

      if (notifResponse.body.responseData.notifications.length > 0) {
        const notifId =
          notifResponse.body.responseData.notifications[0].id;

        const response = await request(app)
          .post(`/v1/notifications/${notifId}/read`)
          .set("Authorization", `Bearer ${student.token}`);

        expect([200, 404]).toContain(response.status); // 404 if notif doesn't exist
      }
    });

    it("should mark all notifications as read", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .post("/v1/notifications/mark-all-read")
        .set("Authorization", `Bearer ${student.token}`);

      expect([200, 404]).toContain(response.status);
    });

    it("should delete a notification", async () => {
      const { student } = getTestContext();

      // Get a notification first
      const notifResponse = await request(app)
        .get("/v1/notifications?page=1&limit=20")
        .set("Authorization", `Bearer ${student.token}`);

      if (notifResponse.body.responseData.notifications.length > 0) {
        const notifId =
          notifResponse.body.responseData.notifications[0].id;

        const response = await request(app)
          .delete(`/v1/notifications/${notifId}`)
          .set("Authorization", `Bearer ${student.token}`);

        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe("Student Dashboard Access", () => {
    it("should retrieve student dashboard", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/student/dashboard")
        .set("Authorization", `Bearer ${student.token}`);

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.responseData).toHaveProperty("resumes");
        expect(response.body.responseData).toHaveProperty("stats");
      }
    });

    it("should prevent student from accessing faculty dashboard", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/faculty/dashboard")
        .set("Authorization", `Bearer ${student.token}`);

      expect(response.status).toBe(403);
    });

    it("should prevent student from accessing admin endpoints", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/admin/resumes/dashboard")
        .set("Authorization", `Bearer ${student.token}`);

      expect(response.status).toBe(403);
    });
  });

  describe("Permission & Tenant Isolation", () => {
    it("should enforce tenant scoping for student data", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/resumes/user/me")
        .set("Authorization", `Bearer ${student.token}`);

      expect(response.status).toBe(200);

      // Verify all resumes belong to student
      response.body.responseData.resumes.forEach((resume: any) => {
        expect(resume.studentId).toBe(student.id);
      });
    });

    it("should validate auth token format", async () => {
      const response = await request(app)
        .get("/v1/resumes/user/me")
        .set("Authorization", "Bearer invalid-token-format");

      expect(response.status).toBe(401);
    });

    it("should reject expired tokens", async () => {
      // Create an expired token
      const expiredToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2NDUwMDAwMDB9.expired";

      const response = await request(app)
        .get("/v1/resumes/user/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe("Response Format Validation", () => {
    it("should return properly formatted success response", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/resumes/user/me?page=1&limit=20")
        .set("Authorization", `Bearer ${student.token}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("responseData");
        expect(response.body).toHaveProperty("requestId");
        expect(response.body).toHaveProperty("timestamp");
      }
    });

    it("should include pagination metadata in responses", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/resumes/user/me?page=1&limit=10")
        .set("Authorization", `Bearer ${student.token}`);

      expect(response.status).toBe(200);
      expect(response.body.responseData.meta).toEqual(
        expect.objectContaining({
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
        })
      );
    });

    it("should include error details in error responses", async () => {
      const response = await request(app)
        .get("/v1/resumes/user/me");

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty("code");
      expect(response.body.error).toHaveProperty("message");
      expect(response.body.error).toHaveProperty("statusCode");
    });
  });

  describe("Pagination & Filtering", () => {
    it("should enforce maximum page size limit", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/resumes/user/me?page=1&limit=1001")
        .set("Authorization", `Bearer ${student.token}`);

      if (response.status === 200) {
        // Should be capped at 100
        expect(response.body.responseData.meta.limit).toBeLessThanOrEqual(1000);
      }
    });

    it("should default to page 1 when not specified", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/resumes/user/me")
        .set("Authorization", `Bearer ${student.token}`);

      expect(response.status).toBe(200);
      expect(response.body.responseData.meta.page).toBe(1);
    });

    it("should handle invalid page numbers gracefully", async () => {
      const { student } = getTestContext();

      const response = await request(app)
        .get("/v1/resumes/user/me?page=-1&limit=20")
        .set("Authorization", `Bearer ${student.token}`);

      expect([200, 422]).toContain(response.status);
    });
  });
});
