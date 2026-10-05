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
  normalizeFacultyPermissions,
  requireTenant,
  requireCollegeAdmin,
  requirePermission,
  resolveEnterprisePermission,
} from "../../middleware/tenant.js";
import { EmailService } from "../../services/email.service.js";
import { logEnterpriseAudit } from "../../services/audit.service.js";
import { env } from "../../config/env.js";
import { isUniqueConstraintError, normalizeEmailIdentity } from "../../utils/identity.js";
import { getReadinessCategory, resolveCanonicalReportScore } from "../../utils/score.js";
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
router.use(requireAuth, requireTenant);

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

async function getTrustedFacultyMutationActor(userId: string, collegeId: string): Promise<FacultyMutationActor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      collegeId: true,
      isActive: true,
      facultyProfile: {
        select: {
          collegeId: true,
          isMainFaculty: true,
          permissions: true,
          status: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new FacultyAuthorizationError("Your account is inactive or no longer exists.");
  }

  if (user.role === "super_admin") {
    return {
      userId: user.id,
      collegeId,
      role: user.role,
      isMainFaculty: false,
      status: "active",
      permissions: ["all"],
    };
  }

  const faculty = user.facultyProfile;
  if (
    !faculty ||
    user.collegeId !== collegeId ||
    faculty.collegeId !== collegeId ||
    faculty.status !== "active"
  ) {
    throw new FacultyAuthorizationError("Your faculty account is not active in this college.");
  }

  return {
    userId: user.id,
    collegeId,
    role: user.role,
    isMainFaculty: faculty.isMainFaculty,
    status: faculty.status,
    permissions: normalizeFacultyPermissions(faculty.permissions),
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
const _facultyScopeCache = new Map<string, { scope: FacultyStudentScope; expiresAt: number }>();

async function getFacultyStudentScope(
  userId: string,
  collegeId: string,
  isSuperAdmin?: boolean,
  fresh = false
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

  const cacheKey = `${userId}:${collegeId}`;
  const cached = _facultyScopeCache.get(cacheKey);
  if (!fresh && cached && cached.expiresAt > Date.now()) {
    return cached.scope;
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

  _facultyScopeCache.set(cacheKey, { scope, expiresAt: Date.now() + 30_000 });
  return scope;
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

function buildScopedStudentWhere(collegeId: string, scopeConditions: any, filters: any = {}) {
  const clauses = [scopeConditions, filters].filter((clause) => Object.keys(clause).length > 0);
  return clauses.length > 0 ? { collegeId, AND: clauses } : { collegeId };
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
router.get("/filter-options", async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin"
    );

    const [programs, courses, sections, batches, departments, cohorts] = await Promise.all([
      prisma.collegeStudent.findMany({
        where: { collegeId, ...scopeConditions },
        select: { program: true },
        distinct: ["program"],
        orderBy: { program: "asc" },
      }),
      prisma.collegeStudent.findMany({
        where: { collegeId, ...scopeConditions },
        select: { course: true },
        distinct: ["course"],
        orderBy: { course: "asc" },
      }),
      prisma.collegeStudent.findMany({
        where: { collegeId, ...scopeConditions },
        select: { section: true },
        distinct: ["section"],
        orderBy: { section: "asc" },
      }),
      prisma.collegeStudent.findMany({
        where: { collegeId, ...scopeConditions },
        select: { batch: true },
        distinct: ["batch"],
        orderBy: { batch: "desc" },
      }),
      prisma.collegeStudent.findMany({
        where: { collegeId, ...scopeConditions, department: { not: null } },
        select: { department: true },
        distinct: ["department"],
        orderBy: { department: "asc" },
      }),
      prisma.collegeStudent.findMany({
        where: { collegeId, ...scopeConditions },
        select: { program: true, course: true, section: true, batch: true },
        distinct: ["program", "course", "section", "batch"],
        orderBy: [
          { program: "asc" },
          { course: "asc" },
          { section: "asc" },
          { batch: "desc" },
        ],
      }),
    ]);

    res.json({
      success: true,
      programs: programs.map((p) => p.program).filter(Boolean),
      courses: courses.map((c) => c.course).filter(Boolean),
      sections: sections.map((s) => s.section).filter(Boolean),
      batches: batches.map((b) => b.batch).filter(Boolean),
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
    const faculty = req.user!.role === "super_admin"
      ? null
      : await prisma.collegeFaculty.findFirst({
          where: { userId: req.user!.id, collegeId, status: "active" },
          select: { isMainFaculty: true, permissions: true },
        });
    const hasRootAccess = req.user!.role === "super_admin" || Boolean(faculty?.isMainFaculty);
    const permissions = normalizeFacultyPermissions(faculty?.permissions ?? req.user!.permissions);
    const can = (permission: string) =>
      hasRootAccess || permissions.includes("all") || permissions.includes(permission);
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin"
    );

    const scopedStudents = await prisma.collegeStudent.findMany({
      where: buildScopedStudentWhere(collegeId, scopeConditions),
      select: { userId: true, status: true },
    });
    const scopedStudentUserIds = scopedStudents.map((student) => student.userId);
    const interviewWhere = { collegeId, userId: { in: scopedStudentUserIds } };

    const [
      college,
      totalFaculty,
      activeFaculty,
      creditAccount,
      interviewSessionsCount,
      reportsGeneratedCount,
    ] = await Promise.all([
      prisma.college.findUnique({ where: { id: collegeId } }),
      prisma.collegeFaculty.count({ where: { collegeId } }),
      prisma.collegeFaculty.count({ where: { collegeId, status: "active" } }),
      prisma.collegeCreditAccount.findUnique({ where: { collegeId } }),
      prisma.interviewSession.count({ where: interviewWhere }),
      prisma.interviewSession.count({
        where: {
          ...interviewWhere,
          report: { isNot: null },
        },
      }),
    ]);

    const totalStudents = scopedStudents.length;
    const activeStudents = scopedStudents.filter((student) => student.status === "active").length;

    // Compute average score from completed sessions using a single DB aggregate (no full table scan)
    let avgScore = 0;
    try {
      const avgResult = await prisma.interviewReport.aggregate({
        _avg: { overallScore: true },
        where: { session: interviewWhere },
      });
      avgScore = Math.round(avgResult._avg.overallScore ?? 0);
    } catch (_) {
      // overallScore may not exist on all report schemas — safe to skip
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
router.get("/stats", handleEnterpriseStats);

// GET /api/enterprise/dashboard/stats - Legacy route alias
router.get("/dashboard/stats", handleEnterpriseStats);

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
    const actor = await getTrustedFacultyMutationActor(req.user!.id, collegeId);
    const forbiddenCreateField = FORBIDDEN_FACULTY_ASSIGNMENT_FIELDS.find(
      (field) => field !== "isMainFaculty" && field !== "email" && hasOwn(req.body, field)
    );
    if (forbiddenCreateField || (hasOwn(req.body, "isMainFaculty") && req.body.isMainFaculty !== false)) {
      throw new FacultyAuthorizationError(
        `Field "${forbiddenCreateField ?? "isMainFaculty"}" cannot be assigned through the faculty creation endpoint.`
      );
    }
    const college = await prisma.college.findUnique({ where: { id: collegeId } });
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
      const actor = await getTrustedFacultyMutationActor(req.user!.id, collegeId);
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
    const actor = await getTrustedFacultyMutationActor(req.user!.id, collegeId);

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

    _facultyScopeCache.delete(`${faculty.userId}:${collegeId}`);

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
    const actor = await getTrustedFacultyMutationActor(req.user!.id, collegeId);

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
  const averageScore = completedSessions.length > 0
    ? Math.round(
        completedSessions.reduce(
          (total, session) => total + resolveCanonicalReportScore(session.report as any),
          0
        ) / completedSessions.length
      )
    : null;

  return {
    averageScore,
    totalCompletedInterviews: completedSessions.length,
    interviewSessions: completedSessions.map((session) => ({
      id: session.id,
      targetRole: session.targetRole,
      difficulty: session.difficulty,
      companyType: session.companyType,
      overallScore: resolveCanonicalReportScore(session.report as any),
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
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin"
    );

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

    const [total, students, invitations] = await Promise.all([
      prisma.collegeStudent.count({ where }),
      prisma.collegeStudent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ batch: "desc" }, { enrollmentNumber: "asc" }],
        include: {
          user: {
            include: {
              credits: true,
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
      // Fetch invitations in parallel with the student list — no sequential round-trip
      prisma.invitation.findMany({
        where: { collegeId, role: "student" },
        orderBy: { createdAt: "desc" },
        select: { email: true, status: true, createdAt: true, metadata: true },
      }),
    ]);

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
        invitationStatus: (inv?.metadata as any)?.deliveryStatus ?? inv?.status ?? "sent",
        emailError: (inv?.metadata as any)?.emailError ?? null,
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
        invitationStatus: (latestInvite?.metadata as any)?.deliveryStatus ?? latestInvite?.status ?? "sent",
        emailError: (latestInvite?.metadata as any)?.emailError ?? null,
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
        invitationStatus: (latestInvite?.metadata as any)?.deliveryStatus ?? latestInvite?.status ?? "sent",
        emailError: (latestInvite?.metadata as any)?.emailError ?? null,
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
    const collegeId = req.collegeId!;
    const college = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) {
      return res.status(404).json({ success: false, message: "College tenant not found." });
    }

    const schema = z.object({
      name: z.string().min(2, "Full name is required"),
      email: z.string().trim().email("Valid email is required"),
      enrollmentNumber: z.string().min(1, "Enrollment number is required"),
      program: z.string().min(1, "Program is required (e.g. B.Tech)"),
      course: z.string().min(1, "Course is required (e.g. Computer Science)"),
      department: z.string().optional(),
      section: z.string().min(1, "Section is required (e.g. A)"),
      batch: z.string().min(4, "Batch is required (e.g. 2026)"),
      academicYear: z.string().optional(),
      semester: z.number().int().min(1).max(12).optional(),
      phone: z.string().optional(),
      gender: z.string().optional(),
      initialCredits: z.number().int().min(0).default(0),
    });

    const parsedData = schema.parse(req.body);
    const data = { ...parsedData, email: normalizeEmailIdentity(parsedData.email) };
    const facultyScope = await getFacultyStudentScope(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin",
      true
    );
    if (!isStudentWithinFacultyScope(facultyScope, { collegeId, ...data })) {
      return res.status(403).json({
        success: false,
        message: "Access denied: The requested student scope is outside your assigned access.",
      });
    }

    const existingStudent = await prisma.collegeStudent.findUnique({
      where: {
        collegeId_enrollmentNumber: {
          collegeId,
          enrollmentNumber: data.enrollmentNumber,
        },
      },
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: `Student with enrollment number ${data.enrollmentNumber} already exists in this college.`,
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
      select: { id: true },
    });

    if (existingUser) {
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

    const result = await prisma.$transaction(async (tx) => {
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

      return { userId, studentProfile };
    },
    {
      maxWait: 20000,
      timeout: 60000,
    });

    // 2. Dispatch Welcome Email Asynchronously outside DB transaction
    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    let invitationStatus = "sent";
    let emailError: string | undefined;

    try {
      const mailResult = await EmailService.sendStudentWelcomeEmail({
        to: data.email,
        recipientName: data.name,
        collegeName: college.name,
        enrollmentNumber: data.enrollmentNumber,
        tempPassword: rawTempPassword,
        loginUrl: `${frontendUrl}/login`,
      });

      if (mailResult && mailResult.success === false) {
        invitationStatus = "failed";
        emailError = mailResult.error || "Email delivery failed";
      }
    } catch (err: any) {
      invitationStatus = "failed";
      emailError = err?.message || "Failed to send welcome email";
    }

    // Update invitation status in DB (student is NEVER rolled back or deleted if email fails)
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
        invitationStatus,
      },
    });

    res.status(201).json({
      success: true,
      message: `Student "${data.name}" added successfully.${invitationStatus === "failed" ? " (Notice: Welcome email could not be delivered and may be resent)." : " Credentials sent via email."}`,
      student: result.studentProfile,
      invitationStatus,
      emailError,
      invitationToken: env.NODE_ENV !== "production" ? rawToken : undefined,
    });
  } catch (error) {
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
        : Number(rawCredit);
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
      normalized.program = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    } else if (
      cleanKey.includes("course") ||
      cleanKey.includes("branch") ||
      cleanKey.includes("specializ")
    ) {
      normalized.course = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    } else if (
      cleanKey.includes("department") ||
      cleanKey === "dept"
    ) {
      normalized.department = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    } else if (
      cleanKey.includes("sec") ||
      cleanKey.includes("divis") ||
      cleanKey.includes("class")
    ) {
      normalized.section = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    } else if (
      cleanKey.includes("batch") ||
      cleanKey.includes("year") ||
      cleanKey.includes("pass")
    ) {
      normalized.batch = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    } else if (
      cleanKey.includes("name") &&
      !cleanKey.includes("college") &&
      !cleanKey.includes("univ")
    ) {
      normalized.name = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    } else if (
      cleanKey.includes("gender") ||
      cleanKey.includes("sex")
    ) {
      normalized.gender = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    } else if (cleanKey.includes("sem")) {
      const num = parseInt(String(value), 10);
      normalized.semester = isNaN(num) ? undefined : num;
    } else if (cleanKey.includes("acad")) {
      normalized.academicYear = typeof value === "string" ? value.trim() : String(value ?? "").trim();
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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 1. First pass: Row normalization and file-level validations
  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 1;
    const normalized = normalizeExcelHeaders(rawRows[i]);

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

    try {
      assertValidCreditAmount(initialCredits);
    } catch (error: any) {
      errors.push({ row: rowNum, email, enrollmentNumber, reason: error.message });
      continue;
    }

    // Check required fields
    if (!name) {
      errors.push({ row: rowNum, email, enrollmentNumber, reason: "Missing required field: Name" });
      continue;
    }
    if (!email) {
      errors.push({ row: rowNum, email, enrollmentNumber, reason: "Missing required field: Email" });
      continue;
    }
    if (!emailRegex.test(email)) {
      errors.push({ row: rowNum, email, enrollmentNumber, reason: `Invalid email format: "${email}"` });
      continue;
    }
    if (!enrollmentNumber) {
      errors.push({ row: rowNum, email, enrollmentNumber, reason: "Missing required field: Enrollment Number" });
      continue;
    }
    if (!program) {
      errors.push({ row: rowNum, email, enrollmentNumber, reason: "Missing required field: Program" });
      continue;
    }
    if (!course) {
      errors.push({ row: rowNum, email, enrollmentNumber, reason: "Missing required field: Course" });
      continue;
    }
    if (!section) {
      errors.push({ row: rowNum, email, enrollmentNumber, reason: "Missing required field: Section" });
      continue;
    }
    if (!batch) {
      errors.push({ row: rowNum, email, enrollmentNumber, reason: "Missing required field: Batch" });
      continue;
    }
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
        emailErrorDetail = mailResult.error || "Email delivery failed";
      }
    } catch (mailErr: any) {
      emailDeliveryStatus = "failed";
      emailErrorDetail = mailErr?.message || "Failed to dispatch welcome email";
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
        `Invitation delivery status could not be recorded: ${statusError?.message || "unknown error"}`,
      ].filter(Boolean).join(" ");
      console.error("Failed to update post-commit invitation delivery status:", statusError);
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

  return {
    success: true,
    message: `Processed ${rawRows.length} rows: ${createdStudents.length} created, ${errors.length} failed.`,
    totalProcessed: rawRows.length,
    totalCreated: createdStudents.length,
    totalFailed: errors.length,
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
      initialCredits: z.number().int().min(0).optional().default(0),
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
        : Number(rawInitialCredits);

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
      const emailError = deliveryResult.error || "Email delivery failed";
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
        console.error("Failed to record password setup email failure:", statusError);
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
      console.error("Failed to record password setup email delivery status:", statusError);
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

    const schema = z.object({
      program: z.string().optional(),
      course: z.string().optional(),
      department: z.string().optional(),
      section: z.string().optional(),
      batch: z.string().optional(),
      semester: z.number().int().optional(),
      academicYear: z.string().optional(),
      status: z.enum(["active", "graduated", "inactive"]).optional(),
    });

    const data = schema.parse(req.body);
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

    const schema = z.object({
      program: z.string().optional(),
      course: z.string().optional(),
      department: z.string().optional(),
      section: z.string().optional(),
      batch: z.string().optional(),
      semester: z.number().int().optional(),
      academicYear: z.string().optional(),
      status: z.enum(["active", "graduated", "inactive"]).optional(),
    });

    const data = schema.parse(req.body);
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
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin"
    );

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
      amount: z.number().int().min(1, "Amount must be at least 1 credit"),
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

    const result = await prisma.$transaction(async (tx) => {
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
      return {
        updatedAccount: transfer.account,
        updatedUserCredit: transfer.studentCredit,
        txn: transfer.transaction,
      };
    },
    {
      maxWait: 20000,
      timeout: 60000,
    });

    await logEnterpriseAudit({
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

    res.json({
      success: true,
      message: `Successfully assigned ${amount} credits to ${student.user.name}.`,
      studentBalance: result.updatedUserCredit.balance,
      collegeBalance: result.updatedAccount.balance,
    });
  } catch (error: any) {
    res.status(400).json({
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
      creditsPerStudent: z.number().int().min(1, "Credits per student must be at least 1"),
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

    const result = await prisma.$transaction(async (tx) => {
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
      });

      if (students.length === 0) {
        throw new Error("No eligible active students found matching the selected filter criteria.");
      }

      const totalRequired = students.length * creditsPerStudent;

      // 3. Each transfer uses the conditional-debit primitive. Because all
      // transfers share this outer transaction, one failure rolls back the
      // entire distribution.
      for (const student of students) {
        await allocateInstitutionCreditsToStudent({
          tx,
          collegeId,
          studentId: student.id,
          userId: student.userId,
          actorId: req.user!.id,
          amount: creditsPerStudent,
          type: "FACULTY_DISTRIBUTION",
          reason,
          batchFilter: filters,
        });
      }

      const updatedAccount = await tx.collegeCreditAccount.findUniqueOrThrow({
        where: { collegeId },
        select: { balance: true },
      });

      return {
        distributedCount: students.length,
        totalCreditsDistributed: totalRequired,
        balanceRemaining: updatedAccount.balance,
      };
    },
    {
      maxWait: 20000,
      timeout: 60000,
    });

    await logEnterpriseAudit({
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
      },
    });

    res.json({
      success: true,
      message: `Successfully distributed ${result.totalCreditsDistributed} credits across ${result.distributedCount} students.`,
      ...result,
    });
  } catch (error: any) {
    res.status(400).json({
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
router.get("/reports", requirePermission("REPORT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin"
    );

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

    const studentFilters: any = {};
    if (status) studentFilters.status = status;
    if (program) studentFilters.program = program;
    if (course) studentFilters.course = course;
    if (section) studentFilters.section = section;
    if (batch) studentFilters.batch = batch;

    const scopedStudentWhere = buildScopedStudentWhere(collegeId, scopeConditions, studentFilters);

    if (view === "students" || view === "analytics") {
      const studentWhereWithSearch: any = { ...scopedStudentWhere };
      if (search) {
        studentWhereWithSearch.OR = [
          { enrollmentNumber: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
        ];
      }

      const students = await prisma.collegeStudent.findMany({
        where: studentWhereWithSearch,
        orderBy: [{ batch: "desc" }, { enrollmentNumber: "asc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              credits: true,
              interviewSessions: {
                where: { status: "completed" },
                orderBy: { createdAt: "desc" },
                include: { report: true },
              },
              resumes: {
                take: 1,
                orderBy: { updatedAt: "desc" },
                select: { id: true, fileName: true, fileUrl: true, updatedAt: true },
              },
            },
          },
        },
      });

      let aggregateData = students.map((s) => {
        const sessions = s.user.interviewSessions;
        const completedSessions = sessions.filter((sess) => sess.report !== null);
        const averageScore =
          completedSessions.length > 0
            ? Math.round(
                completedSessions.reduce(
                  (acc, curr) => acc + (curr.report ? resolveCanonicalReportScore(curr.report as any) : 0),
                  0
                ) / completedSessions.length
              )
            : null;

        const latestSession = completedSessions[0];
        const latestOverallScore = latestSession?.report
          ? resolveCanonicalReportScore(latestSession.report as any)
          : null;

        const readinessRating = getReadinessCategory(averageScore);

        return {
          id: s.id,
          userId: s.userId,
          enrollmentNumber: s.enrollmentNumber,
          name: s.user.name,
          email: s.user.email,
          phone: s.user.phone,
          program: s.program,
          course: s.course,
          section: s.section,
          batch: s.batch,
          status: s.status,
          availableCredits: s.user.credits?.balance ?? 0,
          completedInterviewsCount: completedSessions.length,
          averageScore,
          readinessRating,
          latestScore: latestOverallScore,
          overallScore: latestOverallScore ?? averageScore,
          latestTargetRole: latestSession?.targetRole ?? null,
          latestInterviewDate: latestSession?.createdAt ?? null,
          createdAt: latestSession?.createdAt ?? s.createdAt,
          speakingPace: latestSession?.report?.speakingPace ?? null,
          fillerWords: latestSession?.report?.fillerWords ?? null,
          reportId: latestSession?.report?.id ?? null,
        };
      });

      const total = aggregateData.length;
      const paginatedData = aggregateData.slice((page - 1) * limit, page * limit);

      return res.json({
        success: true,
        reports: paginatedData,
        data: paginatedData,
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // Default & Canonical: Return individual interview evaluation reports
    const where: any = {
      session: {
        status: "completed",
        user: {
          studentProfile: scopedStudentWhere,
        },
      },
    };

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { session: { user: { name: { contains: search, mode: "insensitive" } } } },
            { session: { user: { email: { contains: search, mode: "insensitive" } } } },
            { session: { user: { studentProfile: { enrollmentNumber: { contains: search, mode: "insensitive" } } } } },
            { session: { targetRole: { contains: search, mode: "insensitive" } } },
          ],
        },
      ];
    }

    if (scoreTier) {
      if (scoreTier === "high") {
        where.overallScore = { ...(where.overallScore || {}), gte: 80 };
      } else if (scoreTier === "moderate") {
        where.overallScore = { ...(where.overallScore || {}), gte: 60, lt: 80 };
      } else if (scoreTier === "needs_improvement") {
        where.overallScore = { ...(where.overallScore || {}), lt: 60 };
      }
    }

    const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;
    const maxScore = req.query.maxScore ? parseFloat(req.query.maxScore as string) : undefined;
    if (minScore !== undefined && !isNaN(minScore)) {
      where.overallScore = { ...(where.overallScore || {}), gte: minScore };
    }
    if (maxScore !== undefined && !isNaN(maxScore)) {
      where.overallScore = { ...(where.overallScore || {}), lte: maxScore };
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (startDate) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(startDate) };
    }
    if (endDate) {
      where.createdAt = { ...(where.createdAt || {}), lte: new Date(endDate) };
    }

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

    const [total, reports, scoreAgg, highCount, moderateCount, needsPracticeCount] = await Promise.all([
      prisma.interviewReport.count({ where }),
      prisma.interviewReport.findMany({
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
      }),
      prisma.interviewReport.aggregate({
        where,
        _avg: { overallScore: true },
        _count: { id: true },
      }),
      prisma.interviewReport.count({
        where: { ...where, overallScore: { gte: 80 } },
      }),
      prisma.interviewReport.count({
        where: { ...where, overallScore: { gte: 60, lt: 80 } },
      }),
      prisma.interviewReport.count({
        where: { ...where, overallScore: { lt: 60 } },
      }),
    ]);

    const summary = {
      totalReports: scoreAgg._count.id,
      totalStudentsInView: scoreAgg._count.id,
      cohortAverage: scoreAgg._avg.overallScore ? Math.round(scoreAgg._avg.overallScore) : 0,
      jobReadyCount: highCount,
      moderateCount: moderateCount,
      needsPracticeCount: needsPracticeCount,
      untestedCount: 0,
    };

    const mappedReports: EnterpriseReportRow[] = reports.map((r) => {
      const studentProfile = r.session.user?.studentProfile;
      const canonicalScore = resolveCanonicalReportScore(r as any);
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
router.get("/reports/summary", requirePermission("REPORT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin"
    );

    const program = req.query.program as string;
    const course = req.query.course as string;
    const section = req.query.section as string;
    const batch = req.query.batch as string;

    const filters: any = {};
    if (program) filters.program = program;
    if (course) filters.course = course;
    if (section) filters.section = section;
    if (batch) filters.batch = batch;
    const where = buildScopedStudentWhere(collegeId, scopeConditions, filters);

    const students = await prisma.collegeStudent.findMany({
      where,
      select: {
        user: {
          select: {
            interviewSessions: {
              where: { status: "completed" },
              select: {
                report: {
                  select: { overallScore: true, scoreScale: true, categoryScores: true },
                },
              },
            },
          },
        },
      },
    });

    let totalReports = 0;
    let scoreSum = 0;
    let high = 0; // 80+
    let moderate = 0; // 60-79
    let needsPractice = 0; // <60

    for (const s of students) {
      for (const sess of s.user.interviewSessions) {
        if (sess.report && typeof sess.report.overallScore === "number") {
          totalReports++;
          const score = resolveCanonicalReportScore(sess.report as any);
          scoreSum += score;
          if (score >= 80) high++;
          else if (score >= 60) moderate++;
          else needsPractice++;
        }
      }
    }

    const averageOverallScore = totalReports > 0 ? Math.round(scoreSum / totalReports) : 0;

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
  async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.role === "super_admin"
    );

    const format = ((req.query.format as string) || "csv").toLowerCase();
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
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }
    const view = (req.query.view as string) || "reports";
    const where = buildScopedStudentWhere(collegeId, scopeConditions, filters);

    let exportRows: any[] = [];

    if (view === "students") {
      const students = await prisma.collegeStudent.findMany({
        where,
        orderBy: [{ batch: "desc" }, { enrollmentNumber: "asc" }],
        include: {
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
              credits: true,
              interviewSessions: {
                where: { status: "completed" },
                orderBy: { createdAt: "desc" },
                include: { report: true },
              },
              resumes: {
                take: 1,
                orderBy: { updatedAt: "desc" },
                select: { fileName: true },
              },
            },
          },
        },
      });

      exportRows = students.map((s) => {
        const completedSessions = s.user.interviewSessions.filter((sess) => sess.report !== null);
        const averageScore =
          completedSessions.length > 0
            ? Math.round(
                completedSessions.reduce(
                  (acc, curr) => acc + (curr.report ? resolveCanonicalReportScore(curr.report as any) : 0),
                  0
                ) / completedSessions.length
              )
            : null;
        const latestSession = completedSessions[0];
        const latestOverallScore = latestSession?.report
          ? resolveCanonicalReportScore(latestSession.report as any)
          : null;

        const readiness = getReadinessCategory(averageScore);

        return {
          "Enrollment Number": sanitizeSpreadsheetCell(s.enrollmentNumber),
          "Student Name": sanitizeSpreadsheetCell(s.user.name),
          "Email": sanitizeSpreadsheetCell(s.user.email),
          "Phone": sanitizeSpreadsheetCell(s.user.phone || ""),
          "Program": sanitizeSpreadsheetCell(s.program),
          "Course": sanitizeSpreadsheetCell(s.course),
          "Section": sanitizeSpreadsheetCell(s.section),
          "Batch": sanitizeSpreadsheetCell(s.batch),
          "Status": sanitizeSpreadsheetCell(s.status),
          "Available Credits": s.user.credits?.balance ?? 0,
          "Completed Interviews": completedSessions.length,
          "Average Score": averageScore !== null ? averageScore : "N/A",
          "Readiness Rating": sanitizeSpreadsheetCell(readiness),
          "Latest Score": latestOverallScore !== null ? latestOverallScore : "N/A",
          "Latest Target Role": sanitizeSpreadsheetCell(latestSession?.targetRole || "N/A"),
          "Has Resume": s.user.resumes.length > 0 ? "Yes" : "No",
        };
      });
    } else {
      const reportWhere: any = {
        session: {
          status: "completed",
          user: {
            studentProfile: where,
          },
        },
      };

      if (search) {
        reportWhere.AND = [
          {
            OR: [
              { session: { user: { name: { contains: search, mode: "insensitive" } } } },
              { session: { user: { email: { contains: search, mode: "insensitive" } } } },
              { session: { user: { studentProfile: { enrollmentNumber: { contains: search, mode: "insensitive" } } } } },
              { session: { targetRole: { contains: search, mode: "insensitive" } } },
            ],
          },
        ];
      }

      const reports = await prisma.interviewReport.findMany({
        where: reportWhere,
        orderBy: { createdAt: "desc" },
        include: {
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
        },
      });

      exportRows = reports.map((r) => {
        const studentProfile = r.session.user?.studentProfile;
        const canonicalScore = resolveCanonicalReportScore(r as any);
        const readiness = getReadinessCategory(canonicalScore);

        return {
          "Report ID": sanitizeSpreadsheetCell(r.id),
          "Enrollment Number": sanitizeSpreadsheetCell(studentProfile?.enrollmentNumber || "—"),
          "Student Name": sanitizeSpreadsheetCell(r.session.user?.name || "—"),
          "Email": sanitizeSpreadsheetCell(r.session.user?.email || "—"),
          "Phone": sanitizeSpreadsheetCell(r.session.user?.phone || ""),
          "Program": sanitizeSpreadsheetCell(studentProfile?.program || "—"),
          "Course": sanitizeSpreadsheetCell(studentProfile?.course || "—"),
          "Section": sanitizeSpreadsheetCell(studentProfile?.section || "—"),
          "Batch": sanitizeSpreadsheetCell(studentProfile?.batch || "—"),
          "Target Role": sanitizeSpreadsheetCell(r.session.targetRole),
          "Difficulty": sanitizeSpreadsheetCell(r.session.difficulty),
          "Overall Score (%)": canonicalScore,
          "Readiness Rating": sanitizeSpreadsheetCell(readiness),
          "Speaking Pace (WPM)": r.speakingPace !== null ? r.speakingPace : "N/A",
          "Filler Words": r.fillerWords !== null ? r.fillerWords : "N/A",
          "Date Completed": new Date(r.createdAt).toISOString().split("T")[0],
        };
      });
    }

    await logEnterpriseAudit({
      collegeId,
      actorId: req.user!.id,
      action: "REPORTS_EXPORTED",
      entity: "Report",
      newValue: {
        format,
        exportedCount: exportRows.length,
        filters: { program, course, section, batch, status },
      },
    });

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `student-reports-${timestamp}`;

    if (format === "xlsx") {
      const worksheet = xlsx.utils.json_to_sheet(exportRows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Student Reports");
      const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    // Default CSV output with formula injection sanitization
    const headers =
      exportRows.length > 0
        ? Object.keys(exportRows[0])
        : [
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

    const csvLines = [headers.join(",")];
    for (const row of exportRows) {
      const line = headers
        .map((h) => {
          const val = String((row as any)[h] ?? "");
          const escaped = val.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",");
      csvLines.push(line);
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    return res.send(csvLines.join("\r\n"));
  } catch (error) {
    next(error);
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
