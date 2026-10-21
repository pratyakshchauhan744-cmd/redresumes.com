import studentInterviewRoutes from "./student-interview-routes.js";
import { studentSummarySelect, serializeStudentSummary, studentScoreAverages, evaluatedSessions } from "./student-reports.js";
import { studentCreationSchema, studentUpdateSchema, validateReportQuery } from "./input-validation.js";
import { publicStudentEmailError } from "../../utils/student-email-error.js";
import { assertStudentCreditAuthorization, assertRequestStudentCreditAuthorization } from "./student-credit-authorization.js";
import {
  CreditIdempotencyError,
  requireCreditIdempotencyKey,
  parseOptionalIdempotencyKey,
  creditPayloadHash,
  executeIdempotentCreditOperation,
} from "./credit-idempotency.js";
import {
  buildScopedStudentWhere,
  buildReportFilters,
  buildStudentFilters,
} from "./report-filters.js";
export { buildScopedStudentWhere, buildReportFilters, buildStudentFilters };
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import multer from "multer";
import * as xlsx from "xlsx";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  requireTenant,
  requireCollegeAdmin,
  requireEnterpriseAccess,
  requireAnyEnterprisePermission,
  resolveEnterpriseAuthorization,
  requirePermission,
  resolveEnterprisePermission,
} from "../../middleware/tenant.js";
import { EmailService } from "../../services/email.service.js";
import { logEnterpriseAudit } from "../../services/audit.service.js";
import { env } from "../../config/env.js";
import { isUniqueConstraintError, normalizeEmailIdentity } from "../../utils/identity.js";
import { getReadinessCategory, resolveCanonicalReportScore, normalizeReportScore } from "../../utils/score.js";
import { sanitizeAuditValue } from "../../utils/audit-sanitization.js";
import {
  EnterpriseReportRow,
  EnterpriseReportsResponse,
} from "../../types/enterpriseReports.js";
import {
  EnterpriseAuditLogsResponse,
  EnterpriseAuditLog,
  resolveCanonicalAuditAction,
} from "../../types/enterpriseAudit.js";
import {
  ASSIGNABLE_FACULTY_PERMISSIONS,
  DEFAULT_FACULTY_PERMISSIONS,
  FORBIDDEN_FACULTY_ASSIGNMENT_FIELDS,
  FacultyAuthorizationError,
  assertCanDeactivateFaculty,
  assertCanGrantPermissions,
  assertCanModifyFaculty,
  assertCanModifyFacultyAuthorization,
  assertNoForbiddenFacultyAssignmentFields,
  hasFacultyAuthorizationChanges,
  isPrivilegedFacultyActor,
  type FacultyMutationActor,
} from "./faculty-authorization.js";
import {
  allocateInstitutionCreditsToStudent,
  allocateInstitutionCreditsToStudentsBulk,
  assertValidCreditAmount,
} from "./credit-transfer.js";
import {
  buildFacultyStudentScopeConditions,
  isStudentWithinFacultyScope,
  parseFacultyCohortAccess,
  type FacultyStudentScope,
} from "./student-scope-authorization.js";

const router = Router();

const facultyCohortAccessSchema = z.array(z.object({
  program: z.string().min(1),
  course: z.string().min(1),
  section: z.string().min(1),
  batch: z.string().min(1),
}).strict());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const resendInvitationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many invitation email requests. Please try again in 15 minutes.",
  },
});

// Enforce authentication and active college tenant context for all enterprise routes
router.use(requireAuth, requireTenant, requireEnterpriseAccess);

// Zero-Trust Security Guard: Block student and candidate roles from accessing any enterprise routes
router.use((req, res, next) => {
  if (req.user?.role === "student" || req.user?.role === "candidate") {
    return res.status(403).json({
      success: false,
      error: "Access denied. Students and candidates cannot access enterprise college management endpoints.",
    });
  }
  next();
});

router.use(studentInterviewRoutes);

const facultyProfileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  permissions: z.array(z.enum(ASSIGNABLE_FACULTY_PERMISSIONS)).optional(),
  programAccess: z.array(z.string()).optional(),
  courseAccess: z.array(z.string()).optional(),
  sectionAccess: z.array(z.string()).optional(),
  batchAccess: z.array(z.string()).optional(),
  scopeUnrestricted: z.boolean().optional(),
  cohortAccess: facultyCohortAccessSchema.optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
}).strict();

function hasOwn(body: unknown, field: string): boolean {
  return Boolean(body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, field));
}

async function getTrustedFacultyMutationActor(req: Request): Promise<FacultyMutationActor> {
  const authorization = await resolveEnterpriseAuthorization(req);
  return {
    userId: req.user!.id, collegeId: req.collegeId!, role: req.user!.role,
    isMainFaculty: req.user!.role !== "super_admin" && authorization.root,
    status: "active", permissions: authorization.permissions,
  };
}

function sendFacultyAuthorizationError(res: Response, error: unknown): boolean {
  if (!(error instanceof FacultyAuthorizationError)) return false;
  res.status(error.status).json({ success: false, message: error.message });
  return true;
}

/**
 * Resolves query constraints based on the logged-in faculty's assigned scope.
 * If the user is a super admin or main faculty, no restrictions are applied.
 * If the user is a regular faculty with program/course/section restrictions,
 * the query is constrained to those allowed values.
 */
// Authorization scope is always read from the primary database. Removing the
// process-local TTL cache makes revocation consistent across backend instances.

async function getFacultyStudentScope(
  userId: string,
  collegeId: string,
  isSuperAdmin?: boolean,
  _fresh = false
): Promise<FacultyStudentScope> {
  if (isSuperAdmin) {
    return {
      collegeId,
      hasAccess: true,
      unrestricted: true,
      programAccess: [],
      courseAccess: [],
      sectionAccess: [],
      batchAccess: [],
      scopeUnrestricted: true,
      cohortAccess: [],
    };
  }

  const faculty = await prisma.collegeFaculty.findFirst({
    where: { userId, collegeId, status: "active" },
    select: {
      isMainFaculty: true,
      programAccess: true,
      courseAccess: true,
      sectionAccess: true,
      batchAccess: true,
      scopeUnrestricted: true,
      cohortAccess: true,
    },
  });
  if (!faculty) {
    return {
      collegeId,
      hasAccess: false,
      unrestricted: false,
      programAccess: [],
      courseAccess: [],
      sectionAccess: [],
      batchAccess: [],
      scopeUnrestricted: false,
      cohortAccess: null,
    };
  }

  const scope: FacultyStudentScope = {
    collegeId,
    hasAccess: true,
    unrestricted: faculty.isMainFaculty,
    programAccess: faculty.programAccess,
    courseAccess: faculty.courseAccess,
    sectionAccess: faculty.sectionAccess,
    batchAccess: faculty.batchAccess,
    scopeUnrestricted: faculty.scopeUnrestricted,
    cohortAccess: parseFacultyCohortAccess(faculty.cohortAccess),
  };

  return scope;
}

// Scope and permissions come from the same live request snapshot. Read responses
// still recheck that snapshot before sending, so concurrent revocations fail closed.
async function getRequestFacultyScopeConditions(req: Request) {
  const authorization = await resolveEnterpriseAuthorization(req);
  return buildFacultyStudentScopeConditions(authorization.studentScope);
}

async function getFacultyScopeConditions(
  userId: string,
  collegeId: string,
  isSuperAdmin?: boolean,
  fresh = false
) {
  const scope = await getFacultyStudentScope(userId, collegeId, isSuperAdmin, fresh);
  return buildFacultyStudentScopeConditions(scope);
}

async function facultyCanAccessStudent(
  userId: string,
  collegeId: string,
  studentId: string,
  isSuperAdmin?: boolean,
  fresh = false
) {
  const scopeConditions = await getFacultyScopeConditions(userId, collegeId, isSuperAdmin, fresh);
  return prisma.collegeStudent.findFirst({
    where: buildScopedStudentWhere(collegeId, scopeConditions, { id: studentId }),
    select: { id: true },
  });
}

// ===========================================================================
// 0. METADATA & DYNAMIC FILTER OPTIONS
// ===========================================================================

