import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import multer from "multer";
import * as xlsx from "xlsx";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireTenant, requireCollegeAdmin, requirePermission } from "../../middleware/tenant.js";
import { EmailService } from "../../services/email.service.js";
import { logEnterpriseAudit } from "../../services/audit.service.js";
import { env } from "../../config/env.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
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

/**
 * Resolves query constraints based on the logged-in faculty's assigned scope.
 * If the user is a super admin or main faculty, no restrictions are applied.
 * If the user is a regular faculty with program/course/section restrictions,
 * the query is constrained to those allowed values.
 */
async function getFacultyScopeConditions(userId: string, collegeId: string, isMainFaculty?: boolean) {
  if (isMainFaculty) return {};
  const faculty = await prisma.collegeFaculty.findFirst({
    where: { userId, collegeId, status: "active" },
  });
  if (!faculty || faculty.isMainFaculty) return {};

  const conditions: any = {};
  if (faculty.programAccess && faculty.programAccess.length > 0) {
    conditions.program = { in: faculty.programAccess };
  }
  if (faculty.courseAccess && faculty.courseAccess.length > 0) {
    conditions.course = { in: faculty.courseAccess };
  }
  if (faculty.sectionAccess && faculty.sectionAccess.length > 0) {
    conditions.section = { in: faculty.sectionAccess };
  }
  return conditions;
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
      req.user!.isMainFaculty
    );

    const [programs, courses, sections, batches, departments] = await Promise.all([
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
    ]);

    res.json({
      success: true,
      programs: programs.map((p) => p.program).filter(Boolean),
      courses: courses.map((c) => c.course).filter(Boolean),
      sections: sections.map((s) => s.section).filter(Boolean),
      batches: batches.map((b) => b.batch).filter(Boolean),
      departments: departments.map((d) => d.department).filter(Boolean) as string[],
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
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.isMainFaculty
    );

    const [
      college,
      totalStudents,
      activeStudents,
      totalFaculty,
      activeFaculty,
      creditAccount,
      interviewSessionsCount,
      reportsGeneratedCount,
    ] = await Promise.all([
      prisma.college.findUnique({ where: { id: collegeId } }),
      prisma.collegeStudent.count({ where: { collegeId, ...scopeConditions } }),
      prisma.collegeStudent.count({ where: { collegeId, status: "active", ...scopeConditions } }),
      prisma.collegeFaculty.count({ where: { collegeId } }),
      prisma.collegeFaculty.count({ where: { collegeId, status: "active" } }),
      prisma.collegeCreditAccount.findUnique({ where: { collegeId } }),
      prisma.interviewSession.count({ where: { collegeId } }),
      prisma.interviewSession.count({
        where: {
          collegeId,
          report: { isNot: null },
        },
      }),
    ]);

    // Compute average score from completed sessions
    let avgScore = 0;
    try {
      const reports = await prisma.interviewReport.findMany({
        where: { session: { collegeId } },
        select: { overallScore: true },
      });
      if (reports.length > 0) {
        const total = reports.reduce((sum: number, r: any) => sum + (r.overallScore ?? 0), 0);
        avgScore = Math.round(total / reports.length);
      }
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
        total: totalStudents,
        active: activeStudents,
      },
      faculty: {
        total: totalFaculty,
        active: activeFaculty,
      },
      credits: {
        balance: creditAccount?.balance ?? 0,
        totalAllocated: creditAccount?.totalAllocated ?? 0,
        totalDistributed: creditAccount?.totalDistributed ?? 0,
      },
      interviews: {
        totalSessions: interviewSessionsCount,
        completedSessions: reportsGeneratedCount,
        avgScore,
      },
      // Legacy stats object for backward compat
      stats: {
        totalStudents,
        activeStudents,
        totalFaculty,
        availableCredits: creditAccount?.balance ?? 0,
        totalCreditsAllocated: creditAccount?.totalAllocated ?? 0,
        totalCreditsDistributed: creditAccount?.totalDistributed ?? 0,
        totalInterviewSessions: interviewSessionsCount,
        reportsGenerated: reportsGeneratedCount,
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
    const college = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) {
      return res.status(404).json({ success: false, message: "College tenant not found." });
    }

    const schema = z.object({
      name: z.string().min(2, "Name is required"),
      email: z.string().email("Valid email is required"),
      phone: z.string().optional(),
      employeeId: z.string().optional(),
      department: z.string().optional(),
      designation: z.string().optional().default("Assistant Professor"),
      permissions: z.array(z.string()).default([
        "STUDENT_VIEW",
        "REPORT_VIEW",
        "REPORT_EXPORT",
      ]),
      programAccess: z.array(z.string()).default([]),
      courseAccess: z.array(z.string()).default([]),
      sectionAccess: z.array(z.string()).default([]),
    });

    const data = schema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser && existingUser.collegeId && existingUser.collegeId !== collegeId) {
      return res.status(400).json({
        success: false,
        message: "This email is already associated with a different college tenant.",
      });
    }

    // Generate secure temporary credentials and invitation token
    const rawTempPassword = `Fac#${crypto.randomBytes(4).toString("hex")}!7`;
    const passwordHash = await bcrypt.hash(rawTempPassword, 10);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await prisma.$transaction(
      async (tx) => {
        let user = existingUser;
        if (!user) {
          user = await tx.user.create({
            data: {
              name: data.name,
              email: data.email,
              phone: data.phone,
              passwordHash,
              role: "college_faculty",
              collegeId,
              isActive: true,
            },
          });
        } else {
          user = await tx.user.update({
            where: { id: user.id },
            data: {
              role: "college_faculty",
              collegeId,
              passwordHash,
              isActive: true,
            },
          });
        }

        const facultyProfile = await tx.collegeFaculty.create({
          data: {
            userId: user.id,
            collegeId,
            employeeId: data.employeeId,
            department: data.department,
            designation: data.designation,
            isMainFaculty: false,
            permissions: data.permissions,
            programAccess: data.programAccess,
            courseAccess: data.courseAccess,
            sectionAccess: data.sectionAccess,
            status: "active",
          },
        });

        await tx.invitation.create({
          data: {
            collegeId,
            email: data.email,
            role: "college_faculty",
            tokenHash,
            expiresAt,
            status: "pending",
            invitedById: req.user!.id,
            metadata: {
              name: data.name,
              employeeId: data.employeeId,
              department: data.department,
              designation: data.designation,
              permissions: data.permissions,
            },
          },
        });

        return { user, facultyProfile };
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    // Send invitation email
    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    const activationLink = `${frontendUrl}/login?invite=${rawToken}&email=${encodeURIComponent(data.email)}`;

    await EmailService.sendFacultyInvitation({
      to: data.email,
      recipientName: data.name,
      collegeName: college.name,
      isMainFaculty: false,
      activationLink,
      tempPassword: rawTempPassword,
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
        permissions: data.permissions,
      },
    });

    res.status(201).json({
      success: true,
      message: `Faculty member "${data.name}" added and invited successfully.`,
      faculty: result.facultyProfile,
      invitationToken: env.NODE_ENV !== "production" ? rawToken : undefined,
      tempPassword: env.NODE_ENV !== "production" ? rawTempPassword : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/enterprise/faculty/:id - Update faculty permissions/details
// PATCH /api/enterprise/faculty/:id - Update faculty permissions/details
router.patch("/faculty/:id", requirePermission("FACULTY_EDIT"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const { id } = req.params;

    const faculty = await prisma.collegeFaculty.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!faculty || faculty.collegeId !== collegeId) {
      return res.status(404).json({ success: false, message: "Faculty member not found in your college." });
    }

    const schema = z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
      department: z.string().optional(),
      designation: z.string().optional(),
      permissions: z.array(z.string()).optional(),
      programAccess: z.array(z.string()).optional(),
      courseAccess: z.array(z.string()).optional(),
      sectionAccess: z.array(z.string()).optional(),
      status: z.enum(["active", "inactive", "suspended"]).optional(),
    });

    const data = schema.parse(req.body);

    const [updated] = await prisma.$transaction(
      async (tx) => {
        const updatedFaculty = await tx.collegeFaculty.update({
          where: { id },
          data: {
            department: data.department,
            designation: data.designation,
            permissions: data.permissions,
            programAccess: data.programAccess,
            courseAccess: data.courseAccess,
            sectionAccess: data.sectionAccess,
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

    res.json({
      success: true,
      message: "Faculty updated successfully.",
      faculty: updated,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/enterprise/faculty/:id - Deactivate faculty staff member
router.delete("/faculty/:id", requirePermission("FACULTY_EDIT"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const { id } = req.params;

    const faculty = await prisma.collegeFaculty.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!faculty || faculty.collegeId !== collegeId) {
      return res.status(404).json({ success: false, message: "Faculty member not found in your college." });
    }

    if (faculty.isMainFaculty) {
      return res.status(400).json({ success: false, message: "Cannot deactivate the Main Faculty administrator." });
    }

    if (faculty.userId === req.user!.id) {
      return res.status(400).json({ success: false, message: "You cannot deactivate your own account." });
    }

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
    next(error);
  }
});

// ===========================================================================
// 3. STUDENT MANAGEMENT
// ===========================================================================

// GET /api/enterprise/students - List students with server-side pagination & filters & scoping
router.get("/students", requirePermission("STUDENT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.isMainFaculty
    );

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 15));
    const search = ((req.query.search as string) || "").trim();
    const program = req.query.program as string;
    const course = req.query.course as string;
    const section = req.query.section as string;
    const batch = req.query.batch as string;
    const status = req.query.status as string;

    const where: any = { collegeId, ...scopeConditions };
    if (status) where.status = status;
    if (program) where.program = program;
    if (course) where.course = course;
    if (section) where.section = section;
    if (batch) where.batch = batch;

    if (search) {
      where.OR = [
        { enrollmentNumber: { contains: search, mode: "insensitive" } },
        { program: { contains: search, mode: "insensitive" } },
        { course: { contains: search, mode: "insensitive" } },
        { section: { contains: search, mode: "insensitive" } },
        { batch: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, students] = await Promise.all([
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
                  interviewSessions: true,
                  resumes: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const emails = students.map((s) => s.user.email);
    const invitations = emails.length > 0 ? await prisma.invitation.findMany({
      where: { collegeId, email: { in: emails }, role: "student" },
      orderBy: { createdAt: "desc" },
    }) : [];

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
        interviewSessionsCount: s.user._count.interviewSessions,
        resumesCount: s.user._count.resumes,
        invitationStatus: inv?.status ?? "sent",
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
            interviewSessions: {
              where: { status: "completed" },
              orderBy: { createdAt: "desc" },
              include: {
                report: true,
                questions: {
                  select: {
                    id: true,
                    questionText: true,
                    answer: {
                      select: {
                        score: true,
                        feedback: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student || student.collegeId !== collegeId) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }

    const completedSessions = student.user.interviewSessions.filter((s) => s.report !== null);
    const avgScore =
      completedSessions.length > 0
        ? Math.round(
            completedSessions.reduce((acc, curr) => acc + (curr.report?.overallScore ?? 0), 0) /
              completedSessions.length
          )
        : null;

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
        invitationStatus: latestInvite?.status ?? "sent",
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
        averageScore: avgScore,
        totalCompletedInterviews: completedSessions.length,
        resumes: student.user.resumes,
        interviewSessions: completedSessions.map((s) => ({
          id: s.id,
          targetRole: s.targetRole,
          difficulty: s.difficulty,
          companyType: s.companyType,
          overallScore: s.report?.overallScore,
          categoryScores: s.report?.categoryScores,
          strengths: s.report?.strengths,
          weaknesses: s.report?.weaknesses,
          recommendations: s.report?.recommendations,
          speakingPace: s.report?.speakingPace,
          fillerWords: s.report?.fillerWords,
          voiceConfidence: s.report?.voiceConfidence,
          questions: s.questions,
          createdAt: s.createdAt,
        })),
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
      email: z.string().email("Valid email is required"),
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

    const data = schema.parse(req.body);

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

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser && existingUser.collegeId && existingUser.collegeId !== collegeId) {
      return res.status(400).json({
        success: false,
        message: "This email address is registered under another college tenant.",
      });
    }

    // 1. High-Entropy Non-Predictable Temporary Credentials
    const rawTempPassword = generateSecureTemporaryPassword();
    const passwordHash = await bcrypt.hash(rawTempPassword, 10);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    const result = await prisma.$transaction(async (tx) => {
      // 1. Check college credit balance if initial credits requested
      if (data.initialCredits > 0) {
        const creditAccount = await tx.collegeCreditAccount.findUnique({
          where: { collegeId },
        });

        if (!creditAccount || creditAccount.balance < data.initialCredits) {
          throw new Error(`Insufficient college credits. Available: ${creditAccount?.balance ?? 0}`);
        }

        await tx.collegeCreditAccount.update({
          where: { collegeId },
          data: {
            balance: { decrement: data.initialCredits },
            totalDistributed: { increment: data.initialCredits },
          },
        });
      }

      // 2. Create or update user (store ONLY bcrypt password hash, never plaintext)
      let user = existingUser;
      if (!user) {
        user = await tx.user.create({
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
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            role: "student",
            collegeId,
            passwordHash,
          },
        });
      }

      // 3. User Credits
      await tx.userCredit.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          balance: data.initialCredits,
        },
        update: {
          balance: { increment: data.initialCredits },
        },
      });

      // 4. Create Student Profile
      const studentProfile = await tx.collegeStudent.create({
        data: {
          userId: user.id,
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

      // 5. Credit Transaction record if credits given
      if (data.initialCredits > 0) {
        const acc = await tx.collegeCreditAccount.findUnique({ where: { collegeId } });
        await tx.collegeCreditTransaction.create({
          data: {
            collegeId,
            studentId: studentProfile.id,
            createdById: req.user!.id,
            type: "FACULTY_DISTRIBUTION",
            amount: data.initialCredits,
            balanceAfter: acc?.balance ?? 0,
            reason: `Initial student onboarding credit allocation for ${data.name} (${data.enrollmentNumber})`,
          },
        });
      }

      // 6. Create Invitation record
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

      return { user, studentProfile };
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
      const cred = parseInt(String(value), 10);
      normalized.initialCredits = isNaN(cred) ? 0 : cred;
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

export async function executeBulkImport({
  collegeId,
  actorId,
  rawRows,
  atomic = false,
  defaultInitialCredits = 0,
}: {
  collegeId: string;
  actorId: string;
  rawRows: Array<Record<string, any>>;
  atomic?: boolean;
  defaultInitialCredits?: number;
}) {
  const college = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!college) {
    throw new Error("College tenant not found.");
  }

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
          email: { in: candidateEmails },
        },
        select: { id: true, email: true, collegeId: true },
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
        if (existingUser.collegeId && existingUser.collegeId !== collegeId) {
          errors.push({
            row: row.rowNumber,
            email: row.email,
            enrollmentNumber: row.enrollmentNumber,
            reason: `Cross-tenant conflict: Email "${row.email}" is already registered under another institution.`,
          });
          hasError = true;
        } else if (existingUser.collegeId === collegeId) {
          errors.push({
            row: row.rowNumber,
            email: row.email,
            enrollmentNumber: row.enrollmentNumber,
            reason: `Student with email "${row.email}" already exists in this college.`,
          });
          hasError = true;
        }
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

  // 5. Chunked Execution (batches of 50) for high scale (500+ students)
  const CHUNK_SIZE = 50;
  const createdStudents: any[] = [];
  const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";

  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);

    for (const row of chunk) {
      try {
        const rawTempPassword = generateSecureTemporaryPassword();
        const passwordHash = await bcrypt.hash(rawTempPassword, 10);
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

        const created = await prisma.$transaction(async (tx) => {
          if (row.initialCredits > 0) {
            const acc = await tx.collegeCreditAccount.findUnique({ where: { collegeId } });
            if (acc && acc.balance >= row.initialCredits) {
              await tx.collegeCreditAccount.update({
                where: { collegeId },
                data: {
                  balance: { decrement: row.initialCredits },
                  totalDistributed: { increment: row.initialCredits },
                },
              });
            }
          }

          let user = await tx.user.findUnique({ where: { email: row.email } });
          if (!user) {
            user = await tx.user.create({
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
          } else {
            user = await tx.user.update({
              where: { id: user.id },
              data: { role: "student", collegeId, passwordHash },
            });
          }

          if (row.initialCredits > 0) {
            await tx.userCredit.upsert({
              where: { userId: user.id },
              create: { userId: user.id, balance: row.initialCredits },
              update: { balance: { increment: row.initialCredits } },
            });
          }

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

          if (row.initialCredits > 0) {
            const currentAcc = await tx.collegeCreditAccount.findUnique({ where: { collegeId } });
            await tx.collegeCreditTransaction.create({
              data: {
                collegeId,
                studentId: profile.id,
                createdById: actorId,
                type: "FACULTY_DISTRIBUTION",
                amount: row.initialCredits,
                balanceAfter: currentAcc?.balance ?? 0,
                reason: `Bulk import initial credit allocation for ${row.name} (${row.enrollmentNumber})`,
              },
            });
          }

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

          return { user, profile };
        },
        {
          maxWait: 20000,
          timeout: 60000,
        });

        // Asynchronous Welcome Email Dispatch (outside DB transaction)
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
      } catch (err: any) {
        errors.push({
          row: row.rowNumber,
          email: row.email,
          enrollmentNumber: row.enrollmentNumber,
          reason: err?.message || "Failed to create student record in database",
        });
      }
    }
  }

  if (createdStudents.length > 0) {
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
      const initialCredits = parseInt(req.body.initialCredits || "0", 10) || 0;

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

// POST /api/enterprise/students/:id/resend-invite - Regenerate credentials & resend welcome email
router.post("/students/:id/resend-invite", requirePermission("STUDENT_CREATE"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const { id } = req.params;

    const student = await prisma.collegeStudent.findUnique({
      where: { id },
      include: {
        user: true,
        college: true,
      },
    });

    if (!student || student.collegeId !== collegeId) {
      return res.status(404).json({
        success: false,
        message: "Student record not found in your college.",
      });
    }

    // Generate fresh high-entropy temporary password
    const newTempPassword = generateSecureTemporaryPassword();
    const passwordHash = await bcrypt.hash(newTempPassword, 10);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    // Update user password hash
    await prisma.user.update({
      where: { id: student.userId },
      data: { passwordHash },
    });

    // Create or update invitation record
    await prisma.invitation.create({
      data: {
        collegeId,
        email: student.user.email,
        role: "student",
        tokenHash,
        expiresAt,
        status: "pending",
        invitedById: req.user!.id,
        metadata: {
          name: student.user.name,
          enrollmentNumber: student.enrollmentNumber,
          program: student.program,
          course: student.course,
          section: student.section,
          batch: student.batch,
        },
      },
    });

    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    let invitationStatus = "sent";
    let emailError: string | undefined;

    try {
      const mailResult = await EmailService.sendStudentWelcomeEmail({
        to: student.user.email,
        recipientName: student.user.name,
        collegeName: student.college.name,
        enrollmentNumber: student.enrollmentNumber,
        tempPassword: newTempPassword,
        loginUrl: `${frontendUrl}/login`,
      });

      if (mailResult && mailResult.success === false) {
        invitationStatus = "failed";
        emailError = mailResult.error || "Email delivery failed";
      }
    } catch (mailErr: any) {
      invitationStatus = "failed";
      emailError = mailErr?.message || "Failed to dispatch welcome email";
    }

    await prisma.invitation.updateMany({
      where: { collegeId, email: student.user.email, role: "student" },
      data: {
        status: invitationStatus,
        metadata: {
          name: student.user.name,
          enrollmentNumber: student.enrollmentNumber,
          emailError,
        },
      },
    });

    await logEnterpriseAudit({
      collegeId,
      actorId: req.user!.id,
      action: "STUDENT_INVITE_RESENT",
      entity: "CollegeStudent",
      entityId: student.id,
      newValue: {
        studentEmail: student.user.email,
        invitationStatus,
      },
    });

    res.json({
      success: true,
      message: `Invitation credentials successfully resent to ${student.user.email}.`,
      invitationStatus,
      emailError,
      tempPassword: env.NODE_ENV !== "production" ? newTempPassword : undefined,
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

    const student = await prisma.collegeStudent.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!student || student.collegeId !== collegeId) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }

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

    const updated = await prisma.collegeStudent.update({
      where: { id },
      data,
    });

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
      req.user!.isMainFaculty
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

    const where: any = { collegeId, status: "active", ...scopeConditions };
    if (filterProgram) where.program = filterProgram;
    if (filterCourse) where.course = filterCourse;
    if (filterSection) where.section = filterSection;
    if (filterBatch) where.batch = filterBatch;
    if (filterStudentIds && filterStudentIds.length > 0) {
      where.id = { in: filterStudentIds };
    }

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

    if (!student || student.collegeId !== collegeId) {
      return res.status(404).json({ success: false, message: "Student record not found in your college." });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify college account balance
      const creditAccount = await tx.collegeCreditAccount.findUnique({
        where: { collegeId },
      });

      if (!creditAccount || creditAccount.balance < amount) {
        throw new Error(`Insufficient college credits. Required: ${amount}, Available: ${creditAccount?.balance ?? 0}`);
      }

      // 2. Decrement college credit account
      const updatedAccount = await tx.collegeCreditAccount.update({
        where: { collegeId },
        data: {
          balance: { decrement: amount },
          totalDistributed: { increment: amount },
        },
      });

      // 3. Increment student balance
      const updatedUserCredit = await tx.userCredit.upsert({
        where: { userId: student.userId },
        create: {
          userId: student.userId,
          balance: amount,
        },
        update: {
          balance: { increment: amount },
        },
      });

      // 4. Log transaction
      const txn = await tx.collegeCreditTransaction.create({
        data: {
          collegeId,
          studentId: student.id,
          createdById: req.user!.id,
          type: "STUDENT_ASSIGNMENT",
          amount,
          balanceAfter: updatedAccount.balance,
          reason,
        },
      });

      return {
        updatedAccount,
        updatedUserCredit,
        txn,
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
      req.user!.isMainFaculty
    );

    const schema = z.object({
      creditsPerStudent: z.number().int().min(1, "Credits per student must be at least 1"),
      reason: z.string().min(3, "Reason is required"),
      filters: z.object({
        program: z.string().optional(),
        course: z.string().optional(),
        section: z.string().optional(),
        batch: z.string().optional(),
        studentIds: z.array(z.string()).optional(),
      }),
    });

    const { creditsPerStudent, reason, filters } = schema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Build filter query
      const where: any = { collegeId, status: "active", ...scopeConditions };
      if (filters.program) where.program = filters.program;
      if (filters.course) where.course = filters.course;
      if (filters.section) where.section = filters.section;
      if (filters.batch) where.batch = filters.batch;
      if (filters.studentIds && filters.studentIds.length > 0) {
        where.id = { in: filters.studentIds };
      }

      // 2. Fetch eligible students
      const students = await tx.collegeStudent.findMany({
        where,
        select: { id: true, userId: true, enrollmentNumber: true },
      });

      if (students.length === 0) {
        throw new Error("No eligible active students found matching the selected filter criteria.");
      }

      const totalRequired = students.length * creditsPerStudent;

      // 3. Lock and verify college credit account
      const creditAccount = await tx.collegeCreditAccount.findUnique({
        where: { collegeId },
      });

      if (!creditAccount || creditAccount.balance < totalRequired) {
        throw new Error(
          `Insufficient college credits. Required: ${totalRequired}, Available: ${creditAccount?.balance ?? 0}`
        );
      }

      // 4. Decrement college credit balance
      const updatedAccount = await tx.collegeCreditAccount.update({
        where: { collegeId },
        data: {
          balance: { decrement: totalRequired },
          totalDistributed: { increment: totalRequired },
        },
      });

      // 5. Increment each student's credit balance and log credit transaction
      for (const student of students) {
        await tx.userCredit.upsert({
          where: { userId: student.userId },
          create: {
            userId: student.userId,
            balance: creditsPerStudent,
          },
          update: {
            balance: { increment: creditsPerStudent },
          },
        });

        await tx.collegeCreditTransaction.create({
          data: {
            collegeId,
            studentId: student.id,
            createdById: req.user!.id,
            type: "FACULTY_DISTRIBUTION",
            amount: creditsPerStudent,
            balanceAfter: updatedAccount.balance,
            reason,
            batchFilter: filters,
          },
        });
      }

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

// GET /api/enterprise/credits/ledger - Audit ledger of all credit allocations/distributions
router.get("/credits/ledger", requirePermission("INTERVIEW_CREDIT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const type = req.query.type as string;
    const search = ((req.query.search as string) || "").trim();
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = { collegeId };
    if (type) where.type = type;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { reason: { contains: search, mode: "insensitive" } },
        { createdBy: { name: { contains: search, mode: "insensitive" } } },
        { createdBy: { email: { contains: search, mode: "insensitive" } } },
        { student: { enrollmentNumber: { contains: search, mode: "insensitive" } } },
        { student: { user: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

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

// GET /api/enterprise/reports - Filtered reports across cohort with scores, readiness, & analytics
router.get("/reports", requirePermission("REPORT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.isMainFaculty
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

    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

    const where: any = { collegeId, ...scopeConditions };
    if (status) where.status = status;
    if (program) where.program = program;
    if (course) where.course = course;
    if (section) where.section = section;
    if (batch) where.batch = batch;

    if (search) {
      where.OR = [
        { enrollmentNumber: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const students = await prisma.collegeStudent.findMany({
      where,
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
              include: {
                report: true,
              },
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

    let reportData = students.map((s) => {
      const sessions = s.user.interviewSessions;
      const completedSessions = sessions.filter((sess) => sess.report !== null);
      const averageScore =
        completedSessions.length > 0
          ? Math.round(
              completedSessions.reduce((acc, curr) => acc + (curr.report?.overallScore ?? 0), 0) /
                completedSessions.length
            )
          : null;

      const latestSession = completedSessions[0];

      let readinessRating: "Job-Ready" | "Moderate" | "Needs Practice" | "Not Attempted" = "Not Attempted";
      if (averageScore !== null) {
        if (averageScore >= 80) readinessRating = "Job-Ready";
        else if (averageScore >= 60) readinessRating = "Moderate";
        else readinessRating = "Needs Practice";
      }

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
        latestScore: latestSession?.report?.overallScore ?? null,
        latestTargetRole: latestSession?.targetRole ?? null,
        latestInterviewDate: latestSession?.createdAt ?? null,
        hasResume: s.user.resumes.length > 0,
        latestResume: s.user.resumes[0] ?? null,
      };
    });

    // Apply score tier filter in memory if provided
    if (scoreTier) {
      if (scoreTier === "high") {
        reportData = reportData.filter((r) => r.averageScore !== null && r.averageScore >= 80);
      } else if (scoreTier === "moderate") {
        reportData = reportData.filter((r) => r.averageScore !== null && r.averageScore >= 60 && r.averageScore < 80);
      } else if (scoreTier === "needs_improvement") {
        reportData = reportData.filter((r) => r.averageScore !== null && r.averageScore < 60);
      } else if (scoreTier === "untested") {
        reportData = reportData.filter((r) => r.averageScore === null);
      }
    }

    // Apply sorting
    if (sortBy === "averageScore") {
      reportData.sort((a, b) => {
        const scoreA = a.averageScore ?? -1;
        const scoreB = b.averageScore ?? -1;
        return sortOrder === "asc" ? scoreA - scoreB : scoreB - scoreA;
      });
    } else if (sortBy === "name") {
      reportData.sort((a, b) =>
        sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      );
    } else if (sortBy === "enrollmentNumber") {
      reportData.sort((a, b) =>
        sortOrder === "asc"
          ? a.enrollmentNumber.localeCompare(b.enrollmentNumber)
          : b.enrollmentNumber.localeCompare(a.enrollmentNumber)
      );
    } else if (sortBy === "latestInterviewDate") {
      reportData.sort((a, b) => {
        const dateA = a.latestInterviewDate ? new Date(a.latestInterviewDate).getTime() : 0;
        const dateB = b.latestInterviewDate ? new Date(b.latestInterviewDate).getTime() : 0;
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
    }

    // Cohort Aggregate Summary KPIs
    const testedStudents = reportData.filter((r) => r.averageScore !== null);
    const cohortAverage =
      testedStudents.length > 0
        ? Math.round(
            testedStudents.reduce((acc, curr) => acc + (curr.averageScore ?? 0), 0) /
              testedStudents.length
          )
        : 0;

    const summary = {
      totalStudentsInView: reportData.length,
      jobReadyCount: reportData.filter((r) => r.readinessRating === "Job-Ready").length,
      moderateCount: reportData.filter((r) => r.readinessRating === "Moderate").length,
      needsPracticeCount: reportData.filter((r) => r.readinessRating === "Needs Practice").length,
      untestedCount: reportData.filter((r) => r.readinessRating === "Not Attempted").length,
      cohortAverage,
    };

    // Apply pagination to result
    const total = reportData.length;
    const paginatedData = reportData.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      summary,
      // 'reports' key matches EnterpriseDashboardPage frontend expectation
      reports: paginatedData,
      // Also expose as 'data' for backward compat
      data: paginatedData,
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
      req.user!.isMainFaculty
    );

    const program = req.query.program as string;
    const course = req.query.course as string;
    const section = req.query.section as string;
    const batch = req.query.batch as string;

    const where: any = { collegeId, ...scopeConditions };
    if (program) where.program = program;
    if (course) where.course = course;
    if (section) where.section = section;
    if (batch) where.batch = batch;

    const students = await prisma.collegeStudent.findMany({
      where,
      select: {
        user: {
          select: {
            interviewSessions: {
              where: { status: "completed" },
              select: {
                report: {
                  select: { overallScore: true },
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
          const score = sess.report.overallScore;
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
router.get("/reports/export", requirePermission("REPORT_EXPORT"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.isMainFaculty
    );

    const format = ((req.query.format as string) || "csv").toLowerCase();
    const search = ((req.query.search as string) || "").trim();
    const program = req.query.program as string;
    const course = req.query.course as string;
    const section = req.query.section as string;
    const batch = req.query.batch as string;
    const status = req.query.status as string;

    const where: any = { collegeId, ...scopeConditions };
    if (status) where.status = status;
    if (program) where.program = program;
    if (course) where.course = course;
    if (section) where.section = section;
    if (batch) where.batch = batch;

    if (search) {
      where.OR = [
        { enrollmentNumber: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

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

    const exportRows = students.map((s) => {
      const completedSessions = s.user.interviewSessions.filter((sess) => sess.report !== null);
      const averageScore =
        completedSessions.length > 0
          ? Math.round(
              completedSessions.reduce((acc, curr) => acc + (curr.report?.overallScore ?? 0), 0) /
                completedSessions.length
            )
          : null;
      const latestSession = completedSessions[0];

      let readiness = "Not Attempted";
      if (averageScore !== null) {
        if (averageScore >= 80) readiness = "Job-Ready";
        else if (averageScore >= 60) readiness = "Moderate";
        else readiness = "Needs Practice";
      }

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
        "Latest Score": latestSession?.report?.overallScore ?? "N/A",
        "Latest Target Role": sanitizeSpreadsheetCell(latestSession?.targetRole || "N/A"),
        "Has Resume": s.user.resumes.length > 0 ? "Yes" : "No",
      };
    });

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
    const headers = [
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
      "Has Resume",
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
});

// ===========================================================================
// 6. ENTERPRISE AUDIT LOGS (PHASE 13)
// ===========================================================================

// GET /api/enterprise/audit-logs - Query college-scoped audit ledger
router.get("/audit-logs", requirePermission("REPORT_VIEW"), async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const action = req.query.action as string;
    const search = ((req.query.search as string) || "").trim();
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = { collegeId };
    if (action) where.action = action;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
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

    res.json({
      success: true,
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        actor: {
          id: l.actor?.id,
          name: l.actor?.name,
          email: l.actor?.email,
          role: l.actor?.role,
        },
        oldValue: l.oldValue,
        newValue: l.newValue,
        ipAddress: l.ipAddress,
        metadata: l.metadata,
        createdAt: l.createdAt,
      })),
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

export default router;
