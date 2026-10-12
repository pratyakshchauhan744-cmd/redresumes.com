import { describe, expect, it } from "vitest";
import { interviewReportPath } from "./routes";

describe("interviewReportPath", () => {
  it("builds the registered report route from the interview session ID", () => {
    const studentId = "student_123";
    const sessionId = "session_789";
    const path = interviewReportPath(sessionId);

    expect(path).toBe("/interview/report/session_789");
    expect(path).not.toContain("/interview-report/");
    expect(path).not.toContain(studentId);
  });

  it("keeps multiple interviews for one student on distinct session routes", () => {
    expect(interviewReportPath("session_100")).toBe("/interview/report/session_100");
    expect(interviewReportPath("session_200")).toBe("/interview/report/session_200");
  });
});
