export interface EnterpriseReportStudent {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  enrollmentNumber: string;
  program: string;
  course: string;
  section: string;
  batch: string;
}

export interface EnterpriseReportRow {
  id: string; // Canonical report ID
  reportId: string;
  sessionId: string;

  student: EnterpriseReportStudent;

  targetRole: string;
  difficulty: string;
  interviewStyle?: string;
  durationMins?: number;

  overallScore: number;
  readinessRating: "Job-Ready" | "Moderate" | "Needs Practice";
  categoryScores?: Record<string, number>;
  speakingPace: number | null;
  fillerWords: number | null;
  createdAt: string;

  // Backward compatibility fields for legacy consumers
  name?: string;
  enrollmentNumber?: string;
  program?: string;
  course?: string;
  section?: string;
  batch?: string;
  averageScore?: number | null;
  latestScore?: number | null;
  latestTargetRole?: string | null;
  latestInterviewDate?: string | null;
  session?: {
    id: string;
    targetRole: string;
    difficulty: string;
    user: {
      name: string;
      studentProfile?: {
        enrollmentNumber: string;
        program: string;
      };
    };
  };
}

export interface EnterpriseReportsResponse {
  success: boolean;
  reports: EnterpriseReportRow[];
  data: EnterpriseReportRow[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    totalReports: number;
    totalStudentsInView: number;
    cohortAverage: number;
    jobReadyCount: number;
    moderateCount: number;
    needsPracticeCount: number;
  };
}
