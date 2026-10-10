/**
 * Enterprise Report Filtering & Query Builders
 * Shared across report listing, metrics summary, and CSV/XLSX export.
 */

export interface BuildReportFiltersOptions {
  institutionId?: string;
  collegeId?: string;
  facultyScope?: any;
  scopeConditions?: any;
  search?: string;
  program?: string;
  course?: string;
  section?: string;
  batch?: string;
  status?: string;
  scoreTier?: string;
  minScore?: number | string;
  maxScore?: number | string;
  startDate?: string | Date;
  endDate?: string | Date;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  reportType?: string;
}

export interface BuildStudentFiltersOptions {
  institutionId?: string;
  collegeId?: string;
  facultyScope?: any;
  scopeConditions?: any;
  search?: string;
  program?: string;
  course?: string;
  section?: string;
  batch?: string;
  status?: string;
}

/**
 * Builds scoped student where clause enforcing tenant isolation and faculty restrictions.
 */
export function buildScopedStudentWhere(
  collegeId: string,
  scopeConditions: any = {},
  filters: any = {}
): Record<string, any> {
  const clauses = [scopeConditions, filters].filter(
    (clause) => clause && typeof clause === "object" && Object.keys(clause).length > 0
  );
  return clauses.length > 0 ? { collegeId, AND: clauses } : { collegeId };
}

/**
 * Shared report query builder for both report listing and report export.
 * Enforces:
 *  - Strict institution isolation (collegeId)
 *  - Faculty scope conditions (AND)
 *  - Cohort filters: status, program, course, section, batch (AND)
 *  - Case-insensitive search across student name, email, roll/enrollment number, targetRole, and interviewStyle (OR)
 *  - Score tier, min/max score, date range, and report type (AND)
 */
export function buildReportFilters(options: BuildReportFiltersOptions): Record<string, any> {
  const collegeId = options.institutionId || options.collegeId;
  if (!collegeId) {
    throw new Error("institutionId or collegeId is required to build report filters");
  }

  const scopeConditions = options.facultyScope || options.scopeConditions || {};

  const studentFilters: Record<string, any> = {};
  if (options.status) studentFilters.status = options.status;
  if (options.program) studentFilters.program = options.program;
  if (options.course) studentFilters.course = options.course;
  if (options.section) studentFilters.section = options.section;
  if (options.batch) studentFilters.batch = options.batch;

  const scopedStudentWhere = buildScopedStudentWhere(collegeId, scopeConditions, studentFilters);

  const where: Record<string, any> = {
    session: {
      status: "completed",
      user: {
        studentProfile: scopedStudentWhere,
      },
    },
  };

  const andClauses: any[] = [];

  // Search logic across student identity and report-specific fields (OR semantics)
  const search = (options.search || "").trim();
  if (search) {
    andClauses.push({
      OR: [
        { session: { user: { name: { contains: search, mode: "insensitive" } } } },
        { session: { user: { email: { contains: search, mode: "insensitive" } } } },
        { session: { user: { studentProfile: { enrollmentNumber: { contains: search, mode: "insensitive" } } } } },
        { session: { targetRole: { contains: search, mode: "insensitive" } } },
        { session: { interviewStyle: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  // Report type / interview style filter
  const reportType = (options.reportType || "").trim();
  if (reportType) {
    andClauses.push({
      OR: [
        { session: { interviewStyle: { contains: reportType, mode: "insensitive" } } },
        { session: { targetRole: { contains: reportType, mode: "insensitive" } } },
      ],
    });
  }

  // Score tier filtering
  if (options.scoreTier) {
    if (options.scoreTier === "high") {
      where.overallScore = { ...(where.overallScore || {}), gte: 80 };
    } else if (options.scoreTier === "moderate") {
      where.overallScore = { ...(where.overallScore || {}), gte: 60, lt: 80 };
    } else if (options.scoreTier === "needs_improvement") {
      where.overallScore = { ...(where.overallScore || {}), lt: 60 };
    }
  }

  // Min / Max score filtering
  const minScore =
    options.minScore !== undefined && options.minScore !== null && options.minScore !== ""
      ? parseFloat(String(options.minScore))
      : undefined;
  const maxScore =
    options.maxScore !== undefined && options.maxScore !== null && options.maxScore !== ""
      ? parseFloat(String(options.maxScore))
      : undefined;

  if (minScore !== undefined && !isNaN(minScore)) {
    where.overallScore = { ...(where.overallScore || {}), gte: minScore };
  }
  if (maxScore !== undefined && !isNaN(maxScore)) {
    where.overallScore = { ...(where.overallScore || {}), lte: maxScore };
  }

  // Date filtering (supports startDate/endDate and dateFrom/dateTo aliases)
  const rawStartDate = options.startDate || options.dateFrom;
  const rawEndDate = options.endDate || options.dateTo;
  if (rawStartDate) {
    const d = new Date(rawStartDate);
    if (!isNaN(d.getTime())) {
      where.createdAt = { ...(where.createdAt || {}), gte: d };
    }
  }
  if (rawEndDate) {
    const d = new Date(rawEndDate);
    if (!isNaN(d.getTime())) {
      where.createdAt = { ...(where.createdAt || {}), lte: d };
    }
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  return where;
}

/**
 * Shared student query builder for student view listing and export.
 */
export function buildStudentFilters(options: BuildStudentFiltersOptions): Record<string, any> {
  const collegeId = options.institutionId || options.collegeId;
  if (!collegeId) {
    throw new Error("institutionId or collegeId is required to build student filters");
  }

  const scopeConditions = options.facultyScope || options.scopeConditions || {};

  const studentFilters: Record<string, any> = {};
  if (options.status) studentFilters.status = options.status;
  if (options.program) studentFilters.program = options.program;
  if (options.course) studentFilters.course = options.course;
  if (options.section) studentFilters.section = options.section;
  if (options.batch) studentFilters.batch = options.batch;

  const scopedWhere = buildScopedStudentWhere(collegeId, scopeConditions, studentFilters);
  const search = (options.search || "").trim();
  if (!search) {
    return scopedWhere;
  }

  return {
    ...scopedWhere,
    OR: [
      { enrollmentNumber: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ],
  };
}
