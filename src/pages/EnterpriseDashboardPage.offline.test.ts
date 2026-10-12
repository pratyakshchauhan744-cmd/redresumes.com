import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import EnterpriseDashboardPage from "./EnterpriseDashboardPage";
import {
  isOfflineOrDemoToken,
  getInitialLoadingStates,
  getTableEmptyMessage,
  getOfflineFallbackStats,
  getOfflineFallbackFilterOptions,
} from "../utils/enterpriseLoading";
import { AuthUser, backendApi } from "../lib/backendApi";

const createMockUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: "user-123",
  email: "admin@college.edu",
  name: "Dean Admin",
  role: "college_main_faculty",
  isMainFaculty: true,
  collegeId: "col-1",
  permissions: [
    "STUDENT_VIEW",
    "STUDENT_CREATE",
    "FACULTY_VIEW",
    "FACULTY_CREATE",
    "INTERVIEW_CREDIT_VIEW",
    "INTERVIEW_CREDIT_ASSIGN",
    "REPORT_VIEW",
    "REPORT_EXPORT",
    "AUDIT_VIEW",
  ],
  ...overrides,
});

describe("EnterpriseDashboardPage — Offline Loading Management", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. enterpriseLoading Helpers & State Initialization", () => {
    it("correctly identifies offline and demo tokens", () => {
      expect(isOfflineOrDemoToken(null)).toBe(true);
      expect(isOfflineOrDemoToken(undefined)).toBe(true);
      expect(isOfflineOrDemoToken("")).toBe(true);
      expect(isOfflineOrDemoToken("local-session-123")).toBe(true);
      expect(isOfflineOrDemoToken("offline-demo-456")).toBe(true);
      expect(isOfflineOrDemoToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real-token")).toBe(false);
    });

    it("initializes all loading states to false when in an offline/demo session", () => {
      const fullPermissions = {
        canViewStudents: true,
        canViewFaculty: true,
        canViewCredits: true,
        canViewReports: true,
        canViewAuditLogs: true,
      };

      const offlineStates = getInitialLoadingStates("local-demo-token", fullPermissions);
      expect(offlineStates.statsLoading).toBe(false);
      expect(offlineStates.filterOptionsLoading).toBe(false);
      expect(offlineStates.studentsLoading).toBe(false);
      expect(offlineStates.facultyLoading).toBe(false);
      expect(offlineStates.creditsLoading).toBe(false);
      expect(offlineStates.reportsLoading).toBe(false);
      expect(offlineStates.reportSummaryLoading).toBe(false);
      expect(offlineStates.auditLoading).toBe(false);
    });

    it("initializes loading states to true conditionally by permission when online", () => {
      const restrictedPermissions = {
        canViewStudents: true,
        canViewFaculty: false,
        canViewCredits: false,
        canViewReports: true,
        canViewAuditLogs: false,
      };

      const onlineStates = getInitialLoadingStates("jwt-live-token-xyz", restrictedPermissions);
      expect(onlineStates.statsLoading).toBe(true);
      expect(onlineStates.filterOptionsLoading).toBe(true);
      expect(onlineStates.studentsLoading).toBe(true);
      expect(onlineStates.reportsLoading).toBe(true);
      expect(onlineStates.reportSummaryLoading).toBe(true);
      // Restricted tabs must never initialize to true
      expect(onlineStates.facultyLoading).toBe(false);
      expect(onlineStates.creditsLoading).toBe(false);
      expect(onlineStates.auditLoading).toBe(false);
    });

    it("provides safe fallback stats and options for offline mode", () => {
      const stats = getOfflineFallbackStats();
      expect(stats.students.total).toBe(0);
      expect(stats.faculty.total).toBe(0);
      expect(stats.credits.balance).toBe(0);
      expect(stats.interviews.completedSessions).toBe(0);

      const filterOptions = getOfflineFallbackFilterOptions();
      expect(filterOptions.programs).toEqual([]);
      expect(filterOptions.courses).toEqual([]);
      expect(filterOptions.cohorts).toEqual([]);
    });

    it("returns 'Demo mode: Live data is unavailable.' when offline, and standard empty state when online", () => {
      const offlineMsg = getTableEmptyMessage(true, "No records found.");
      expect(offlineMsg).toBe("Demo mode: Live data is unavailable.");

      const onlineMsg = getTableEmptyMessage(false, "No records found.");
      expect(onlineMsg).toBe("No records found.");
    });
  });

  describe("2. Render Behavior in Offline & Demo Mode across all tabs", () => {
    it("renders Overview tab without any loading indicators and displays offline fallback", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "local-demo-token",
          initialTab: "overview",
          onLogout: vi.fn(),
        })
      );

      expect(html).not.toContain("Loading dashboard statistics...");
      expect(html).not.toContain("Loading recently enrolled students...");
      expect(html).toContain("Demo mode: Live data is unavailable.");
      expect(html).toContain("Enrolled Students");
    });

    it("renders Students tab without infinite spinner and shows offline state", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "local-demo-token",
          initialTab: "students",
          onLogout: vi.fn(),
        })
      );

      expect(html).not.toContain("Loading students...");
      expect(html).not.toContain("Loading filter options...");
      expect(html).toContain("Demo mode: Live data is unavailable.");
    });

    it("renders Faculty tab without infinite spinner and shows offline state", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "local-demo-token",
          initialTab: "faculty",
          onLogout: vi.fn(),
        })
      );

      expect(html).not.toContain("Loading faculty members...");
      expect(html).toContain("Demo mode: Live data is unavailable.");
    });

    it("renders Credits tab without infinite spinner and shows offline state", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "local-demo-token",
          initialTab: "credits",
          onLogout: vi.fn(),
        })
      );

      expect(html).not.toContain("Loading credit transactions...");
      expect(html).toContain("Demo mode: Live data is unavailable.");
    });

    it("renders Reports tab without infinite spinner and shows offline state", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "local-demo-token",
          initialTab: "reports",
          onLogout: vi.fn(),
        })
      );

      expect(html).not.toContain("Loading interview evaluations...");
      expect(html).not.toContain("Loading report summary...");
      expect(html).toContain("Demo mode: Live data is unavailable.");
    });

    it("renders Audit tab without infinite spinner and shows offline state", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "local-demo-token",
          initialTab: "audit",
          onLogout: vi.fn(),
        })
      );

      expect(html).not.toContain("Loading audit logs...");
      expect(html).toContain("Demo mode: Live data is unavailable.");
    });

    it("preserves permission barriers in offline/demo mode", () => {
      // Faculty with only STUDENT_VIEW permission
      const restrictedUser = createMockUser({
        role: "college_faculty",
        isMainFaculty: false,
        permissions: ["STUDENT_VIEW"],
      });

      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user: restrictedUser,
          token: "local-demo-token",
          onLogout: vi.fn(),
        })
      );

      // Student directory should be visible
      expect(html).toContain("Students Directory");

      // Restricted sections must NOT be rendered or granted
      expect(html).not.toContain("Faculty Members");
      expect(html).not.toContain("Interview Credits &amp; Allocation");
      expect(html).not.toContain("Cohort Reports &amp; Analytics");
      expect(html).not.toContain("Audit Logs");
    });
  });

  describe("3. Online Session Loading Behavior", () => {
    it("renders with live token initializing loading indicators for pending requests", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "live-jwt-token-12345",
          initialTab: "overview",
          onLogout: vi.fn(),
        })
      );

      // In live mode on initial render, loading indicator should be rendered while fetching
      expect(html).toContain("Loading dashboard statistics...");
      expect(html).toContain("Loading recently enrolled students...");
    });

    it("renders Students tab with loading indicator on live session initial render", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "live-jwt-token-12345",
          initialTab: "students",
          onLogout: vi.fn(),
        })
      );

      expect(html).toContain("Loading students...");
    });

    it("renders Faculty tab with loading indicator on live session initial render", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "live-jwt-token-12345",
          initialTab: "faculty",
          onLogout: vi.fn(),
        })
      );

      expect(html).toContain("Loading faculty...");
    });

    it("renders Credits tab with loading indicator on live session initial render", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "live-jwt-token-12345",
          initialTab: "credits",
          onLogout: vi.fn(),
        })
      );

      expect(html).toContain("Loading credit transactions...");
    });

    it("renders Reports tab with loading indicator on live session initial render", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "live-jwt-token-12345",
          initialTab: "reports",
          onLogout: vi.fn(),
        })
      );

      expect(html).toContain("Loading reports...");
    });

    it("renders Audit tab with loading indicator on live session initial render", () => {
      const user = createMockUser();
      const html = renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "live-jwt-token-12345",
          initialTab: "audit",
          onLogout: vi.fn(),
        })
      );

      expect(html).toContain("Loading institutional audit logs...");
    });
  });

  describe("4. API Call Skipping & Offline Integrity", () => {
    it("never initiates backend network requests when token is local or offline", async () => {
      const getStatsSpy = vi.spyOn(backendApi.enterprise, "getStats").mockResolvedValue({
        students: { total: 10, active: 10 },
        faculty: { total: 2, active: 2 },
        credits: { balance: 50, totalAllocated: 100, totalDistributed: 50 },
        interviews: { totalSessions: 5, completedSessions: 5, avgScore: 85 },
      });
      const getFilterOptionsSpy = vi.spyOn(backendApi.enterprise, "getFilterOptions").mockResolvedValue({
        programs: [],
        courses: [],
        sections: [],
        batches: [],
        departments: [],
        cohorts: [],
      });
      const listStudentsSpy = vi.spyOn(backendApi.enterprise, "listStudents").mockResolvedValue({
        students: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      const user = createMockUser({ email: "regular_user@example.com" });
      renderToStaticMarkup(
        createElement(EnterpriseDashboardPage, {
          user,
          token: "local-demo-token",
          onLogout: vi.fn(),
        })
      );

      // In offline mode, loaders must not call backend APIs
      expect(getStatsSpy).not.toHaveBeenCalled();
      expect(getFilterOptionsSpy).not.toHaveBeenCalled();
      expect(listStudentsSpy).not.toHaveBeenCalled();
    });
  });
});
