import { afterEach, expect, it, vi } from "vitest";
import { ApiRequestError, backendApi } from "./backendApi";
import { studentCreationFailure, studentCreationFeedback } from "../utils/studentOnboarding";
afterEach(() => vi.restoreAllMocks());
const payload = { name: "Student", email: "student@example.com", enrollmentNumber: "A", program: "B.Tech", course: "CS", section: "A", batch: "2026", initialCredits: 0 };
it("consumes the actual top-level response fields and warning outcome", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true, student: { id: "s", userId: "u" }, invitationStatus: "failed", emailError: "quota secret" }), { status: 201 }));
  const response = await backendApi.enterprise.createStudent(payload, "live-token");
  expect(response.student.id).toBe("s"); expect(response.invitationStatus).toBe("failed");
  expect(studentCreationFeedback(response)).toEqual(expect.objectContaining({ type: "warning" }));
});
it("preserves HTTP status so creation rejection can be distinguished from a transport failure", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 })).mockRejectedValueOnce(new TypeError("Failed to fetch"));
  try { await backendApi.enterprise.createStudent(payload, "live-token"); throw new Error("Expected rejection"); } catch (error) {
    expect(error).toBeInstanceOf(ApiRequestError); expect(studentCreationFailure(error).type).toBe("error");
  }
  try { await backendApi.enterprise.createStudent(payload, "live-token"); throw new Error("Expected rejection"); } catch (error) {
    expect(studentCreationFailure(error).type).toBe("warning");
  }
});
it("marks invalid post-success response parsing as an unknown outcome", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("proxy failure", { status: 200 }));
  await expect(backendApi.enterprise.createStudent(payload, "live-token")).rejects.toBeInstanceOf(ApiRequestError);
});
