import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireTenant, requireCollegeAdmin, requirePermission } from "../../middleware/tenant.js";
import { EmailService } from "../../services/email.service.js";
import { logEnterpriseAudit } from "../../services/audit.service.js";
import { env } from "../../config/env.js";

const router = Router();

// Enforce authentication and active college tenant context for all enterprise routes
router.use(requireAuth, requireTenant);

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

// GET /api/enterprise/filter-options - Distinct programs, courses, sections, and batches
router.get("/filter-options", async (req, res, next) => {
  try {
    const collegeId = req.collegeId!;
    const scopeConditions = await getFacultyScopeConditions(
      req.user!.id,
      collegeId,
      req.user!.isMainFaculty
    );

    const [programs, courses, sections, batches] = await Promise.all([
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
    ]);

    res.json({
      success: true,
      programs: programs.map((p) => p.program).filter(Boolean),
      courses: courses.map((c) => c.course).filter(Boolean),
      sections: sections.map((s) => s.section).filter(Boolean),
      batches: batches.map((b) => b.batch).filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================================================
// 1. DASHBOARD OVERVIEW METRICS
// ===========================================================================

router.get("/dashboard/stats", async (req, res, next) => {
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
      creditAccount,
      interviewSessionsCount,
      reportsGeneratedCount,
      programs,
      courses,
      sections,
    ] = await Promise.all([
      prisma.college.findUnique({ where: { id: collegeId } }),
      prisma.collegeStudent.count({ where: { collegeId, ...scopeConditions } }),
      prisma.collegeStudent.count({ where: { collegeId, status: "active", ...scopeConditions } }),
      prisma.collegeFaculty.count({ where: { collegeId, status: "active" } }),
      prisma.collegeCreditAccount.findUnique({ where: { collegeId } }),
      prisma.interviewSession.count({ where: { collegeId } }),
      prisma.interviewSession.count({
        where: {
          collegeId,
          report: { isNot: null },
        },
      }),
      prisma.collegeStudent.groupBy({
        by: ["program"],
        where: { collegeId, ...scopeConditions },
      }),
      prisma.collegeStudent.groupBy({
        by: ["course"],
        where: { collegeId, ...scopeConditions },
      }),
      prisma.collegeStudent.groupBy({
        by: ["section"],
        where: { collegeId, ...scopeConditions },
      }),
    ]);

    res.json({
      success: true,
      college: {
        id: college?.id,
        name: college?.name,
        code: college?.code,
        universityName: college?.universityName,
      },
      stats: {
        totalStudents,
        activeStudents,
        totalFaculty,
        availableCredits: creditAccount?.balance ?? 0,
        totalCreditsAllocated: creditAccount?.totalAllocated ?? 0,
        totalCreditsDistributed: creditAccount?.totalDistributed ?? 0,
        totalInterviewSessions: interviewSessionsCount,
        reportsGenerated: reportsGeneratedCount,
        programsCount: programs.length,
        coursesCount: courses.length,
        sectionsCount: sections.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

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

    res.json({
      success: true,
      data: faculties.map((f) => ({
        id: f.id,
        userId: f.userId,
        name: f.user.name,
        email: f.user.email,
        phone: f.user.phone,
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

    const result = await prisma.$transaction(async (tx) => {
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
    });

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
      department: z.string().optional(),
      designation: z.string().optional(),
      permissions: z.array(z.string()).optional(),
      programAccess: z.array(z.string()).optional(),
      courseAccess: z.array(z.string()).optional(),
      sectionAccess: z.array(z.string()).optional(),
      status: z.enum(["active", "inactive", "suspended"]).optional(),
    });

    const data = schema.parse(req.body);

    const updated = await prisma.collegeFaculty.update({
      where: { id },
      data,
    });

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
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              credits: true,
              isActive: true,
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

    res.json({
      success: true,
      data: students.map((s) => ({
        id: s.id,
        userId: s.userId,
        enrollmentNumber: s.enrollmentNumber,
        name: s.user.name,
        email: s.user.email,
        phone: s.user.phone,
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
        createdAt: s.createdAt,
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

    res.json({
      success: true,
      student: {
        id: student.id,
        userId: student.userId,
        enrollmentNumber: student.enrollmentNumber,
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

    // Temporary credentials & invitation token
    const rawTempPassword = `Std#${crypto.randomBytes(4).toString("hex")}!1`;
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

      // 2. Create or update user
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

      // 6. Create Invitation
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
    });

    // Send invitation email
    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    const activationLink = `${frontendUrl}/login?invite=${rawToken}&email=${encodeURIComponent(data.email)}`;

    await EmailService.sendStudentInvitation({
      to: data.email,
      recipientName: data.name,
      collegeName: college.name,
      enrollmentNumber: data.enrollmentNumber,
      activationLink,
      tempPassword: rawTempPassword,
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
      },
    });

    res.status(201).json({
      success: true,
      message: `Student "${data.name}" added and invited successfully.`,
      student: result.studentProfile,
      invitationToken: env.NODE_ENV !== "production" ? rawToken : undefined,
      tempPassword: env.NODE_ENV !== "production" ? rawTempPassword : undefined,
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
router.post("/credits/preview", requirePermission("INTERVIEW_CREDIT_ASSIGN"), async (req, res, next) => {
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
      }),
    });

    const { creditsPerStudent, filters } = schema.parse(req.body);

    const where: any = { collegeId, status: "active", ...scopeConditions };
    if (filters.program) where.program = filters.program;
    if (filters.course) where.course = filters.course;
    if (filters.section) where.section = filters.section;
    if (filters.batch) where.batch = filters.batch;
    if (filters.studentIds && filters.studentIds.length > 0) {
      where.id = { in: filters.studentIds };
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
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/enterprise/credits/student-assign - Assign or adjust credits for a single student
router.post("/credits/student-assign", requirePermission("INTERVIEW_CREDIT_ASSIGN"), async (req, res, next) => {
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
          type: "FACULTY_DISTRIBUTION",
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
});

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

    res.json({
      success: true,
      data: transactions.map((t) => ({
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
      data: paginatedData,
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