// GET /api/enterprise/filter-options - Distinct programs, courses, sections, batches, and departments
router.get("/filter-options", requireAnyEnterprisePermission([
  "STUDENT_VIEW", "STUDENT_CREATE", "STUDENT_EDIT", "FACULTY_VIEW",
  "FACULTY_CREATE", "FACULTY_EDIT", "INTERVIEW_CREDIT_VIEW",
  "INTERVIEW_CREDIT_ASSIGN", "REPORT_VIEW",
]), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getRequestFacultyScopeConditions(req);

    // GROUP BY deduplicates in PostgreSQL, before rows reach Prisma. Derive
    // single-field options from the much smaller set of cohort tuples.
    const where = buildScopedStudentWhere(collegeId, scopeConditions);
    const [cohorts, departments] = await Promise.all([
      prisma.collegeStudent.groupBy({
        by: ["program", "course", "section", "batch"],
        where,
        orderBy: [
          { program: "asc" }, { course: "asc" },
          { section: "asc" }, { batch: "desc" },
        ],
      }),
      prisma.collegeStudent.groupBy({
        by: ["department"],
        where: { ...where, department: { not: null } },
        orderBy: { department: "asc" },
      }),
    ]);
    const optionValues = (field: "program" | "course" | "section" | "batch") =>
      [...new Set(cohorts.map((cohort) => cohort[field]).filter(Boolean))].sort();

    res.json({
      success: true,
      programs: optionValues("program"),
      courses: optionValues("course"),
      sections: optionValues("section"),
      batches: optionValues("batch").reverse(),
      departments: departments.map((d) => d.department).filter(Boolean) as string[],
      cohorts,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================================================
// 1. DASHBOARD OVERVIEW METRICS
// ===========================================================================

/**
 * Shared handler for GET /api/enterprise/stats and /api/enterprise/dashboard/stats
 * Returns stats in format expected by EnterpriseDashboardPage frontend:
 * { college, students: { total, active }, faculty: { total, active }, credits: { balance, totalAllocated, totalDistributed }, interviews: { totalSessions, completedSessions, avgScore } }
 */
async function handleEnterpriseStats(req: any, res: any, next: any) {
  try {
    const collegeId = req.collegeId!;
    const authorization = await resolveEnterpriseAuthorization(req);
    const can = (permission: string) => authorization.root ||
      authorization.permissions.includes("all") || authorization.permissions.includes(permission);
    const scopeConditions = await getRequestFacultyScopeConditions(req);

    const studentWhere = buildScopedStudentWhere(collegeId, scopeConditions);
    const interviewWhere = {
      collegeId,
      user: { studentProfile: { is: studentWhere } },
    };
    const [college, studentCounts, facultyCounts, creditAccount,
      interviewSessionsCount, reportsGeneratedCount, scoreGroups, avgResult] = await Promise.all([
      prisma.college.findUnique({
        where: { id: collegeId },
        select: { id: true, name: true, code: true, universityName: true },
      }),
      can("STUDENT_VIEW") ? prisma.collegeStudent.groupBy({
        by: ["status"], where: studentWhere, _count: { _all: true },
      }) : [],
      can("FACULTY_VIEW") ? prisma.collegeFaculty.groupBy({
        by: ["status"], where: { collegeId }, _count: { _all: true },
      }) : [],
      can("INTERVIEW_CREDIT_VIEW")
        ? prisma.collegeCreditAccount.findUnique({ where: { collegeId } }) : null,
      can("REPORT_VIEW") ? prisma.interviewSession.count({ where: interviewWhere }) : 0,
      can("REPORT_VIEW") ? prisma.interviewSession.count({
        where: { ...interviewWhere, report: { isNot: null } },
      }) : 0,
      can("REPORT_VIEW") ? prisma.interviewReport.groupBy({
        by: ["overallScore", "scoreScale"],
        where: { session: interviewWhere },
        _count: { _all: true },
      }) : [],
      can("REPORT_VIEW") ? prisma.interviewReport.aggregate({
        _avg: { overallScore: true }, where: { session: interviewWhere },
      }) : null,
    ]);
    const totalStudents = studentCounts.reduce((sum, row) => sum + row._count._all, 0);
    const activeStudents = studentCounts.find((row) => row.status === "active")?._count._all ?? 0;
    const totalFaculty = facultyCounts.reduce((sum, row) => sum + row._count._all, 0);
    const activeFaculty = facultyCounts.find((row) => row.status === "active")?._count._all ?? 0;
    let avgScore = 0;
    if (scoreGroups && Array.isArray(scoreGroups) && scoreGroups.length > 0) {
      let totalValidReports = 0;
      let scoreSum = 0;
      for (const group of scoreGroups) {
        const canonical = normalizeReportScore(group);
        if (canonical !== null) {
          const count = group._count?._all ?? 0;
          totalValidReports += count;
          scoreSum += canonical * count;
        }
      }
      avgScore = totalValidReports > 0 ? Math.round(scoreSum / totalValidReports) : 0;
    } else if (avgResult?._avg?.overallScore !== null && avgResult?._avg?.overallScore !== undefined) {
      avgScore = Math.round(avgResult._avg.overallScore);
    }

    // Response format that matches EnterpriseDashboardPage frontend expectations
    res.json({
      success: true,
      college: {
        id: college?.id,
        name: college?.name,
        code: college?.code,
        universityName: college?.universityName,
      },
      // Top-level stats keys for frontend KPI cards
      students: {
        total: can("STUDENT_VIEW") ? totalStudents : 0,
        active: can("STUDENT_VIEW") ? activeStudents : 0,
      },
      faculty: {
        total: can("FACULTY_VIEW") ? totalFaculty : 0,
        active: can("FACULTY_VIEW") ? activeFaculty : 0,
      },
      credits: {
        balance: can("INTERVIEW_CREDIT_VIEW") ? creditAccount?.balance ?? 0 : 0,
        totalAllocated: can("INTERVIEW_CREDIT_VIEW") ? creditAccount?.totalAllocated ?? 0 : 0,
        totalDistributed: can("INTERVIEW_CREDIT_VIEW") ? creditAccount?.totalDistributed ?? 0 : 0,
      },
      interviews: {
        totalSessions: can("REPORT_VIEW") ? interviewSessionsCount : 0,
        completedSessions: can("REPORT_VIEW") ? reportsGeneratedCount : 0,
        avgScore: can("REPORT_VIEW") ? avgScore : 0,
      },
      // Legacy stats object for backward compat
      stats: {
        totalStudents: can("STUDENT_VIEW") ? totalStudents : 0,
        activeStudents: can("STUDENT_VIEW") ? activeStudents : 0,
        totalFaculty: can("FACULTY_VIEW") ? totalFaculty : 0,
        availableCredits: can("INTERVIEW_CREDIT_VIEW") ? creditAccount?.balance ?? 0 : 0,
        totalCreditsAllocated: can("INTERVIEW_CREDIT_VIEW") ? creditAccount?.totalAllocated ?? 0 : 0,
        totalCreditsDistributed: can("INTERVIEW_CREDIT_VIEW") ? creditAccount?.totalDistributed ?? 0 : 0,
        totalInterviewSessions: can("REPORT_VIEW") ? interviewSessionsCount : 0,
        reportsGenerated: can("REPORT_VIEW") ? reportsGeneratedCount : 0,
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/enterprise/stats - Primary route (matches frontend API call)
const statsPermissions = ["STUDENT_VIEW", "FACULTY_VIEW", "INTERVIEW_CREDIT_VIEW", "REPORT_VIEW"];
router.get("/stats", requireAnyEnterprisePermission(statsPermissions), handleEnterpriseStats);

// GET /api/enterprise/dashboard/stats - Legacy route alias
router.get("/dashboard/stats", requireAnyEnterprisePermission(statsPermissions), handleEnterpriseStats);

// ===========================================================================
// 2. FACULTY / EMPLOYEE MANAGEMENT
// ===========================================================================

// GET /api/enterprise/faculty - List faculties
router.get("/faculty", requirePermission("FACULTY_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const search = ((req.query.search as string) || "").trim();
    const department = req.query.department as string;
    const status = req.query.status as string;

    const where: any = { collegeId };
    if (status) where.status = status;
    if (department) where.department = department;

    if (search) {
      where.OR = [
        { employeeId: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
        { designation: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, faculties] = await Promise.all([
      prisma.collegeFaculty.count({ where }),
      prisma.collegeFaculty.findMany({
        relationLoadStrategy: "join",
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isMainFaculty: "desc" }, { createdAt: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              isActive: true,
            },
          },
        },
      }),
    ]);

    const mappedFaculties = faculties.map((f) => ({
      id: f.id,
      userId: f.userId,
      name: f.user.name,
      email: f.user.email,
      phone: f.user.phone,
      user: {
        id: f.user.id,
        name: f.user.name,
        email: f.user.email,
        phone: f.user.phone,
      },
      employeeId: f.employeeId,
      department: f.department,
      designation: f.designation,
      isMainFaculty: f.isMainFaculty,
      permissions: f.permissions,
      programAccess: f.programAccess,
      courseAccess: f.courseAccess,
      sectionAccess: f.sectionAccess,
      batchAccess: f.batchAccess,
      scopeUnrestricted: f.scopeUnrestricted,
      cohortAccess: parseFacultyCohortAccess(f.cohortAccess),
      status: f.status,
      createdAt: f.createdAt,
    }));

    res.json({
      success: true,
      // 'faculty' key matches EnterpriseDashboardPage frontend expectation
      faculty: mappedFaculties,
      // Also expose as 'data' for backward compat
      data: mappedFaculties,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/enterprise/faculty - Add employee/faculty
router.post("/faculty", requirePermission("FACULTY_CREATE"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const actor = await getTrustedFacultyMutationActor(req);
    const forbiddenCreateField = FORBIDDEN_FACULTY_ASSIGNMENT_FIELDS.find(
      (field) => field !== "isMainFaculty" && field !== "email" && hasOwn(req.body, field)
    );
    if (forbiddenCreateField || (hasOwn(req.body, "isMainFaculty") && req.body.isMainFaculty !== false)) {
      throw new FacultyAuthorizationError(
        `Field "${forbiddenCreateField ?? "isMainFaculty"}" cannot be assigned through the faculty creation endpoint.`
      );
    }
    const college = req.college ?? await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) {
      return res.status(404).json({ success: false, message: "College tenant not found." });
    }

    const schema = z.object({
      name: z.string().min(2, "Name is required"),
      email: z.string().trim().email("Valid email is required"),
      phone: z.string().optional(),
      employeeId: z.string().optional(),
      department: z.string().optional(),
      designation: z.string().optional().default("Assistant Professor"),
      isMainFaculty: z.literal(false).optional(),
      permissions: z.array(z.enum(ASSIGNABLE_FACULTY_PERMISSIONS)).optional(),
      programAccess: z.array(z.string()).optional(),
      courseAccess: z.array(z.string()).optional(),
      sectionAccess: z.array(z.string()).optional(),
      batchAccess: z.array(z.string()).optional(),
      scopeUnrestricted: z.boolean().optional(),
      cohortAccess: facultyCohortAccessSchema.optional(),
    }).strict();

    const parsedData = schema.parse(req.body);
    const data = { ...parsedData, email: normalizeEmailIdentity(parsedData.email) };
    const requestsAuthorization = [
      "permissions",
      "programAccess",
      "courseAccess",
      "sectionAccess",
      "batchAccess",
      "scopeUnrestricted",
      "cohortAccess",
    ]
      .some((field) => hasOwn(req.body, field));

    if (requestsAuthorization && !isPrivilegedFacultyActor(actor)) {
      throw new FacultyAuthorizationError(
        "Only the Main Faculty administrator can assign permissions or access scope when creating faculty."
      );
    }

    const permissions = data.permissions ??
      (isPrivilegedFacultyActor(actor) ? [...DEFAULT_FACULTY_PERMISSIONS] : []);
    assertCanGrantPermissions(actor, permissions);

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered. Use the existing faculty management flow instead.",
      });
    }

    // The bootstrap secret is deliberately never disclosed. The invited
    // faculty member chooses their real password only after token acceptance.
    const bootstrapSecret = crypto.randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(bootstrapSecret, 8);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            passwordHash,
            role: "college_faculty",
            collegeId,
            isActive: false,
          },
        });

        const facultyProfile = await tx.collegeFaculty.create({
          data: {
            userId: user.id,
            collegeId,
            employeeId: data.employeeId,
            department: data.department,
            designation: data.designation,
            isMainFaculty: false,
            permissions,
            programAccess: data.programAccess ?? [],
            courseAccess: data.courseAccess ?? [],
            sectionAccess: data.sectionAccess ?? [],
            batchAccess: data.batchAccess ?? [],
            scopeUnrestricted: data.scopeUnrestricted ?? true,
            cohortAccess: data.cohortAccess ?? [],
            status: "invited",
          },
        });

        const invitation = await tx.invitation.create({
          data: {
            collegeId,
            email: data.email,
            role: "college_faculty",
            tokenHash,
            expiresAt,
            status: "pending",
            invitedById: req.user!.id,
            metadata: {
              purpose: "faculty_activation",
              deliveryStatus: "pending",
              name: data.name,
              employeeId: data.employeeId,
              department: data.department,
              designation: data.designation,
              permissions,
            },
          },
        });

        return { user, facultyProfile, invitation };
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    // Send invitation email
    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    const activationLink = `${frontendUrl}/login?invite=${rawToken}&email=${encodeURIComponent(data.email)}`;

    let invitationSent = false;
    try {
      const deliveryResult = await EmailService.sendFacultyInvitation({
        to: data.email,
        recipientName: data.name,
        collegeName: college.name,
        isMainFaculty: false,
        activationLink,
      });
      invitationSent = deliveryResult.success;
      if (!deliveryResult.success) {
        console.error("Faculty creation committed but invitation delivery failed.", {
          facultyId: result.facultyProfile.id,
          invitationId: result.invitation.id,
          reason: deliveryResult.error || "Email provider rejected the request",
        });
      }
    } catch (mailError: any) {
      console.error("Faculty creation committed but invitation delivery threw an error.", {
        facultyId: result.facultyProfile.id,
        invitationId: result.invitation.id,
        reason: mailError?.message || "Unknown email delivery error",
      });
    }

    await prisma.invitation.updateMany({
      where: { id: result.invitation.id, status: "pending" },
      data: {
        metadata: {
          purpose: "faculty_activation",
          deliveryStatus: invitationSent ? "sent" : "failed",
          name: data.name,
          employeeId: data.employeeId,
          department: data.department,
          designation: data.designation,
          permissions,
          ...(invitationSent ? { sentAt: new Date().toISOString() } : {}),
        },
      },
    }).catch((statusError) => {
      console.error("Failed to record faculty invitation delivery status.", {
        facultyId: result.facultyProfile.id,
        invitationId: result.invitation.id,
        reason: statusError instanceof Error ? statusError.message : "Unknown database error",
      });
    });

    await logEnterpriseAudit({
      collegeId,
      actorId: req.user!.id,
      action: "FACULTY_CREATED",
      entity: "CollegeFaculty",
      entityId: result.facultyProfile.id,
      newValue: {
        name: data.name,
        email: data.email,
        department: data.department,
        permissions,
        invitationSent,
      },
    });

    res.status(201).json({
      success: true,
      facultyCreated: true,
      invitationSent,
      invitationStatus: invitationSent ? "sent" : "delivery_failed",
      message: invitationSent
        ? `Faculty member "${data.name}" added and invited successfully.`
        : `Faculty member "${data.name}" was created, but the invitation email could not be sent.`,
      ...(!invitationSent && {
        warning: "Faculty was created, but the invitation email could not be sent. Use Resend Invitation from the faculty list; do not create the account again.",
      }),
      faculty: result.facultyProfile,
    });
  } catch (error) {
    if (sendFacultyAuthorizationError(res, error)) return;
    next(error);
  }
});

// Rotate and resend a faculty activation link without recreating the account or
// changing its password.
router.post(
  "/faculty/:id/resend-invite",
  requirePermission("FACULTY_CREATE"),
  resendInvitationLimiter,
  async (req, res, next) => {
    try {
      const collegeId = req.collegeId!;
      const actor = await getTrustedFacultyMutationActor(req);
      const faculty = await prisma.collegeFaculty.findUnique({
        where: { id: req.params.id },
        include: { user: true, college: true },
      });

      if (!faculty || faculty.collegeId !== collegeId) {
        return res.status(404).json({ success: false, message: "Faculty member not found in your college." });
      }
      assertCanModifyFaculty(actor, faculty);
      if (faculty.status !== "invited" || faculty.user.isActive) {
        return res.status(409).json({
          success: false,
          message: "This faculty account is already active or is not awaiting invitation acceptance.",
        });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invitation = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT "id" FROM "User" WHERE "id" = ${faculty.userId} FOR UPDATE
        `);
        await tx.invitation.updateMany({
          where: {
            collegeId,
            email: faculty.user.email,
            role: "college_faculty",
            status: { in: ["pending", "sent"] },
          },
          data: { status: "revoked" },
        });
        return tx.invitation.create({
          data: {
            collegeId,
            email: faculty.user.email,
            role: "college_faculty",
            tokenHash,
            expiresAt,
            status: "pending",
            invitedById: req.user!.id,
            metadata: {
              purpose: "faculty_activation",
              deliveryStatus: "pending",
              name: faculty.user.name,
              employeeId: faculty.employeeId,
              department: faculty.department,
              designation: faculty.designation,
              permissions: faculty.permissions,
            },
          },
        });
      });

      const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
      const activationLink = `${frontendUrl}/login?invite=${rawToken}&email=${encodeURIComponent(faculty.user.email)}`;
      let deliveryResult: Awaited<ReturnType<typeof EmailService.sendFacultyInvitation>>;
      try {
        deliveryResult = await EmailService.sendFacultyInvitation({
          to: faculty.user.email,
          recipientName: faculty.user.name,
          collegeName: faculty.college.name,
          isMainFaculty: faculty.isMainFaculty,
          activationLink,
        });
      } catch (mailError: any) {
        deliveryResult = { success: false, error: mailError?.message || "Email delivery failed" };
      }

      await prisma.invitation.updateMany({
        where: { id: invitation.id, status: "pending" },
        data: {
          metadata: {
            purpose: "faculty_activation",
            deliveryStatus: deliveryResult.success ? "sent" : "failed",
            name: faculty.user.name,
            employeeId: faculty.employeeId,
            ...(deliveryResult.success ? { sentAt: new Date().toISOString() } : {}),
          },
        },
      }).catch((statusError) => {
        console.error("Failed to record resent faculty invitation delivery status.", {
          facultyId: faculty.id,
          invitationId: invitation.id,
          reason: statusError instanceof Error ? statusError.message : "Unknown database error",
        });
      });

      if (!deliveryResult.success) {
        console.error("Faculty invitation resend failed.", {
          facultyId: faculty.id,
          invitationId: invitation.id,
          reason: deliveryResult.error || "Email provider rejected the request",
        });
        return res.status(502).json({
          success: false,
          invitationSent: false,
          invitationStatus: "delivery_failed",
          message: "Unable to send the faculty invitation. The account and its credentials were not changed.",
        });
      }

      await logEnterpriseAudit({
        collegeId,
        actorId: req.user!.id,
        action: "FACULTY_INVITATION_RESENT",
        entity: "CollegeFaculty",
        entityId: faculty.id,
        newValue: { invitationSent: true },
      });
      return res.json({
        success: true,
        invitationSent: true,
        invitationStatus: "sent",
        message: `Invitation email sent to ${faculty.user.email}.`,
      });
    } catch (error) {
      if (sendFacultyAuthorizationError(res, error)) return;
      next(error);
    }
  }
);

// PATCH/PUT /api/enterprise/faculty/:id - Update allowlisted faculty fields.
// Both methods use the same authorization path so aliases cannot drift apart.
const handleFacultyUpdate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collegeId = req.collegeId!;
    const { id } = req.params;
    const actor = await getTrustedFacultyMutationActor(req);

    const faculty = await prisma.collegeFaculty.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!faculty || faculty.collegeId !== collegeId) {
      return res.status(404).json({ success: false, message: "Faculty member not found in your college." });
    }

    assertCanModifyFaculty(actor, faculty);

    assertNoForbiddenFacultyAssignmentFields(req.body);

    const data = facultyProfileUpdateSchema.parse(req.body);
    const requestsAuthorizationChange = hasFacultyAuthorizationChanges(req.body);
    if (requestsAuthorizationChange) {
      assertCanModifyFacultyAuthorization(actor, faculty, data.permissions);
    }

    if (faculty.isMainFaculty && data.status && data.status !== "active") {
      throw new FacultyAuthorizationError("The Main Faculty account cannot be suspended or deactivated here.");
    }

    const [updated] = await prisma.$transaction(
      async (tx) => {
        const updatedFaculty = await tx.collegeFaculty.update({
          where: { id },
          data: {
            employeeId: data.employeeId,
            department: data.department,
            designation: data.designation,
            permissions: data.permissions,
            programAccess: data.programAccess,
            courseAccess: data.courseAccess,
            sectionAccess: data.sectionAccess,
            batchAccess: data.batchAccess,
            scopeUnrestricted: data.scopeUnrestricted,
            cohortAccess: data.cohortAccess,
            status: data.status,
          },
        });

        // Synchronize User profile details and active status
        const userUpdates: any = {};
        if (data.name) userUpdates.name = data.name;
        if (data.phone !== undefined) userUpdates.phone = data.phone;
        if (data.status) {
          userUpdates.isActive = data.status === "active";
        }

        if (Object.keys(userUpdates).length > 0) {
          await tx.user.update({
            where: { id: faculty.userId },
            data: userUpdates,
          });
        }

        return [updatedFaculty];
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    await logEnterpriseAudit({
      collegeId,
      actorId: req.user!.id,
      action: "FACULTY_UPDATED",
      entity: "CollegeFaculty",
      entityId: id,
      oldValue: faculty,
      newValue: updated,
    });

    // No authorization cache survives this committed membership change.

    res.json({
      success: true,
      message: "Faculty updated successfully.",
      faculty: updated,
    });
  } catch (error) {
    if (sendFacultyAuthorizationError(res, error)) return;
    next(error);
  }
};

router.patch("/faculty/:id", requirePermission("FACULTY_EDIT"), handleFacultyUpdate);
router.put("/faculty/:id", requirePermission("FACULTY_EDIT"), handleFacultyUpdate);

// DELETE /api/enterprise/faculty/:id - Deactivate faculty staff member
router.delete("/faculty/:id", requirePermission("FACULTY_EDIT"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const { id } = req.params;
    const actor = await getTrustedFacultyMutationActor(req);

    const faculty = await prisma.collegeFaculty.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!faculty || faculty.collegeId !== collegeId) {
      return res.status(404).json({ success: false, message: "Faculty member not found in your college." });
    }

    assertCanDeactivateFaculty(actor, faculty);

    const updatedFaculty = await prisma.$transaction(
      async (tx) => {
        const facultyRecord = await tx.collegeFaculty.update({
          where: { id },
          data: { status: "inactive" },
        });
        await tx.user.update({
          where: { id: faculty.userId },
          data: { isActive: false },
        });
        return facultyRecord;
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    await logEnterpriseAudit({
      collegeId,
      actorId: req.user!.id,
      action: "FACULTY_DEACTIVATED",
      entity: "CollegeFaculty",
      entityId: id,
      oldValue: { status: faculty.status, name: faculty.user.name, email: faculty.user.email },
      newValue: { status: "inactive", isActive: false },
    });

    res.json({
      success: true,
      message: `Faculty member "${faculty.user.name}" has been deactivated.`,
      faculty: updatedFaculty,
    });
  } catch (error) {
    if (sendFacultyAuthorizationError(res, error)) return;
    next(error);
  }
});

// ===========================================================================
// 3. STUDENT MANAGEMENT
// ===========================================================================

async function loadAuthorizedStudentReportDetails(userId: string, collegeId: string) {
  return prisma.interviewSession.findMany({
    where: { userId, collegeId, status: "completed", report: { isNot: null } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetRole: true,
      difficulty: true,
      companyType: true,
      createdAt: true,
      report: {
        select: {
          overallScore: true,
          scoreScale: true,
          categoryScores: true,
          strengths: true,
          weaknesses: true,
          recommendations: true,
          speakingPace: true,
          fillerWords: true,
          voiceConfidence: true,
        },
      },
      questions: {
        select: {
          id: true,
          questionText: true,
          answer: { select: { score: true, feedback: true } },
        },
      },
    },
  });
}

type AuthorizedStudentReportSession = Awaited<ReturnType<typeof loadAuthorizedStudentReportDetails>>[number];

function serializeAuthorizedStudentReportDetails(sessions: AuthorizedStudentReportSession[]) {
  const completedSessions = sessions.filter(
    (session): session is AuthorizedStudentReportSession & { report: NonNullable<AuthorizedStudentReportSession["report"]> } =>
      session.report !== null
  );
  const validScores = completedSessions
    .map((session) => normalizeReportScore(session.report as any))
    .filter((score): score is number => score !== null);
  const averageScore = validScores.length > 0
    ? Math.round(validScores.reduce((total, score) => total + score, 0) / validScores.length)
    : null;

  return {
    averageScore,
    totalCompletedInterviews: completedSessions.length,
    interviewSessions: completedSessions.map((session) => ({
      id: session.id,
      targetRole: session.targetRole,
      difficulty: session.difficulty,
      companyType: session.companyType,
      overallScore: normalizeReportScore(session.report as any) ?? 0,
      categoryScores: session.report.categoryScores,
      strengths: session.report.strengths,
      weaknesses: session.report.weaknesses,
      recommendations: session.report.recommendations,
      speakingPace: session.report.speakingPace,
      fillerWords: session.report.fillerWords,
      voiceConfidence: session.report.voiceConfidence,
      questions: session.questions,
      createdAt: session.createdAt,
    })),
  };
}

// GET /api/enterprise/students - List students with server-side pagination & filters & scoping
router.get("/students", requirePermission("STUDENT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const canViewReports = (await resolveEnterprisePermission(req, "REPORT_VIEW")).allowed;
    const scopeConditions = await getRequestFacultyScopeConditions(req);

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 15));
    const search = ((req.query.search as string) || "").trim();
    const program = req.query.program as string;
    const course = req.query.course as string;
    const section = req.query.section as string;
    const batch = req.query.batch as string;
    const status = req.query.status as string;

    const filters: any = {};
    if (status) filters.status = status;
    if (program) filters.program = program;
    if (course) filters.course = course;
    if (section) filters.section = section;
    if (batch) filters.batch = batch;

    if (search) {
      filters.OR = [
        { enrollmentNumber: { contains: search, mode: "insensitive" } },
        { program: { contains: search, mode: "insensitive" } },
        { course: { contains: search, mode: "insensitive" } },
        { section: { contains: search, mode: "insensitive" } },
        { batch: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }
    const where = buildScopedStudentWhere(collegeId, scopeConditions, filters);

    const [total, students] = await Promise.all([
      prisma.collegeStudent.count({ where }),
      prisma.collegeStudent.findMany({
        relationLoadStrategy: "join",
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ batch: "desc" }, { enrollmentNumber: "asc" }],
        include: {
          user: {
            select: {
              id: true, name: true, email: true, phone: true,
              credits: { select: { balance: true } },
              _count: {
                select: {
                  ...(canViewReports ? { interviewSessions: true } : {}),
                  resumes: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Return at most one invitation per student on this page. DISTINCT ON is
    // explicit SQL here; Prisma's ordinary distinct would deduplicate in memory.
    const emails = students.map((student) => student.user.email);
    const invitations = emails.length === 0 ? [] : await prisma.$queryRaw<Array<{
      email: string; status: string; createdAt: Date; metadata: Prisma.JsonValue;
    }>>(Prisma.sql`
      SELECT DISTINCT ON ("email") "email", "status", "createdAt", "metadata"
      FROM "Invitation"
      WHERE "collegeId" = ${collegeId} AND "role" = 'student'
        AND "email" IN (${Prisma.join(emails)})
      ORDER BY "email", "createdAt" DESC, "id" DESC
    `);

    const latestInviteByEmail = new Map<string, any>();
    for (const inv of invitations) {
      if (!latestInviteByEmail.has(inv.email)) {
        latestInviteByEmail.set(inv.email, inv);
      }
    }

    const mappedStudents = students.map((s) => {
      const inv = latestInviteByEmail.get(s.user.email);
      return {
        id: s.id,
        userId: s.userId,
        enrollmentNumber: s.enrollmentNumber,
        name: s.user.name,
        email: s.user.email,
        phone: s.user.phone,
        user: {
          id: s.user.id,
          name: s.user.name,
          email: s.user.email,
          phone: s.user.phone,
          credits: s.user.credits ? { balance: s.user.credits.balance } : { balance: 0 },
        },
        program: s.program,
        course: s.course,
        department: s.department,
        section: s.section,
        batch: s.batch,
        semester: s.semester,
        academicYear: s.academicYear,
        gender: s.gender,
        status: s.status,
        creditBalance: s.user.credits?.balance ?? 0,
        ...(canViewReports
          ? { interviewSessionsCount: (s.user._count as { interviewSessions: number }).interviewSessions }
          : {}),
        resumesCount: s.user._count.resumes,
        invitationStatus: (inv?.metadata as any)?.deliveryStatus ?? inv?.status ?? "unknown",
        emailError: publicStudentEmailError((inv?.metadata as any)?.emailError),
        lastInviteSentAt: inv?.createdAt ?? null,
        createdAt: s.createdAt,
      };
    });

    res.json({
      success: true,
      // 'students' key matches EnterpriseDashboardPage frontend expectation
      students: mappedStudents,
      // Also expose as 'data' for backward compat
      data: mappedStudents,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/enterprise/students/:id - Single student details (used by frontend getStudentDetails)
router.get("/students/:id", requirePermission("STUDENT_VIEW"), async (req, res, next) => {
  // Skip if this is a named sub-route
  const id = req.params.id;
  if (id === "bulk-import" || id === "bulk-import-file" || !id.match(/^c[a-z0-9]+$/i)) return next();

  try {
    const collegeId = req.collegeId!;

    const student = await prisma.collegeStudent.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            credits: true,
            createdAt: true,
            resumes: {
              orderBy: { updatedAt: "desc" },
              select: { id: true, fileName: true, fileUrl: true, createdAt: true, updatedAt: true },
            },
          },
        },
      },
    });

    const accessibleStudent = student
      ? await facultyCanAccessStudent(req.user!.id, collegeId, student.id, req.user!.role === "super_admin")
      : null;
    if (!student || !accessibleStudent) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }

    const canViewReports = (await resolveEnterprisePermission(req, "REPORT_VIEW")).allowed;
    const reportDetails = canViewReports
      ? serializeAuthorizedStudentReportDetails(
          await loadAuthorizedStudentReportDetails(student.userId, collegeId)
        )
      : {};

    const latestInvite = await prisma.invitation.findFirst({
      where: { collegeId, email: student.user.email, role: "student" },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      student: {
        id: student.id,
        userId: student.userId,
        enrollmentNumber: student.enrollmentNumber,
        invitationStatus: (latestInvite?.metadata as any)?.deliveryStatus ?? latestInvite?.status ?? "unknown",
        emailError: publicStudentEmailError((latestInvite?.metadata as any)?.emailError),
        lastInviteSentAt: latestInvite?.createdAt ?? null,
        name: student.user.name,
        email: student.user.email,
        phone: student.user.phone,
        program: student.program,
        course: student.course,
        department: student.department,
        section: student.section,
        batch: student.batch,
        semester: student.semester,
        academicYear: student.academicYear,
        gender: student.gender,
        status: student.status,
        creditBalance: student.user.credits?.balance ?? 0,
        resumes: student.user.resumes,
        ...reportDetails,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/enterprise/students/:id/details - Single student detailed breakdown & interview telemetry
router.get("/students/:id/details", requirePermission("STUDENT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const { id } = req.params;

    const student = await prisma.collegeStudent.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            credits: true,
            createdAt: true,
            resumes: {
              orderBy: { updatedAt: "desc" },
              select: {
                id: true,
                fileName: true,
                fileUrl: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    const accessibleStudent = student
      ? await facultyCanAccessStudent(req.user!.id, collegeId, student.id, req.user!.role === "super_admin")
      : null;
    if (!student || !accessibleStudent) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }

    const canViewReports = (await resolveEnterprisePermission(req, "REPORT_VIEW")).allowed;
    const reportDetails = canViewReports
      ? serializeAuthorizedStudentReportDetails(
          await loadAuthorizedStudentReportDetails(student.userId, collegeId)
        )
      : {};

    const latestInvite = await prisma.invitation.findFirst({
      where: { collegeId, email: student.user.email, role: "student" },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      student: {
        id: student.id,
        userId: student.userId,
        enrollmentNumber: student.enrollmentNumber,
        invitationStatus: (latestInvite?.metadata as any)?.deliveryStatus ?? latestInvite?.status ?? "unknown",
        emailError: publicStudentEmailError((latestInvite?.metadata as any)?.emailError),
        lastInviteSentAt: latestInvite?.createdAt ?? null,
        name: student.user.name,
        email: student.user.email,
        phone: student.user.phone,
        program: student.program,
        course: student.course,
        department: student.department,
        section: student.section,
        batch: student.batch,
        semester: student.semester,
        academicYear: student.academicYear,
        gender: student.gender,
        status: student.status,
        creditBalance: student.user.credits?.balance ?? 0,
        resumes: student.user.resumes,
        ...reportDetails,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/enterprise/students - Add student
router.post("/students", requirePermission("STUDENT_CREATE"), async (req, res, next) => {
  try {
    const parsedData = studentCreationSchema.parse(req.body);
    const collegeId = req.collegeId!;
    const college = req.college ?? await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) {
      return res.status(404).json({ success: false, message: "College tenant not found." });
    }

    const data = { ...parsedData, email: normalizeEmailIdentity(parsedData.email) };

    const idempotencyKey = parseOptionalIdempotencyKey(
      req.headers["idempotency-key"] || req.headers["x-idempotency-key"]
    );
    const idempotencyScope = idempotencyKey
      ? {
          collegeId,
          actorId: req.user!.id,
          operation: "STUDENT_CREATION",
          key: idempotencyKey,
        }
      : null;
    const payloadHash = idempotencyScope ? creditPayloadHash(parsedData) : null;

    // Fast-path replay check: if an idempotency key was already completed, return receipt before running duplicate pre-checks
    if (idempotencyScope && payloadHash) {
      const existingRecord = await prisma.creditIdempotencyRecord.findUnique({
        where: { collegeId_actorId_operation_key: idempotencyScope },
      });
      if (existingRecord) {
        if (existingRecord.payloadHash !== payloadHash) {
          return res.status(409).json({
            success: false,
            message: "Idempotency key was already used with a different student creation payload.",
          });
        }
        if (existingRecord.status === "COMPLETED" && existingRecord.responseBody && existingRecord.responseStatus) {
          return res.status(existingRecord.responseStatus).json(existingRecord.responseBody);
        }
        if (existingRecord.status === "PROCESSING") {
          res.set("Retry-After", "2");
          return res.status(503).json({
            success: false,
            message: "Student creation is currently processing. Retry with the same Idempotency-Key.",
          });
        }
      }
    }

    await assertRequestStudentCreditAuthorization(req, data.initialCredits > 0);
    const facultyScope = (await resolveEnterpriseAuthorization(req)).studentScope;
    if (!isStudentWithinFacultyScope(facultyScope, { collegeId, ...data })) {
      return res.status(403).json({
        success: false,
        message: "Access denied: The requested student scope is outside your assigned access.",
      });
    }

    const [existingStudent, existingUser] = await Promise.all([
      prisma.collegeStudent.findUnique({
        where: { collegeId_enrollmentNumber: { collegeId, enrollmentNumber: data.enrollmentNumber } },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: { email: { equals: data.email, mode: "insensitive" } },
        select: { id: true },
      }),
    ]);

    if (existingStudent) {
      if (idempotencyScope) {
        const record = await prisma.creditIdempotencyRecord.findUnique({
          where: { collegeId_actorId_operation_key: idempotencyScope },
        });
        if (record?.status === "COMPLETED" && record.responseBody && record.responseStatus) {
          return res.status(record.responseStatus).json(record.responseBody);
        }
        if (record?.status === "PROCESSING") {
          res.set("Retry-After", "2");
          return res.status(503).json({
            success: false,
            message: "Student creation is currently processing. Retry with the same Idempotency-Key.",
          });
        }
      }
      return res.status(400).json({
        success: false,
        message: `Student with enrollment number ${data.enrollmentNumber} already exists in this college.`,
      });
    }

    if (existingUser) {
      if (idempotencyScope) {
        const record = await prisma.creditIdempotencyRecord.findUnique({
          where: { collegeId_actorId_operation_key: idempotencyScope },
        });
        if (record?.status === "COMPLETED" && record.responseBody && record.responseStatus) {
          return res.status(record.responseStatus).json(record.responseBody);
        }
        if (record?.status === "PROCESSING") {
          res.set("Retry-After", "2");
          return res.status(503).json({
            success: false,
            message: "Student creation is currently processing. Retry with the same Idempotency-Key.",
          });
        }
      }
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // 1. High-Entropy Non-Predictable Temporary Credentials
    // Cost 8 is sufficient for temporary passwords that are rotated on first login (cost 10 blocks the event loop ~200ms)
    const rawTempPassword = generateSecureTemporaryPassword();
    const passwordHash = await bcrypt.hash(rawTempPassword, 8);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    const result = await prisma.$transaction(
      async (tx) => {
        // Atomic idempotency claim inside transaction
        if (idempotencyScope && payloadHash) {
          const claim = await tx.creditIdempotencyRecord.createMany({
            data: {
              ...idempotencyScope,
              payloadHash,
              status: "PROCESSING",
            },
            skipDuplicates: true,
          });

          const record = await tx.creditIdempotencyRecord.findUniqueOrThrow({
            where: { collegeId_actorId_operation_key: idempotencyScope },
          });

          if (record.payloadHash !== payloadHash) {
            throw new CreditIdempotencyError(409, "Idempotency key was already used with a different student creation payload.");
          }

          if (claim.count === 0) {
            if (record.status !== "COMPLETED" || !record.responseBody || !record.responseStatus) {
              throw new CreditIdempotencyError(503, "Student creation is currently processing. Retry with the same Idempotency-Key.");
            }
            return {
              isReplay: true as const,
              status: record.responseStatus,
              body: record.responseBody,
            };
          }
        }

        // 1. Create a new identity. Creation endpoints never reuse or mutate an existing user.
        const user = await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            passwordHash,
            role: "student",
            collegeId,
            isActive: true,
          },
        });
        const userId = user.id;

        // 2. Initialize the user balance at zero. Funding is performed by the
        // atomic transfer below, never by directly minting a starting balance.
        await tx.userCredit.create({
          data: {
            userId,
            balance: 0,
          },
        });

        // 3. Create exactly one student profile for the new identity.
        const studentProfile = await tx.collegeStudent.create({
          data: {
            userId,
            collegeId,
            enrollmentNumber: data.enrollmentNumber,
            program: data.program,
            course: data.course,
            department: data.department,
            section: data.section,
            batch: data.batch,
            academicYear: data.academicYear,
            semester: data.semester,
            gender: data.gender,
            status: "active",
          },
        });

        // 4. Debit + student credit + ledger are one transaction.
        await allocateInstitutionCreditsToStudent({
          tx,
          collegeId,
          studentId: studentProfile.id,
          userId,
          actorId: req.user!.id,
          amount: data.initialCredits,
          type: "FACULTY_DISTRIBUTION",
          reason: `Initial student onboarding credit allocation for ${data.name} (${data.enrollmentNumber})`,
        });

        if (data.initialCredits > 0) {
          await logEnterpriseAudit({
            collegeId,
            actorId: req.user!.id,
            action: "STUDENT_CREDITS_ASSIGNED",
            entity: "CollegeStudent",
            entityId: studentProfile.id,
            newValue: { amount: data.initialCredits, source: "STUDENT_CREATION" },
            transactionClient: tx,
            propagateErrors: true,
          });
        }

        // 5. Create Invitation record
        await tx.invitation.create({
          data: {
            collegeId,
            email: data.email,
            role: "student",
            tokenHash,
            expiresAt,
            status: "pending",
            invitedById: req.user!.id,
            metadata: {
              name: data.name,
              enrollmentNumber: data.enrollmentNumber,
              program: data.program,
              course: data.course,
              section: data.section,
              batch: data.batch,
            },
          },
        });

        const initialReceipt = {
          success: true,
          message: `Student "${data.name}" added successfully. Invitation email pending.`,
          student: studentProfile,
          invitationStatus: "pending",
          emailError: undefined,
          invitationToken: env.NODE_ENV !== "production" ? rawToken : undefined,
        };

        if (idempotencyScope) {
          await tx.creditIdempotencyRecord.update({
            where: { collegeId_actorId_operation_key: idempotencyScope },
            data: {
              status: "COMPLETED",
              responseStatus: 201,
              responseBody: initialReceipt as any,
              completedAt: new Date(),
            },
          });
        }

        return {
          isReplay: false as const,
          userId,
          studentProfile,
          rawToken,
          rawTempPassword,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 20000,
        timeout: 60000,
      }
    );

    if (result.isReplay) {
      return res.status(result.status).json(result.body);
    }

    // 2. Await bounded email delivery after committing the account transaction.
    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    let invitationStatus = "sent";
    let emailError: string | undefined;
    let emailAccepted = false;
    let statusPersisted = false;

    try {
      const mailResult = await EmailService.sendStudentWelcomeEmail({
        to: data.email,
        recipientName: data.name,
        collegeName: college.name,
        enrollmentNumber: data.enrollmentNumber,
        tempPassword: result.rawTempPassword,
        loginUrl: `${frontendUrl}/login`,
      });

      if (mailResult && mailResult.success === false) {
        invitationStatus = "failed";
        emailError = publicStudentEmailError(mailResult.error) || "The invitation email could not be sent.";
      } else {
        emailAccepted = true;
      }
    } catch (err: any) {
      invitationStatus = "failed";
      emailError = publicStudentEmailError(err?.message) || "The invitation email could not be sent.";
    }

    // 3. Post-commit: Update invitation status in DB (isolated from student creation commit)
    try {
      await prisma.invitation.updateMany({
        where: { collegeId, email: data.email, role: "student" },
        data: {
          status: invitationStatus,
          metadata: {
            name: data.name,
            enrollmentNumber: data.enrollmentNumber,
            program: data.program,
            course: data.course,
            section: data.section,
            batch: data.batch,
            emailError,
          },
        },
      });
      statusPersisted = true;
    } catch (err: any) {
      console.error("Failed to persist student invitation status after account creation", {
        studentId: result.studentProfile.id,
        collegeId,
        email: data.email,
        intendedStatus: invitationStatus,
        error: err?.message || err,
      });
      statusPersisted = false;
    }

    // 4. Post-commit: Log enterprise audit (isolated from student creation commit)
    try {
      await logEnterpriseAudit({
        collegeId,
        actorId: req.user!.id,
        action: "STUDENT_CREATED",
        entity: "CollegeStudent",
        entityId: result.studentProfile.id,
        newValue: {
          name: data.name,
          email: data.email,
          enrollmentNumber: data.enrollmentNumber,
          program: data.program,
          batch: data.batch,
          invitationStatus: statusPersisted ? invitationStatus : "persistence_failed",
          invitationPersistenceFailed: !statusPersisted,
        },
      });
    } catch (auditErr: any) {
      console.error("Failed to record enterprise audit log for student creation", {
        studentId: result.studentProfile.id,
        collegeId,
        error: auditErr?.message || auditErr,
      });
    }

    const finalStatus = statusPersisted ? invitationStatus : "persistence_failed";
    const invitationPersistenceFailed = !statusPersisted;
    const invitationPersistenceWarning = !statusPersisted
      ? "Student account created, but invitation status could not be saved to the database. Check the student list before resending."
      : undefined;

    let responseMessage: string;
    if (statusPersisted && invitationStatus === "sent") {
      responseMessage = `Student "${data.name}" added successfully. Invitation email accepted by the email service.`;
    } else if (statusPersisted && invitationStatus === "failed") {
      responseMessage = `Student "${data.name}" added successfully. (Notice: Welcome email could not be delivered and may be resent).`;
    } else if (!statusPersisted && emailAccepted) {
      responseMessage = `Student "${data.name}" added successfully. Invitation email was accepted, but delivery status could not be saved. Check invitation status before resending.`;
    } else {
      responseMessage = `Student "${data.name}" added successfully. Notice: Welcome email could not be delivered and status could not be saved. Check the student list before resending.`;
    }

    const finalResponseBody = {
      success: true,
      message: responseMessage,
      student: result.studentProfile,
      invitationStatus: finalStatus,
      emailSent: emailAccepted,
      emailError,
      invitationPersistenceFailed,
      invitationPersistenceWarning,
      invitationToken: env.NODE_ENV !== "production" ? result.rawToken : undefined,
    };

    // Update idempotency record with final response body so replayed requests reflect actual outcome
    if (idempotencyScope) {
      try {
        await prisma.creditIdempotencyRecord.update({
          where: { collegeId_actorId_operation_key: idempotencyScope },
          data: {
            responseBody: finalResponseBody as any,
          },
        });
      } catch (err: any) {
        console.error("Failed to update idempotency response body post-commit", {
          scope: idempotencyScope,
          error: err?.message || err,
        });
      }
    }

    return res.status(201).json(finalResponseBody);
  } catch (error: any) {
    if (error instanceof CreditIdempotencyError) {
      if (error.statusCode === 503) res.set("Retry-After", "2");
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
});

// ===========================================================================
// BULK STUDENT IMPORT & RESEND INVITATION LOGIC
// ===========================================================================

export function generateSecureTemporaryPassword(): string {
  const specials = "!@#$%^&*";
  const digits = "23456789";
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghjkmnpqrstuvwxyz";

  const p1 = specials[crypto.randomInt(0, specials.length)];
  const p2 = digits[crypto.randomInt(0, digits.length)];
  const p3 = uppers[crypto.randomInt(0, uppers.length)];
  const p4 = lowers[crypto.randomInt(0, lowers.length)];

  const pool = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
  const randomBytes = crypto.randomBytes(8);
  let rest = "";
  for (let i = 0; i < 8; i++) {
    rest += pool[randomBytes[i] % pool.length];
  }

  const combined = [p1, p2, p3, p4, ...rest.split("")].sort(() => 0.5 - Math.random()).join("");
  return `Rr#${combined}`;
}

export function normalizeExcelHeaders(rawRow: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(rawRow)) {
    const cleanKey = key.trim().toLowerCase().replace(/[\s_\-\.\/]+/g, "");

    if (cleanKey.includes("email")) {
      normalized.email = typeof value === "string" ? value.trim().toLowerCase() : String(value ?? "").trim().toLowerCase();
    } else if (
      cleanKey.includes("roll") ||
      cleanKey.includes("enroll") ||
      cleanKey.includes("reg") ||
      cleanKey.includes("usn") ||
      cleanKey.includes("studentcode") ||
      cleanKey.includes("studentid")
    ) {
      normalized.enrollmentNumber = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    } else if (cleanKey.includes("credit")) {
      const rawCredit = typeof value === "string" ? value.trim() : value;
      normalized.initialCredits = rawCredit === "" || rawCredit == null
        ? undefined
        : (typeof rawCredit === "number" || typeof rawCredit === "string") ? Number(rawCredit) : NaN;
    } else if (
      cleanKey.includes("phone") ||
      cleanKey.includes("mobile") ||
      cleanKey.includes("contact")
    ) {
      normalized.phone = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    } else if (
      cleanKey.includes("program") ||
      cleanKey.includes("degree") ||
      cleanKey.includes("stream")
    ) {
      normalized.program = typeof value === "string" ? value.trim() : value;
    } else if (
      cleanKey.includes("course") ||
      cleanKey.includes("branch") ||
      cleanKey.includes("specializ")
    ) {
      normalized.course = typeof value === "string" ? value.trim() : value;
    } else if (
      cleanKey.includes("department") ||
      cleanKey === "dept"
    ) {
      normalized.department = typeof value === "string" ? value.trim() : value;
    } else if (
      cleanKey.includes("sec") ||
      cleanKey.includes("divis") ||
      cleanKey.includes("class")
    ) {
      normalized.section = typeof value === "string" ? value.trim() : value;
    } else if (
      cleanKey.includes("batch") ||
      cleanKey.includes("year") ||
      cleanKey.includes("pass")
    ) {
      normalized.batch = typeof value === "string" ? value.trim() : value;
    } else if (
      cleanKey.includes("name") &&
      !cleanKey.includes("college") &&
      !cleanKey.includes("univ")
    ) {
      normalized.name = typeof value === "string" ? value.trim() : value;
    } else if (
      cleanKey.includes("gender") ||
      cleanKey.includes("sex")
    ) {
      normalized.gender = typeof value === "string" ? value.trim() : value;
    } else if (cleanKey.includes("sem")) {
      const rawSemester = typeof value === "string" ? value.trim() : value;
      normalized.semester = rawSemester === "" || rawSemester == null ? undefined
        : typeof rawSemester === "number" ? rawSemester
        : typeof rawSemester === "string" && /^\d+$/.test(rawSemester) ? Number(rawSemester) : NaN;
    } else if (cleanKey.includes("acad")) {
      normalized.academicYear = typeof value === "string" ? value.trim() : value;
    }
  }

  return normalized;
}

export interface BulkImportError {
  row: number;
  email?: string;
  enrollmentNumber?: string;
  reason: string;
}

interface BulkImportTestHooks {
  /** Test-only failure injection. HTTP handlers never supply this hook. */
  afterRowPersisted?: (rowNumber: number) => void | Promise<void>;
}

export async function executeBulkImport({
  collegeId,
  actorId,
  actorIsSuperAdmin = false,
  rawRows,
  atomic = false,
  defaultInitialCredits = 0,
  testHooks,
}: {
  collegeId: string;
  actorId: string;
  actorIsSuperAdmin?: boolean;
  rawRows: Array<Record<string, any>>;
  atomic?: boolean;
  defaultInitialCredits?: number;
  testHooks?: BulkImportTestHooks;
}) {
  const college = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!college) {
    throw new Error("College tenant not found.");
  }
  // Preflight every normalized row, before validation can drop a positive-credit
  // row and before partial-import transactions can persist any other students.
  const validatedDefault = z.number().int().max(2147483647).min(0).parse(defaultInitialCredits);
  const normalizedRows = rawRows.map(normalizeExcelHeaders);
  const requestsCredits = normalizedRows.some(row => {
    const amount = row.initialCredits ?? validatedDefault;
    return typeof amount === "number" && Number.isFinite(amount) && Number.isInteger(amount) && amount > 0 && amount <= 2147483647;
  });
  await assertStudentCreditAuthorization(collegeId, actorId, requestsCredits);
  const facultyScope = await getFacultyStudentScope(actorId, collegeId, actorIsSuperAdmin, true);

  const errors: BulkImportError[] = [];
  const validRows: Array<{
    rowNumber: number;
    name: string;
    email: string;
    enrollmentNumber: string;
    program: string;
    course: string;
    department?: string;
    section: string;
    batch: string;
    phone?: string;
    gender?: string;
    semester?: number;
    academicYear?: string;
    initialCredits: number;
  }> = [];

  const seenEmailsInFile = new Map<string, number>();
  const seenEnrollmentsInFile = new Map<string, number>();

  // 1. First pass: Row normalization and file-level validations
  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 1;
    const requestedCredits = normalizedRows[i].initialCredits ?? defaultInitialCredits;
    try {
      assertValidCreditAmount(requestedCredits);
      if (requestedCredits > 2147483647) throw new Error("initialCredits must not exceed 2147483647.");
    } catch (error: any) {
      errors.push({ row: rowNum, reason: error.message });
      continue;
    }

    const rowValidation = studentCreationSchema.safeParse({ ...normalizedRows[i], initialCredits: normalizedRows[i].initialCredits ?? defaultInitialCredits });
    if (!rowValidation.success) {
      errors.push({ row: rowNum, reason: rowValidation.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") });
      continue;
    }
    const normalized = rowValidation.data;

    const name = normalized.name;
    const email = normalized.email;
    const enrollmentNumber = normalized.enrollmentNumber;
    const program = normalized.program;
    const course = normalized.course;
    const department = normalized.department;
    const section = normalized.section;
    const batch = normalized.batch;
    const phone = normalized.phone;
    const gender = normalized.gender;
    const semester = normalized.semester;
    const academicYear = normalized.academicYear;
    const initialCredits = normalized.initialCredits ?? defaultInitialCredits;

    if (!isStudentWithinFacultyScope(facultyScope, { collegeId, program, course, section, batch })) {
      errors.push({
        row: rowNum,
        email,
        enrollmentNumber,
        reason: "The requested student scope is outside your assigned access.",
      });
      continue;
    }

    // In-file duplicate detection
    if (seenEmailsInFile.has(email)) {
      errors.push({
        row: rowNum,
        email,
        enrollmentNumber,
        reason: `Duplicate email "${email}" in import file (first seen at row ${seenEmailsInFile.get(email)})`,
      });
      continue;
    }
    seenEmailsInFile.set(email, rowNum);

    if (seenEnrollmentsInFile.has(enrollmentNumber)) {
      errors.push({
        row: rowNum,
        email,
        enrollmentNumber,
        reason: `Duplicate enrollment number "${enrollmentNumber}" in import file (first seen at row ${seenEnrollmentsInFile.get(enrollmentNumber)})`,
      });
      continue;
    }
    seenEnrollmentsInFile.set(enrollmentNumber, rowNum);

    validRows.push({
      rowNumber: rowNum,
      name,
      email,
      enrollmentNumber,
      program,
      course,
      department,
      section,
      batch,
      phone,
      gender,
      semester,
      academicYear,
      initialCredits,
    });
  }

  // 2. Database collision & cross-tenant checks
  if (validRows.length > 0) {
    const candidateEmails = validRows.map((r) => r.email);
    const candidateEnrollments = validRows.map((r) => r.enrollmentNumber);

    const [existingStudentsInCollege, existingUsersAnywhere] = await Promise.all([
      prisma.collegeStudent.findMany({
        where: {
          collegeId,
          enrollmentNumber: { in: candidateEnrollments },
        },
        select: { enrollmentNumber: true },
      }),
      prisma.user.findMany({
        where: {
          OR: candidateEmails.map((email) => ({
            email: { equals: email, mode: "insensitive" as const },
          })),
        },
        select: { id: true, email: true },
      }),
    ]);

    const existingEnrollmentsSet = new Set(existingStudentsInCollege.map((s) => s.enrollmentNumber));
    const existingUserByEmail = new Map(existingUsersAnywhere.map((u) => [u.email.toLowerCase(), u]));

    const passedRows: typeof validRows = [];
    for (const row of validRows) {
      let hasError = false;

      if (existingEnrollmentsSet.has(row.enrollmentNumber)) {
        errors.push({
          row: row.rowNumber,
          email: row.email,
          enrollmentNumber: row.enrollmentNumber,
          reason: `Student with enrollment number "${row.enrollmentNumber}" already exists in this college.`,
        });
        hasError = true;
      }

      const existingUser = existingUserByEmail.get(row.email.toLowerCase());
      if (existingUser) {
        errors.push({
          row: row.rowNumber,
          email: row.email,
          enrollmentNumber: row.enrollmentNumber,
          reason: "An account with this email already exists.",
        });
        hasError = true;
      }

      if (!hasError) {
        passedRows.push(row);
      }
    }

    validRows.length = 0;
    validRows.push(...passedRows);
  }

  // 3. Rollback Behavior: If atomic mode is requested and there are ANY errors, abort completely
  if (atomic && errors.length > 0) {
    return {
      success: false,
      abortedDueToAtomicValidation: true,
      message: `Atomic import aborted: ${errors.length} error(s) detected. No student accounts were created.`,
      totalProcessed: rawRows.length,
      totalCreated: 0,
      totalFailed: errors.length,
      emailsSent: 0,
      emailsFailed: 0,
      errors,
      createdStudents: [],
    };
  }

  // 4. Check college credit balance if initial credits requested
  const totalCreditsNeeded = validRows.reduce((sum, r) => sum + (r.initialCredits || 0), 0);
  if (totalCreditsNeeded > 0) {
    const creditAccount = await prisma.collegeCreditAccount.findUnique({ where: { collegeId } });
    if (!creditAccount || creditAccount.balance < totalCreditsNeeded) {
      if (atomic) {
        return {
          success: false,
          abortedDueToAtomicValidation: true,
          message: `Insufficient college credits for bulk allocation. Required: ${totalCreditsNeeded}, Available: ${creditAccount?.balance ?? 0}.`,
          totalProcessed: rawRows.length,
          totalCreated: 0,
          totalFailed: rawRows.length,
          emailsSent: 0,
          emailsFailed: 0,
          errors: [{ row: 0, reason: "Insufficient college credit balance for cohort" }],
          createdStudents: [],
        };
      }
    }
  }

  // 5. Prepare credentials before opening database transactions.
  const createdStudents: any[] = [];
  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";

  // Pre-compute all password hashes in PARALLEL before the loop.
  // bcrypt.hash inside a for-loop is sequential: 50 students × ~150ms = 7.5s of event-loop blocking.
  // With Promise.all they all run concurrently. Cost 8 is fine for temporary passwords.
  const rawTempPasswords = validRows.map(() => generateSecureTemporaryPassword());
  const hashedPasswords = await Promise.all(
    rawTempPasswords.map((pwd) => bcrypt.hash(pwd, 8))
  );

  const preparedRows = validRows.map((row, index) => ({
    row,
    rawTempPassword: rawTempPasswords[index],
    passwordHash: hashedPasswords[index],
    tokenHash: crypto.createHash("sha256").update(crypto.randomBytes(32).toString("hex")).digest("hex"),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  }));

  const createRow = async (tx: Prisma.TransactionClient, prepared: typeof preparedRows[number]) => {
    const { row, passwordHash, tokenHash, expiresAt } = prepared;
    const user = await tx.user.create({
      data: {
        name: row.name,
        email: row.email,
        phone: row.phone,
        passwordHash,
        role: "student",
        collegeId,
        isActive: true,
      },
    });

    const profile = await tx.collegeStudent.create({
      data: {
        userId: user.id,
        collegeId,
        enrollmentNumber: row.enrollmentNumber,
        program: row.program,
        course: row.course,
        department: row.department,
        section: row.section,
        batch: row.batch,
        gender: row.gender,
        semester: row.semester,
        academicYear: row.academicYear,
        status: "active",
      },
    });

    await allocateInstitutionCreditsToStudent({
      tx,
      collegeId,
      studentId: profile.id,
      userId: user.id,
      actorId,
      amount: row.initialCredits,
      type: "FACULTY_DISTRIBUTION",
      reason: `Bulk import initial credit allocation for ${row.name} (${row.enrollmentNumber})`,
    });

    await tx.invitation.create({
      data: {
        collegeId,
        email: row.email,
        role: "student",
        tokenHash,
        expiresAt,
        status: "pending",
        invitedById: actorId,
        metadata: {
          name: row.name,
          enrollmentNumber: row.enrollmentNumber,
          program: row.program,
          course: row.course,
          section: row.section,
          batch: row.batch,
        },
      },
    });

    if (row.initialCredits > 0) {
      await logEnterpriseAudit({
        collegeId, actorId,
        action: "STUDENT_CREDITS_ASSIGNED", entity: "CollegeStudent", entityId: profile.id,
        newValue: { amount: row.initialCredits, source: "STUDENT_BULK_IMPORT", row: row.rowNumber },
        transactionClient: tx, propagateErrors: true,
      });
    }

    await testHooks?.afterRowPersisted?.(row.rowNumber);

    return { user, profile };
  };

  type CommittedRow = {
    prepared: typeof preparedRows[number];
    created: Awaited<ReturnType<typeof createRow>>;
  };
  const committedRows: CommittedRow[] = [];
  const transactionOptions = { maxWait: 20000, timeout: 60000 };
  let strictAuditWritten = false;

  if (atomic && preparedRows.length > 0) {
    let activeRow = preparedRows[0];
    try {
      const committed = await prisma.$transaction(async (tx) => {
        const results: CommittedRow[] = [];
        for (const prepared of preparedRows) {
          activeRow = prepared;
          results.push({ prepared, created: await createRow(tx, prepared) });
        }
        await logEnterpriseAudit({
          collegeId,
          actorId,
          action: "STUDENTS_BULK_IMPORTED",
          entity: "CollegeStudent",
          newValue: {
            totalProcessed: rawRows.length,
            totalCreated: results.length,
            totalFailed: 0,
          },
          transactionClient: tx,
          propagateErrors: true,
        });
        return results;
      }, transactionOptions);
      committedRows.push(...committed);
      strictAuditWritten = true;
    } catch (err: any) {
      const reason = isUniqueConstraintError(err)
        ? "An account or student with these unique details already exists."
        : err?.message || "Failed to create student record in database";
      errors.push({
        row: activeRow.row.rowNumber,
        email: activeRow.row.email,
        enrollmentNumber: activeRow.row.enrollmentNumber,
        reason,
      });
      return {
        success: false,
        abortedDueToAtomicValidation: true,
        message: `Atomic import aborted: ${reason} No student accounts were created.`,
        totalProcessed: rawRows.length,
        totalCreated: 0,
        totalFailed: rawRows.length,
        emailsSent: 0,
        emailsFailed: 0,
        errors,
        createdStudents: [],
      };
    }
  } else {
    for (const prepared of preparedRows) {
      try {
        const created = await prisma.$transaction(
          (tx) => createRow(tx, prepared),
          transactionOptions
        );
        committedRows.push({ prepared, created });
      } catch (err: any) {
        errors.push({
          row: prepared.row.rowNumber,
          email: prepared.row.email,
          enrollmentNumber: prepared.row.enrollmentNumber,
          reason: isUniqueConstraintError(err)
            ? "An account or student with these unique details already exists."
            : err?.message || "Failed to create student record in database",
        });
      }
    }
  }

  // Email delivery is outside accounting transactions and only follows commits.
  for (const { prepared, created } of committedRows) {
    const { row, rawTempPassword } = prepared;
    let emailDeliveryStatus = "sent";
    let emailErrorDetail: string | undefined;

    try {
      const mailResult = await EmailService.sendStudentWelcomeEmail({
        to: row.email,
        recipientName: row.name,
        collegeName: college.name,
        enrollmentNumber: row.enrollmentNumber,
        tempPassword: rawTempPassword,
        loginUrl: `${frontendUrl}/login`,
      });
      if (mailResult && mailResult.success === false) {
        emailDeliveryStatus = "failed";
        emailErrorDetail = publicStudentEmailError(mailResult.error) || "The invitation email could not be sent.";
      }
    } catch (mailErr: any) {
      emailDeliveryStatus = "failed";
      emailErrorDetail = publicStudentEmailError(mailErr?.message) || "The invitation email could not be sent.";
    }

    try {
      await prisma.invitation.updateMany({
        where: { collegeId, email: row.email, role: "student" },
        data: {
          status: emailDeliveryStatus,
          metadata: {
            name: row.name,
            enrollmentNumber: row.enrollmentNumber,
            program: row.program,
            course: row.course,
            section: row.section,
            batch: row.batch,
            emailError: emailErrorDetail,
          },
        },
      });
    } catch (statusError: any) {
      // The import has already committed. Delivery bookkeeping must not turn a
      // committed strict import into an apparent transactional failure.
      emailErrorDetail = [
        emailErrorDetail,
        "Invitation delivery status could not be recorded. Refresh the student list before resending.",
      ].filter(Boolean).join(" ");
      console.error("Failed to update post-commit invitation delivery status.");
    }

    createdStudents.push({
      id: created.profile.id,
      userId: created.user.id,
      name: row.name,
      email: row.email,
      enrollmentNumber: row.enrollmentNumber,
      program: row.program,
      course: row.course,
      section: row.section,
      batch: row.batch,
      invitationStatus: emailDeliveryStatus,
      emailError: emailErrorDetail,
    });
  }

  if (createdStudents.length > 0 && !strictAuditWritten) {
    await logEnterpriseAudit({
      collegeId,
      actorId,
      action: "STUDENTS_BULK_IMPORTED",
      entity: "CollegeStudent",
      newValue: {
        totalProcessed: rawRows.length,
        totalCreated: createdStudents.length,
        totalFailed: errors.length,
      },
    });
  }

  const emailsSent = createdStudents.filter((student) => student.invitationStatus === "sent").length;
  const emailsFailed = createdStudents.length - emailsSent;

  return {
    success: true,
    message: `Processed ${rawRows.length} rows: ${createdStudents.length} created, ${errors.length} failed.`,
    totalProcessed: rawRows.length,
    totalCreated: createdStudents.length,
    totalFailed: errors.length,
    emailsSent,
    emailsFailed,
    errors,
    createdStudents,
  };
}

// POST /api/enterprise/students/bulk-import - Import students via JSON payload
router.post("/students/bulk-import", requirePermission("STUDENT_CREATE"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const schema = z.object({
      students: z.array(z.record(z.any())).min(1, "At least one student record is required"),
      atomic: z.boolean().optional().default(false),
      initialCredits: z.number().int().max(2147483647).min(0).optional().default(0),
    });

    const { students, atomic, initialCredits } = schema.parse(req.body);

    const result = await executeBulkImport({
      collegeId,
      actorId: req.user!.id,
      actorIsSuperAdmin: req.user!.role === "super_admin",
      rawRows: students,
      atomic,
      defaultInitialCredits: initialCredits,
    });

    const statusCode = result.success ? 201 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/enterprise/students/bulk-import-file - Import students via Excel or CSV file
router.post(
  "/students/bulk-import-file",
  requirePermission("STUDENT_CREATE"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const collegeId = req.collegeId!;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload an Excel (.xlsx, .xls) or CSV file.",
        });
      }

      const atomic = req.body.atomic === "true" || req.body.atomic === true;
      const rawInitialCredits = req.body.initialCredits;
      const initialCredits = rawInitialCredits == null || rawInitialCredits === ""
        ? 0
        : z.coerce.number().int().max(2147483647).min(0).parse(rawInitialCredits);

      // Parse Excel or CSV buffer
      let workbook: xlsx.WorkBook;
      try {
        workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      } catch (parseErr: any) {
        return res.status(400).json({
          success: false,
          message: "Invalid file format. Unable to parse Excel/CSV document.",
        });
      }

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return res.status(400).json({
          success: false,
          message: "The uploaded spreadsheet contains no sheets.",
        });
      }

      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows: Array<Record<string, any>> = xlsx.utils.sheet_to_json(sheet, { defval: "" });

      if (rawRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "The uploaded spreadsheet contains no data rows.",
        });
      }

      const result = await executeBulkImport({
        collegeId,
        actorId: req.user!.id,
        actorIsSuperAdmin: req.user!.role === "super_admin",
        rawRows,
        atomic,
        defaultInitialCredits: initialCredits,
      });

      const statusCode = result.success ? 201 : 400;
      res.status(statusCode).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/enterprise/students/:id/resend-invite - Send a single-use password setup link.
// The student's current password and sessions are deliberately unchanged here.
router.post(
  "/students/:id/resend-invite",
  requirePermission("STUDENT_CREATE"),
  resendInvitationLimiter,
  async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const { id } = req.params;
    const facultyScope = await getFacultyStudentScope(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin",
      true
    );
    const scopeConditions = buildFacultyStudentScopeConditions(facultyScope);

    const student = await prisma.collegeStudent.findFirst({
      where: buildScopedStudentWhere(collegeId, scopeConditions, { id }),
      include: {
        user: true,
        college: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student record not found in your college.",
      });
    }

    // Store only a SHA-256 hash. The raw token exists only long enough to build
    // the setup link and is never returned, logged, or persisted.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Latest-token-only policy: revoke older usable setup links and persist the
    // replacement before attempting delivery. A database failure therefore
    // cannot result in an email containing an unusable, unpersisted token.
    const invitation = await prisma.$transaction(async (tx) => {
      // Serialize concurrent resends for the same student before examining or
      // replacing token state.
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "User" WHERE "id" = ${student.userId} FOR UPDATE
      `);

      await tx.invitation.updateMany({
        where: {
          collegeId,
          email: student.user.email,
          role: "student",
          status: { in: ["pending", "sent"] },
        },
        data: { status: "revoked" },
      });

      return tx.invitation.create({
        data: {
          collegeId,
          email: student.user.email,
          role: "student",
          tokenHash,
          expiresAt,
          status: "pending",
          invitedById: req.user!.id,
          metadata: {
            purpose: "password_setup",
            deliveryStatus: "pending",
            name: student.user.name,
            enrollmentNumber: student.enrollmentNumber,
            program: student.program,
            course: student.course,
            section: student.section,
            batch: student.batch,
          },
        },
      });
    });

    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    const setupLink = `${frontendUrl}/setup-password?token=${encodeURIComponent(rawToken)}`;
    let deliveryResult: Awaited<ReturnType<typeof EmailService.sendStudentPasswordSetupEmail>>;

    try {
      deliveryResult = await EmailService.sendStudentPasswordSetupEmail({
        to: student.user.email,
        recipientName: student.user.name,
        collegeName: student.college.name,
        enrollmentNumber: student.enrollmentNumber,
        setupLink,
      });
    } catch (mailErr: any) {
      deliveryResult = { success: false, error: mailErr?.message || "Failed to dispatch password setup email" };
    }

    if (!deliveryResult.success) {
      const emailError = publicStudentEmailError(deliveryResult.error) || "The invitation email could not be sent.";
      await prisma.invitation.updateMany({
        where: { id: invitation.id, status: "pending" },
        data: {
          status: "failed",
          metadata: {
            purpose: "password_setup",
            deliveryStatus: "failed",
            name: student.user.name,
            enrollmentNumber: student.enrollmentNumber,
            emailError,
          },
        },
      }).catch((statusError) => {
        console.error("Failed to record password setup email failure.");
      });

      await logEnterpriseAudit({
        collegeId,
        actorId: req.user!.id,
        action: "STUDENT_PASSWORD_SETUP_DELIVERY_FAILED",
        entity: "CollegeStudent",
        entityId: student.id,
        newValue: { studentEmail: student.user.email },
      });

      return res.status(502).json({
        success: false,
        message: "Unable to send the password setup email. The student's existing credentials remain unchanged.",
        invitationStatus: "failed",
      });
    }

    // Delivery status is post-send bookkeeping. Keep the invitation itself
    // pending so its single-use token remains acceptable.
    await prisma.invitation.updateMany({
      where: { id: invitation.id, status: "pending" },
      data: {
        metadata: {
          purpose: "password_setup",
          deliveryStatus: "sent",
          name: student.user.name,
          enrollmentNumber: student.enrollmentNumber,
          sentAt: new Date().toISOString(),
        },
      },
    }).catch((statusError) => {
      console.error("Failed to record password setup email delivery status.");
    });

    await logEnterpriseAudit({
      collegeId,
      actorId: req.user!.id,
      action: "STUDENT_PASSWORD_SETUP_SENT",
      entity: "CollegeStudent",
      entityId: student.id,
      newValue: {
        studentEmail: student.user.email,
        invitationStatus: "sent",
      },
    });

    res.json({
      success: true,
      message: `Password setup email sent to ${student.user.email}.`,
      invitationStatus: "sent",
    });
  } catch (error) {
    next(error);
  }
  }
);

// PUT /api/enterprise/students/:id - Alias for PATCH (frontend compatibility)
router.put("/students/:id", requirePermission("STUDENT_EDIT"), async (req, res, next) => {
  // Same as PATCH — frontend sends PUT for student updates
  try {
    const collegeId = req.collegeId!;
    const { id } = req.params;

    const data = studentUpdateSchema.parse(req.body);
    const facultyScope = await getFacultyStudentScope(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin",
      true
    );
    const scopeConditions = buildFacultyStudentScopeConditions(facultyScope);
    const student = await prisma.collegeStudent.findFirst({
      where: buildScopedStudentWhere(collegeId, scopeConditions, { id }),
      include: { user: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }

    const proposedStudent = { ...student, ...data };
    if (!isStudentWithinFacultyScope(facultyScope, proposedStudent)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: The requested student scope is outside your assigned access.",
      });
    }

    const updateResult = await prisma.collegeStudent.updateMany({
      where: buildScopedStudentWhere(collegeId, scopeConditions, { id }),
      data,
    });
    if (updateResult.count !== 1) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }
    const updated = await prisma.collegeStudent.findUniqueOrThrow({ where: { id } });

    await logEnterpriseAudit({
      collegeId,
      actorId: req.user!.id,
      action: "STUDENT_UPDATED",
      entity: "CollegeStudent",
      entityId: id,
      oldValue: student,
      newValue: updated,
    });

    res.json({ success: true, student: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/enterprise/students/:id - Deactivate or remove student
router.delete("/students/:id", requirePermission("STUDENT_EDIT"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const { id } = req.params;
    const facultyScope = await getFacultyStudentScope(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin",
      true
    );
    const scopeConditions = buildFacultyStudentScopeConditions(facultyScope);

    // Soft-deactivate: set status to inactive on both student profile and user account
    const student = await prisma.$transaction(async (tx) => {
      const currentStudent = await tx.collegeStudent.findFirst({
        where: buildScopedStudentWhere(collegeId, scopeConditions, { id }),
        include: { user: true },
      });
      if (!currentStudent) return null;

      const updateResult = await tx.collegeStudent.updateMany({
        where: buildScopedStudentWhere(collegeId, scopeConditions, { id }),
        data: { status: "inactive" },
      });
      if (updateResult.count !== 1) return null;
      await tx.user.update({ where: { id: currentStudent.userId }, data: { isActive: false } });
      return currentStudent;
    }, { maxWait: 20000, timeout: 60000 });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }

    await logEnterpriseAudit({
      collegeId,
      actorId: req.user!.id,
      action: "STUDENT_DEACTIVATED",
      entity: "CollegeStudent",
      entityId: id,
      oldValue: { status: student.status },
      newValue: { status: "inactive" },
    });

    res.json({
      success: true,
      message: `Student "${student.user.name}" has been deactivated.`,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/enterprise/students/:id - Update student
router.patch("/students/:id", requirePermission("STUDENT_EDIT"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const { id } = req.params;

    const data = studentUpdateSchema.parse(req.body);
    const facultyScope = await getFacultyStudentScope(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin",
      true
    );
    const scopeConditions = buildFacultyStudentScopeConditions(facultyScope);
    const student = await prisma.collegeStudent.findFirst({
      where: buildScopedStudentWhere(collegeId, scopeConditions, { id }),
      include: { user: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }

    const proposedStudent = { ...student, ...data };
    if (!isStudentWithinFacultyScope(facultyScope, proposedStudent)) {
      return res.status(403).json({
        success: false,
        message: "Access denied: The requested student scope is outside your assigned access.",
      });
    }

    const updateResult = await prisma.collegeStudent.updateMany({
      where: buildScopedStudentWhere(collegeId, scopeConditions, { id }),
      data,
    });
    if (updateResult.count !== 1) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }
    const updated = await prisma.collegeStudent.findUniqueOrThrow({ where: { id } });

    await logEnterpriseAudit({
      collegeId,
      actorId: req.user!.id,
      action: "STUDENT_UPDATED",
      entity: "CollegeStudent",
      entityId: id,
      oldValue: student,
      newValue: updated,
    });

    res.json({ success: true, student: updated });
  } catch (error) {
    next(error);
  }
});

// ===========================================================================
// 4. INTERVIEW CREDIT DISTRIBUTION & LEDGER
// ===========================================================================

// GET /api/enterprise/credits - Get summary
router.get("/credits", requirePermission("INTERVIEW_CREDIT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const account = await prisma.collegeCreditAccount.findUnique({
      where: { collegeId },
    });

    res.json({
      success: true,
      balance: account?.balance ?? 0,
      totalAllocated: account?.totalAllocated ?? 0,
      totalDistributed: account?.totalDistributed ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/enterprise/credits/preview - Calculate required credits and preview matches before execution
const handleCreditPreview = async (req: any, res: any, next: any) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getRequestFacultyScopeConditions(req);

    const schema = z.object({
      creditsPerStudent: z.number().int().min(1, "Credits per student must be at least 1"),
      filters: z.object({
        program: z.string().optional(),
        course: z.string().optional(),
        section: z.string().optional(),
        batch: z.string().optional(),
        studentIds: z.array(z.string()).optional(),
      }).optional(),
      program: z.string().optional(),
      course: z.string().optional(),
      section: z.string().optional(),
      batch: z.string().optional(),
      studentIds: z.array(z.string()).optional(),
    });

    const parsed = schema.parse(req.body);
    const creditsPerStudent = parsed.creditsPerStudent;
    const filterProgram = parsed.filters?.program || parsed.program;
    const filterCourse = parsed.filters?.course || parsed.course;
    const filterSection = parsed.filters?.section || parsed.section;
    const filterBatch = parsed.filters?.batch || parsed.batch;
    const filterStudentIds = parsed.filters?.studentIds || parsed.studentIds;

    const studentFilters: any = { status: "active" };
    if (filterProgram) studentFilters.program = filterProgram;
    if (filterCourse) studentFilters.course = filterCourse;
    if (filterSection) studentFilters.section = filterSection;
    if (filterBatch) studentFilters.batch = filterBatch;
    if (filterStudentIds && filterStudentIds.length > 0) {
      studentFilters.id = { in: filterStudentIds };
    }
    const where = buildScopedStudentWhere(collegeId, scopeConditions, studentFilters);

    const [eligibleStudentsCount, creditAccount] = await Promise.all([
      prisma.collegeStudent.count({ where }),
      prisma.collegeCreditAccount.findUnique({ where: { collegeId } }),
    ]);

    const availableCredits = creditAccount?.balance ?? 0;
    const totalCreditsRequired = eligibleStudentsCount * creditsPerStudent;
    const remainingCredits = availableCredits - totalCreditsRequired;
    const isSufficient = remainingCredits >= 0;

    res.json({
      success: true,
      preview: {
        eligibleStudentsCount,
        creditsPerStudent,
        totalCreditsRequired,
        availableCredits,
        remainingCredits,
        isSufficient,
      },
      matchingStudentsCount: eligibleStudentsCount,
      creditsPerStudent,
      totalCreditsNeeded: totalCreditsRequired,
      currentCollegeBalance: availableCredits,
      balanceAfterDistribution: remainingCredits,
      hasSufficientBalance: isSufficient,
    });
  } catch (error) {
    next(error);
  }
};

router.post("/credits/preview", requirePermission("INTERVIEW_CREDIT_ASSIGN"), handleCreditPreview);
router.post("/credits/preview-distribution", requirePermission("INTERVIEW_CREDIT_ASSIGN"), handleCreditPreview);

// POST /api/enterprise/credits/student-assign - Assign or adjust credits for a single student
const handleStudentAssign = async (req: any, res: any, next: any) => {
  try {
    const collegeId = req.collegeId!;
    const schema = z.object({
      studentId: z.string().min(1, "Student ID is required"),
      amount: z.number().int().max(2147483647).min(1, "Amount must be at least 1 credit"),
      reason: z.string().min(3, "Reason is required"),
    });

    const { studentId, amount, reason } = schema.parse(req.body);

    const student = await prisma.collegeStudent.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    const accessibleStudent = student
      ? await facultyCanAccessStudent(
          req.user!.id,
          collegeId,
          student.id,
          req.user!.role === "super_admin",
          true
        )
      : null;
    if (!student || !accessibleStudent) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }

    const key = requireCreditIdempotencyKey(req.get("Idempotency-Key"));
    const receipt = await executeIdempotentCreditOperation(prisma,
      { collegeId, actorId: req.user!.id, operation: "STUDENT_ASSIGNMENT", key },
      { studentId, amount, reason }, async (tx) => {
      const transfer = await allocateInstitutionCreditsToStudent({
        tx,
        collegeId,
        studentId: student.id,
        userId: student.userId,
        actorId: req.user!.id,
        amount,
        type: "STUDENT_ASSIGNMENT",
        reason,
      });
      if (!transfer) throw new Error("Credit transfer amount must be greater than zero.");
      const result = {
        updatedAccount: transfer.account,
        updatedUserCredit: transfer.studentCredit,
        txn: transfer.transaction,
      };

      await logEnterpriseAudit({
        transactionClient: tx,
        propagateErrors: true,
        collegeId,
        actorId: req.user!.id,
        action: "STUDENT_CREDITS_ASSIGNED",
        entity: "CollegeStudent",
        entityId: studentId,
        newValue: {
          amount,
          reason,
          studentName: student.user.name,
          newStudentBalance: result.updatedUserCredit.balance,
          remainingCollegeCredits: result.updatedAccount.balance,
        },
      });

      return {
        success: true,
        message: `Successfully assigned ${amount} credits to ${student.user.name}.`,
        studentBalance: result.updatedUserCredit.balance,
        collegeBalance: result.updatedAccount.balance,
      };
    });
    res.status(receipt.status).json(receipt.body);
  } catch (error: any) {
    if (error instanceof CreditIdempotencyError && error.statusCode === 503) res.set("Retry-After", "2");
    res.status(error instanceof CreditIdempotencyError ? error.statusCode : 400).json({
      success: false,
      message: error.message || "Failed to assign credits.",
    });
  }
};

router.post("/credits/student-assign", requirePermission("INTERVIEW_CREDIT_ASSIGN"), handleStudentAssign);
router.post("/credits/assign-student", requirePermission("INTERVIEW_CREDIT_ASSIGN"), handleStudentAssign);

// POST /api/enterprise/credits/distribute - Bulk or filtered credit assignment with atomic transaction
router.post("/credits/distribute", requirePermission("INTERVIEW_CREDIT_ASSIGN"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin",
      true
    );

    // Accept both flat body (frontend format) and nested filters object (legacy format)
    const schema = z.object({
      creditsPerStudent: z.number().int().max(2147483647).min(1, "Credits per student must be at least 1"),
      reason: z.string().min(3, "Reason is required"),
      // Flat fields from frontend
      program: z.string().optional(),
      course: z.string().optional(),
      section: z.string().optional(),
      batch: z.string().optional(),
      studentIds: z.array(z.string()).optional(),
      // Nested filters for legacy/API compatibility
      filters: z.object({
        program: z.string().optional(),
        course: z.string().optional(),
        section: z.string().optional(),
        batch: z.string().optional(),
        studentIds: z.array(z.string()).optional(),
      }).optional(),
    });

    const parsed = schema.parse(req.body);
    const { creditsPerStudent, reason } = parsed;
    // Merge: nested filters take precedence, then fall back to flat fields
    const filters = {
      program: parsed.filters?.program ?? parsed.program,
      course: parsed.filters?.course ?? parsed.course,
      section: parsed.filters?.section ?? parsed.section,
      batch: parsed.filters?.batch ?? parsed.batch,
      studentIds: parsed.filters?.studentIds ?? parsed.studentIds,
    };

    // Explicit recipients are a set; empty filters have the same meaning as absent filters.
    for (const name of ["program", "course", "section", "batch"] as const) {
      if (!filters[name]) filters[name] = undefined;
    }
    filters.studentIds = filters.studentIds?.length ? [...new Set(filters.studentIds)].sort() : undefined;
    const key = requireCreditIdempotencyKey(req.get("Idempotency-Key"));
    const receipt = await executeIdempotentCreditOperation(prisma,
      { collegeId, actorId: req.user!.id, operation: "BULK_DISTRIBUTION", key },
      { creditsPerStudent, reason, filters }, async (tx) => {
      // 1. Build filter query
      const studentFilters: any = { status: "active" };
      if (filters.program) studentFilters.program = filters.program;
      if (filters.course) studentFilters.course = filters.course;
      if (filters.section) studentFilters.section = filters.section;
      if (filters.batch) studentFilters.batch = filters.batch;
      if (filters.studentIds && filters.studentIds.length > 0) {
        studentFilters.id = { in: filters.studentIds };
      }
      const where = buildScopedStudentWhere(collegeId, scopeConditions, studentFilters);

      // 2. Fetch eligible students
      const students = await tx.collegeStudent.findMany({
        where,
        select: { id: true, userId: true, enrollmentNumber: true },
        orderBy: { id: "asc" },
      });

      if (students.length === 0) {
        throw new Error("No eligible active students found matching the selected filter criteria.");
      }

      const distStartTime = Date.now();

      // 3. Atomically allocate credits in bulk with set-based operations.
      // A single conditional UPDATE decrements institution balance by totalRequired,
      // student UserCredit records are bulk created and incremented in chunks of 1,000,
      // and ledger transactions are bulk created in chunks of 1,000.
      const transfer = await allocateInstitutionCreditsToStudentsBulk({
        tx,
        collegeId,
        students,
        actorId: req.user!.id,
        amountPerStudent: creditsPerStudent,
        type: "FACULTY_DISTRIBUTION",
        reason,
        batchFilter: filters,
      });

      const result = {
        distributedCount: transfer.distributedCount,
        totalCreditsDistributed: transfer.totalCreditsDistributed,
        balanceRemaining: transfer.account.balance,
      };

      await logEnterpriseAudit({
        transactionClient: tx,
        propagateErrors: true,
        collegeId,
        actorId: req.user!.id,
        action: "BULK_CREDITS_DISTRIBUTED",
        entity: "CollegeCreditAccount",
        newValue: {
          studentsCount: result.distributedCount,
          creditsPerStudent,
          totalCredits: result.totalCreditsDistributed,
          remainingBalance: result.balanceRemaining,
          filters,
          reason,
          durationMs: Date.now() - distStartTime,
        },
      });

      return {
        success: true,
        message: `Successfully distributed ${result.totalCreditsDistributed} credits across ${result.distributedCount} students.`,
        ...result,
      };
    });
    res.status(receipt.status).json(receipt.body);
  } catch (error: any) {
    if (error instanceof CreditIdempotencyError && error.statusCode === 503) res.set("Retry-After", "2");
    res.status(error instanceof CreditIdempotencyError ? error.statusCode : 400).json({
      success: false,
      message: error.message || "Failed to distribute credits.",
    });
  }
});

// GET /api/enterprise/credits/ledger - Scope-authorized credit allocation ledger
router.get("/credits/ledger", requirePermission("INTERVIEW_CREDIT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const facultyScope = await getFacultyStudentScope(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin",
      true
    );
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const type = req.query.type as string;
    const search = ((req.query.search as string) || "").trim();
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const studentId = ((req.query.studentId as string) || "").trim();
    const program = ((req.query.program as string) || "").trim();
    const course = ((req.query.course as string) || "").trim();
    const section = ((req.query.section as string) || "").trim();
    const batch = ((req.query.batch as string) || "").trim();

    const where: any = { collegeId };
    const and: any[] = [];
    if (type) where.type = type;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const requestedStudentFilters: any = {};
    if (studentId) requestedStudentFilters.id = studentId;
    if (program) requestedStudentFilters.program = program;
    if (course) requestedStudentFilters.course = course;
    if (section) requestedStudentFilters.section = section;
    if (batch) requestedStudentFilters.batch = batch;

    // Regular faculty can see only student-associated transactions inside their
    // authoritative current cohort scope. Studentless institution allocations
    // have no cohort association and are therefore visible only to institution-
    // wide roles (Main Faculty and super-admin). The schema has no historical
    // cohort snapshot, so student-linked visibility follows the current profile.
    if (!facultyScope.unrestricted || Object.keys(requestedStudentFilters).length > 0) {
      const scopeConditions = buildFacultyStudentScopeConditions(facultyScope);
      and.push({
        student: {
          is: buildScopedStudentWhere(collegeId, scopeConditions, requestedStudentFilters),
        },
      });
    }

    if (search) {
      and.push({ OR: [
        { reason: { contains: search, mode: "insensitive" } },
        { createdBy: { name: { contains: search, mode: "insensitive" } } },
        { createdBy: { email: { contains: search, mode: "insensitive" } } },
        { student: { enrollmentNumber: { contains: search, mode: "insensitive" } } },
        { student: { user: { name: { contains: search, mode: "insensitive" } } } },
        { student: { user: { email: { contains: search, mode: "insensitive" } } } },
      ] });
    }
    if (and.length > 0) where.AND = and;

    const [total, transactions] = await Promise.all([
      prisma.collegeCreditTransaction.count({ where }),
      prisma.collegeCreditTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          student: {
            select: {
              id: true,
              enrollmentNumber: true,
              program: true,
              course: true,
              section: true,
              batch: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      }),
    ]);

    const mappedTransactions = transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      reason: t.reason,
      createdAt: t.createdAt,
      batchFilter: t.batchFilter,
      performedBy: {
        name: t.createdBy.name,
        email: t.createdBy.email,
        role: t.createdBy.role,
      },
      recipientStudent: t.student
        ? {
            enrollmentNumber: t.student.enrollmentNumber,
            name: t.student.user.name,
            email: t.student.user.email,
            program: t.student.program,
            course: t.student.course,
            section: t.student.section,
            batch: t.student.batch,
          }
        : null,
    }));

    // Get current college balance for display
    const creditAccount = await prisma.collegeCreditAccount.findUnique({ where: { collegeId } });

    res.json({
      success: true,
      // 'transactions' key matches EnterpriseDashboardPage frontend expectation
      transactions: mappedTransactions,
      // Also expose as 'data' for backward compat
      data: mappedTransactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      collegeBalance: creditAccount?.balance ?? 0,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================================================
// 5. STUDENT PERFORMANCE REPORTS & COHORT ANALYTICS
// ===========================================================================

// GET /api/enterprise/reports - Filtered individual interview evaluation reports across cohort
router.get("/reports", requirePermission("REPORT_VIEW"), validateReportQuery, async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getRequestFacultyScopeConditions(req);

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = ((req.query.search as string) || "").trim();
    const program = req.query.program as string;
    const course = req.query.course as string;
    const section = req.query.section as string;
    const batch = req.query.batch as string;
    const status = req.query.status as string;
    const scoreTier = req.query.scoreTier as string; // 'high' (80+), 'moderate' (60-79), 'needs_improvement' (<60), 'untested'
    const view = (req.query.view as string) || "reports";

    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

    if (view === "students" || view === "analytics") {
      const studentWhereWithSearch = buildStudentFilters({
        collegeId,
        scopeConditions,
        search,
        program,
        course,
        section,
        batch,
        status,
      });

      const [total, students] = await prisma.$transaction([
        prisma.collegeStudent.count({ where: studentWhereWithSearch }),
        prisma.collegeStudent.findMany({
          relationLoadStrategy: "join",
          skip: (page - 1) * limit, take: limit, where: studentWhereWithSearch,
          orderBy: [{ batch: "desc" }, { enrollmentNumber: "asc" }, { id: "asc" }],
          select: studentSummarySelect(collegeId),
        }),
      ], { isolationLevel: "RepeatableRead" });
      const averages = await studentScoreAverages(collegeId, students.map(student => student.userId));
      const data = students.map(student => serializeStudentSummary(student, averages.get(student.userId) ?? null));
      return res.json({ success: true, reports: data, data, total,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }

    // Default & Canonical: Return individual interview evaluation reports
    const where = buildReportFilters({
      collegeId,
      scopeConditions,
      search,
      program,
      course,
      section,
      batch,
      status,
      scoreTier,
      minScore: req.query.minScore ? parseFloat(req.query.minScore as string) : undefined,
      maxScore: req.query.maxScore ? parseFloat(req.query.maxScore as string) : undefined,
      startDate: (req.query.startDate || req.query.dateFrom) as string,
      endDate: (req.query.endDate || req.query.dateTo) as string,
      reportType: req.query.reportType as string,
    });

    // Configure SQL-level order by
    let orderBy: any = { createdAt: sortOrder };
    if (sortBy === "overallScore" || sortBy === "averageScore" || sortBy === "score") {
      orderBy = { overallScore: sortOrder };
    } else if (sortBy === "name" || sortBy === "studentName") {
      orderBy = { session: { user: { name: sortOrder } } };
    } else if (sortBy === "enrollmentNumber" || sortBy === "rollNumber") {
      orderBy = { session: { user: { studentProfile: { enrollmentNumber: sortOrder } } } };
    } else if (sortBy === "targetRole") {
      orderBy = { session: { targetRole: sortOrder } };
    } else if (sortBy === "createdAt" || sortBy === "date" || sortBy === "latestInterviewDate") {
      orderBy = { createdAt: sortOrder };
    }

    const reports = await prisma.interviewReport.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        session: {
          select: {
            id: true,
            targetRole: true,
            difficulty: true,
            interviewStyle: true,
            durationMins: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                studentProfile: {
                  select: {
                    id: true,
                    enrollmentNumber: true,
                    program: true,
                    course: true,
                    section: true,
                    batch: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const scoreGroups = await prisma.interviewReport.groupBy({
      by: ["overallScore", "scoreScale"],
      where,
      _count: { _all: true },
    });
    let total = 0;
    let scoreSum = 0;
    let highCount = 0;
    let moderateCount = 0;
    let needsPracticeCount = 0;
    for (const group of scoreGroups) {
      const count = group._count._all;
      const canonicalScore = normalizeReportScore(group);
      if (canonicalScore === null) continue;
      total += count;
      scoreSum += canonicalScore * count;
      if (canonicalScore >= 80) highCount += count;
      else if (canonicalScore >= 60) moderateCount += count;
      else needsPracticeCount += count;
    }
    const summary = {
      totalReports: total,
      totalStudentsInView: total,
      cohortAverage: total > 0 ? Math.round(scoreSum / total) : 0,
      jobReadyCount: highCount,
      moderateCount,
      needsPracticeCount,
      untestedCount: 0,
    };

    const mappedReports: EnterpriseReportRow[] = reports.map((r) => {
      const studentProfile = r.session.user?.studentProfile;
      const canonicalScore = normalizeReportScore(r as any) ?? 0;
      const readinessRating = getReadinessCategory(canonicalScore) as "Job-Ready" | "Moderate" | "Needs Practice";

      return {
        id: r.id,
        reportId: r.id,
        sessionId: r.sessionId,
        student: {
          id: studentProfile?.id || "",
          userId: r.session.user?.id || "",
          name: r.session.user?.name || "Student",
          email: r.session.user?.email || "",
          phone: r.session.user?.phone || null,
          enrollmentNumber: studentProfile?.enrollmentNumber || "",
          program: studentProfile?.program || "",
          course: studentProfile?.course || "",
          section: studentProfile?.section || "",
          batch: studentProfile?.batch || "",
        },
        targetRole: r.session.targetRole,
        difficulty: r.session.difficulty,
        interviewStyle: r.session.interviewStyle,
        durationMins: r.session.durationMins,
        overallScore: canonicalScore,
        readinessRating,
        categoryScores: r.categoryScores as Record<string, number>,
        speakingPace: r.speakingPace ?? null,
        fillerWords: r.fillerWords ?? null,
        createdAt: r.createdAt.toISOString(),

        // Backward compatibility convenience fields
        name: r.session.user?.name || "",
        enrollmentNumber: studentProfile?.enrollmentNumber || "",
        program: studentProfile?.program || "",
        course: studentProfile?.course || "",
        section: studentProfile?.section || "",
        batch: studentProfile?.batch || "",
        averageScore: canonicalScore,
        latestScore: canonicalScore,
        latestTargetRole: r.session.targetRole,
        latestInterviewDate: r.createdAt.toISOString(),
        session: {
          id: r.sessionId,
          targetRole: r.session.targetRole,
          difficulty: r.session.difficulty,
          user: {
            name: r.session.user?.name || "",
            studentProfile: {
              enrollmentNumber: studentProfile?.enrollmentNumber || "",
              program: studentProfile?.program || "",
            },
          },
        },
      };
    });

    const response: EnterpriseReportsResponse = {
      success: true,
      summary,
      reports: mappedReports,
      data: mappedReports,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * Sanitizes a spreadsheet cell value to prevent Formula Injection (CSV / Excel Injection).
 * If the value starts with '=', '+', '-', '@', '\t', or '\r', prefix with single quote (').
 */
export function sanitizeSpreadsheetCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

// GET /api/enterprise/reports/summary - Aggregate reporting metrics for cohort
router.get("/reports/summary", requirePermission("REPORT_VIEW"), validateReportQuery, async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getRequestFacultyScopeConditions(req);

    const program = req.query.program as string;
    const course = req.query.course as string;
    const section = req.query.section as string;
    const batch = req.query.batch as string;

    const where = req.query.view === "students"
      ? { session: { collegeId, status: "completed", user: { studentProfile: buildStudentFilters({
          collegeId, scopeConditions, program, course, section, batch,
          search: req.query.search as string, status: req.query.status as string,
        }) } } }
      : buildReportFilters({ ...req.query, collegeId, scopeConditions } as any);

    const scoreGroups = await prisma.interviewReport.groupBy({
      by: ["overallScore", "scoreScale"], where, _count: { _all: true },
    });
    let totalReports = 0;
    let scoreSum = 0;
    let validReports = 0;
    let high = 0;
    let moderate = 0;
    let needsPractice = 0;
    for (const group of scoreGroups) {
      const count = group._count._all;
      const score = normalizeReportScore(group);
      totalReports += count;
      if (score === null) continue;
      validReports += count;
      scoreSum += score * count;
      if (score >= 80) high += count;
      else if (score >= 60) moderate += count;
      else needsPractice += count;
    }

    const averageOverallScore = validReports > 0 ? Math.round(scoreSum / validReports) : 0;

    res.json({
      success: true,
      totalReports,
      averageOverallScore,
      scoreDistribution: [
        { label: "High (80-100)", count: high },
        { label: "Moderate (60-79)", count: moderate },
        { label: "Needs Practice (<60)", count: needsPractice },
      ],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/enterprise/reports/export - Export student performance and cohort reports (CSV / XLSX)
router.get(
  "/reports/export",
  requirePermission("REPORT_VIEW"),
  requirePermission("REPORT_EXPORT"),
  validateReportQuery,
  async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getRequestFacultyScopeConditions(req);

    const format = ((req.query.format as string) || "csv").toLowerCase();
    const search = ((req.query.search as string) || "").trim();
    const program = req.query.program as string;
    const course = req.query.course as string;
    const section = req.query.section as string;
    const batch = req.query.batch as string;
    const status = req.query.status as string;
    const scoreTier = req.query.scoreTier as string;
    const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;
    const maxScore = req.query.maxScore ? parseFloat(req.query.maxScore as string) : undefined;
    const startDate = (req.query.startDate || req.query.dateFrom) as string;
    const endDate = (req.query.endDate || req.query.dateTo) as string;
    const reportType = req.query.reportType as string;
    const view = (req.query.view as string) || "reports";

    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

    const exportStartTime = Date.now();
    const exportSnapshotTime = new Date();

    const defaultReportHeaders = [
      "Report ID",
      "Enrollment Number",
      "Student Name",
      "Email",
      "Phone",
      "Program",
      "Course",
      "Section",
      "Batch",
      "Target Role",
      "Difficulty",
      "Overall Score (%)",
      "Readiness Rating",
      "Speaking Pace (WPM)",
      "Filler Words",
      "Date Completed",
    ];

    const defaultStudentHeaders = [
      "Enrollment Number",
      "Student Name",
      "Email",
      "Phone",
      "Program",
      "Course",
      "Section",
      "Batch",
      "Status",
      "Available Credits",
      "Completed Interviews",
      "Average Score",
      "Readiness Rating",
      "Latest Score",
      "Latest Target Role",
      "Last Interview",
      "Has Resume",
    ];

    const fallbackHeaders = view === "students" ? defaultStudentHeaders : defaultReportHeaders;
    const headers = fallbackHeaders;

    const formatReportRow = (r: any) => {
      const studentProfile = r.session?.user?.studentProfile;
      const canonicalScore = normalizeReportScore(r as any);
      const readiness = getReadinessCategory(canonicalScore);

      return {
        "Report ID": sanitizeSpreadsheetCell(r.id),
        "Enrollment Number": sanitizeSpreadsheetCell(studentProfile?.enrollmentNumber || "—"),
        "Student Name": sanitizeSpreadsheetCell(r.session?.user?.name || "—"),
        "Email": sanitizeSpreadsheetCell(r.session?.user?.email || "—"),
        "Phone": sanitizeSpreadsheetCell(r.session?.user?.phone || ""),
        "Program": sanitizeSpreadsheetCell(studentProfile?.program || "—"),
        "Course": sanitizeSpreadsheetCell(studentProfile?.course || "—"),
        "Section": sanitizeSpreadsheetCell(studentProfile?.section || "—"),
        "Batch": sanitizeSpreadsheetCell(studentProfile?.batch || "—"),
        "Target Role": sanitizeSpreadsheetCell(r.session?.targetRole),
        "Difficulty": sanitizeSpreadsheetCell(r.session?.difficulty),
        "Overall Score (%)": canonicalScore !== null ? canonicalScore : "N/A",
        "Readiness Rating": sanitizeSpreadsheetCell(readiness),
        "Speaking Pace (WPM)": r.speakingPace !== null ? r.speakingPace : "N/A",
        "Filler Words": r.fillerWords !== null ? r.fillerWords : "N/A",
        "Date Completed": new Date(r.createdAt).toISOString().split("T")[0],
      };
    };

    const formatStudentRow = (s: any) => {
      const completedSessions = s.user?.interviewSessions?.filter((sess: any) => sess.report !== null) || [];
      const validScores = completedSessions
        .map((sess: any) => sess.report ? normalizeReportScore(sess.report as any) : null)
        .filter((score: any): score is number => score !== null);
      const averageScore =
        validScores.length > 0
          ? Math.round(validScores.reduce((acc: number, score: number) => acc + score, 0) / validScores.length)
          : null;
      const latestSession = completedSessions[0];
      const latestOverallScore = latestSession?.report
        ? normalizeReportScore(latestSession.report as any)
        : null;

      const readiness = getReadinessCategory(averageScore);

      return {
        "Enrollment Number": sanitizeSpreadsheetCell(s.enrollmentNumber),
        "Student Name": sanitizeSpreadsheetCell(s.user?.name),
        "Email": sanitizeSpreadsheetCell(s.user?.email),
        "Phone": sanitizeSpreadsheetCell(s.user?.phone || ""),
        "Program": sanitizeSpreadsheetCell(s.program),
        "Course": sanitizeSpreadsheetCell(s.course),
        "Section": sanitizeSpreadsheetCell(s.section),
        "Batch": sanitizeSpreadsheetCell(s.batch),
        "Status": sanitizeSpreadsheetCell(s.status),
        "Available Credits": s.user?.credits?.balance ?? 0,
        "Completed Interviews": completedSessions.length,
        "Average Score": averageScore !== null ? averageScore : "N/A",
        "Readiness Rating": sanitizeSpreadsheetCell(readiness),
        "Latest Score": latestOverallScore !== null ? latestOverallScore : "N/A",
        "Latest Target Role": sanitizeSpreadsheetCell(latestSession?.targetRole || "N/A"),
        "Last Interview": latestSession?.report?.createdAt?.toISOString().slice(0, 10) ?? "N/A",
        "Has Resume": (s.user?.resumes?.length ?? 0) > 0 ? "Yes" : "No",
      };
    };

    const studentSelect = {
      id: true,
      enrollmentNumber: true,
      program: true,
      course: true,
      section: true,
      batch: true,
      status: true,
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          credits: { select: { balance: true } },
          interviewSessions: {
            where: evaluatedSessions(collegeId),
            orderBy: [{ report: { createdAt: "desc" as const } }, { report: { id: "desc" as const } }],
            select: {
              id: true,
              targetRole: true,
              report: {
                select: {
                  overallScore: true,
                  scoreScale: true,
                  createdAt: true,
                },
              },
            },
          },
          resumes: {
            take: 1,
            orderBy: { updatedAt: "desc" as const },
            select: { fileName: true },
          },
        },
      },
    };

    const reportSelect = {
      id: true,
      overallScore: true,
      scoreScale: true,
      speakingPace: true,
      fillerWords: true,
      createdAt: true,
      session: {
        select: {
          id: true,
          targetRole: true,
          difficulty: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
              studentProfile: {
                select: {
                  enrollmentNumber: true,
                  program: true,
                  course: true,
                  section: true,
                  batch: true,
                },
              },
            },
          },
        },
      },
    };

    let studentWhere: any;
    let studentOrderBy: any;
    let reportWhere: any;
    let finalReportOrderBy: any;

    if (view === "students") {
      studentWhere = buildStudentFilters({
        collegeId,
        scopeConditions,
        search,
        program,
        course,
        section,
        batch,
        status,
      });
      studentOrderBy = [{ batch: "desc" as const }, { enrollmentNumber: "asc" as const }, { id: "asc" as const }];
    } else {
      reportWhere = buildReportFilters({
        collegeId,
        scopeConditions,
        search,
        program,
        course,
        section,
        batch,
        status,
        scoreTier,
        minScore,
        maxScore,
        startDate,
        endDate,
        reportType,
      });
      // Snapshot cutoff: ensure concurrent inserts don't shift pagination windows
      if (!reportWhere.createdAt?.lte) {
        reportWhere.createdAt = { ...(reportWhere.createdAt || {}), lte: exportSnapshotTime };
      }

      let orderBy: any = { createdAt: sortOrder };
      if (sortBy === "overallScore" || sortBy === "averageScore" || sortBy === "score") {
        orderBy = { overallScore: sortOrder };
      } else if (sortBy === "name" || sortBy === "studentName") {
        orderBy = { session: { user: { name: sortOrder } } };
      } else if (sortBy === "enrollmentNumber" || sortBy === "rollNumber") {
        orderBy = { session: { user: { studentProfile: { enrollmentNumber: sortOrder } } } };
      } else if (sortBy === "targetRole") {
        orderBy = { session: { targetRole: sortOrder } };
      } else if (sortBy === "createdAt" || sortBy === "date" || sortBy === "latestInterviewDate") {
        orderBy = { createdAt: sortOrder };
      }
      finalReportOrderBy = Array.isArray(orderBy) ? [...orderBy, { id: "asc" as const }] : [orderBy, { id: "asc" as const }];
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `student-reports-${timestamp}`;
    const BATCH_SIZE = 500;

    let clientDisconnected = false;
    req.on("close", () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
      }
    });

    if (format === "xlsx") {
      const exportRows: any[] = [];
      let offset = 0;
      let batchCount = 0;

      while (true) {
        if (clientDisconnected || res.destroyed || res.writableEnded) break;
        const batch = view === "students"
          ? await prisma.collegeStudent.findMany({
              where: studentWhere,
              orderBy: studentOrderBy,
              skip: offset,
              take: BATCH_SIZE,
              select: studentSelect,
            })
          : await prisma.interviewReport.findMany({
              where: reportWhere,
              orderBy: finalReportOrderBy,
              skip: offset,
              take: BATCH_SIZE,
              select: reportSelect,
            });

        batchCount++;
        if (batch.length === 0) break;

        for (const item of batch) {
          exportRows.push(view === "students" ? formatStudentRow(item) : formatReportRow(item));
        }

        offset += batch.length;
        if (batch.length < BATCH_SIZE) break;
      }

      if (clientDisconnected || res.destroyed || res.writableEnded) return;

      const worksheet =
        exportRows.length > 0
          ? xlsx.utils.json_to_sheet(exportRows)
          : xlsx.utils.aoa_to_sheet([fallbackHeaders]);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, view === "students" ? "Student Cohort" : "Student Reports");
      const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

      await logEnterpriseAudit({
        collegeId,
        actorId: req.user!.id,
        action: "REPORTS_EXPORTED",
        entity: "Report",
        newValue: {
          format,
          exportedCount: exportRows.length,
          batchCount,
          durationMs: Date.now() - exportStartTime,
          filters: { program, course, section, batch, status, search, scoreTier, startDate, endDate, reportType, view },
        },
      });

      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    // Default: Streaming CSV output with bounded memory and backpressure handling
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Write header line immediately
    res.write(headers.join(",") + "\r\n");

    const writeToStream = async (chunk: string): Promise<boolean> => {
      if (res.writableEnded || res.destroyed || clientDisconnected) return false;
      const canContinue = res.write(chunk);
      if (!canContinue) {
        await new Promise<void>((resolve) => {
          const onDrain = () => { cleanup(); resolve(); };
          const onClose = () => { cleanup(); resolve(); };
          const cleanup = () => {
            res.removeListener("drain", onDrain);
            res.removeListener("close", onClose);
          };
          res.once("drain", onDrain);
          res.once("close", onClose);
        });
      }
      return !clientDisconnected && !res.destroyed && !res.writableEnded;
    };

    let offset = 0;
    let totalExported = 0;
    let batchCount = 0;

    while (true) {
      if (clientDisconnected || res.destroyed || res.writableEnded) break;

      const batch = view === "students"
        ? await prisma.collegeStudent.findMany({
            where: studentWhere,
            orderBy: studentOrderBy,
            skip: offset,
            take: BATCH_SIZE,
            select: studentSelect,
          })
        : await prisma.interviewReport.findMany({
            where: reportWhere,
            orderBy: finalReportOrderBy,
            skip: offset,
            take: BATCH_SIZE,
            select: reportSelect,
          });

      batchCount++;
      if (batch.length === 0) break;

      let chunkCsv = "";
      for (const item of batch) {
        const row = view === "students" ? formatStudentRow(item) : formatReportRow(item);
        const line = headers
          .map((h) => {
            const val = String((row as any)[h] ?? "");
            const escaped = val.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",");
        chunkCsv += line + "\r\n";
      }

      const ok = await writeToStream(chunkCsv);
      if (!ok) break;

      totalExported += batch.length;
      offset += batch.length;
      if (batch.length < BATCH_SIZE) break;
    }

    if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
      res.end();
    }

    await logEnterpriseAudit({
      collegeId,
      actorId: req.user!.id,
      action: "REPORTS_EXPORTED",
      entity: "Report",
      newValue: {
        format,
        exportedCount: totalExported,
        batchCount,
        durationMs: Date.now() - exportStartTime,
        aborted: clientDisconnected,
        filters: { program, course, section, batch, status, search, scoreTier, startDate, endDate, reportType, view },
      },
    });
  } catch (error) {
    if (res.headersSent) {
      console.error("Enterprise report export stream aborted with error:", error instanceof Error ? error.message : "Stream failure");
      res.destroy(error instanceof Error ? error : new Error(String(error)));
    } else {
      next(error);
    }
  }
  }
);

// ===========================================================================
// 6. ENTERPRISE AUDIT LOGS (PHASE 13)
// ===========================================================================

// GET /api/enterprise/audit-logs - Query college-scoped audit ledger
router.get("/audit-logs", requirePermission("AUDIT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const rawPage = Number(req.query.page);
    const rawLimit = Number(req.query.limit);
    const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 15;
    const canonicalAction = resolveCanonicalAuditAction(req.query.action as string);
    const search = ((req.query.search as string) || "").trim();
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = { collegeId };
    if (canonicalAction) where.action = canonicalAction;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
        { actor: { name: { contains: search, mode: "insensitive" } } },
        { actor: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.enterpriseAuditLog.count({ where }),
      prisma.enterpriseAuditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const response: EnterpriseAuditLogsResponse = {
      success: true,
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entity: l.entity ?? null,
        entityId: l.entityId ?? null,
        actor: l.actor
          ? {
              id: l.actor.id,
              name: l.actor.name,
              email: l.actor.email,
              role: l.actor.role,
            }
          : null,
        // Defense in depth for historical rows written before centralized
        // audit sanitization was introduced.
        oldValue: sanitizeAuditValue(l.oldValue),
        newValue: sanitizeAuditValue(l.newValue),
        ipAddress: l.ipAddress ?? null,
        metadata: sanitizeAuditValue(l.metadata),
        createdAt: l.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
