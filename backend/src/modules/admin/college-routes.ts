import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../../db/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { EmailService } from "../../services/email.service.js";
import { logEnterpriseAudit } from "../../services/audit.service.js";
import { env } from "../../config/env.js";

const router = Router();

// Only platform super_admin or admin can access platform college management
router.use(requireAuth, requireRole(["super_admin", "admin"]));

const createCollegeSchema = z.object({
  name: z.string().min(2, "College name is required"),
  universityName: z.string().optional(),
  code: z.string().min(2, "College code is required").toUpperCase(),
  officialEmail: z.string().email("Valid official email is required"),
  contactPhone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("India"),
  initialCredits: z.number().int().min(0).default(500),
  mainFaculty: z.object({
    name: z.string().min(2, "Main faculty name is required"),
    email: z.string().email("Main faculty email is required"),
    phone: z.string().optional(),
    department: z.string().optional(),
    designation: z.string().optional().default("Head of Placement / Dean"),
  }),
});

// POST /api/admin/colleges - Create new college, credit account, and invite Main Faculty
router.post("/", async (req, res, next) => {
  try {
    const data = createCollegeSchema.parse(req.body);

    const existingCollege = await prisma.college.findFirst({
      where: {
        OR: [{ code: data.code }, { officialEmail: data.officialEmail }],
      },
    });

    if (existingCollege) {
      return res.status(400).json({
        success: false,
        message: "A college with this code or official email already exists.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.mainFaculty.email },
    });

    if (existingUser && existingUser.collegeId) {
      return res.status(400).json({
        success: false,
        message: "A user with the main faculty email is already affiliated with a college.",
      });
    }

    // Generate secure temporary password & invitation token
    const rawTempPassword = `Rr#${crypto.randomBytes(4).toString("hex")}!9`;
    const passwordHash = await bcrypt.hash(rawTempPassword, 10);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Create College
        const college = await tx.college.create({
          data: {
            name: data.name,
            universityName: data.universityName,
            code: data.code,
            officialEmail: data.officialEmail,
            contactPhone: data.contactPhone,
            website: data.website || undefined,
            address: data.address,
            city: data.city,
            state: data.state,
            country: data.country,
            status: "active",
          },
        });

        // 2. Initialize College Credit Account
        const creditAccount = await tx.collegeCreditAccount.create({
          data: {
            collegeId: college.id,
            totalAllocated: data.initialCredits,
            totalDistributed: 0,
            balance: data.initialCredits,
          },
        });

        // 3. Create or update Main Faculty User
        let facultyUser = existingUser;
        if (!facultyUser) {
          facultyUser = await tx.user.create({
            data: {
              name: data.mainFaculty.name,
              email: data.mainFaculty.email,
              passwordHash,
              role: "college_main_faculty",
              collegeId: college.id,
              phone: data.mainFaculty.phone,
              isActive: true,
            },
          });
        } else {
          facultyUser = await tx.user.update({
            where: { id: facultyUser.id },
            data: {
              role: "college_main_faculty",
              collegeId: college.id,
              passwordHash,
              isActive: true,
            },
          });
        }

      // 4. Create Main Faculty Profile
      const facultyProfile = await tx.collegeFaculty.create({
        data: {
          userId: facultyUser.id,
          collegeId: college.id,
          department: data.mainFaculty.department,
          designation: data.mainFaculty.designation,
          isMainFaculty: true,
          permissions: [
            "STUDENT_VIEW",
            "STUDENT_CREATE",
            "STUDENT_EDIT",
            "STUDENT_DELETE",
            "FACULTY_VIEW",
            "FACULTY_CREATE",
            "FACULTY_EDIT",
            "REPORT_VIEW",
            "REPORT_EXPORT",
            "INTERVIEW_CREDIT_VIEW",
            "INTERVIEW_CREDIT_ASSIGN",
          ],
          status: "active",
        },
      });

      // 5. Create Credit Transaction record for initial allocation
      if (data.initialCredits > 0) {
        await tx.collegeCreditTransaction.create({
          data: {
            collegeId: college.id,
            createdById: req.user!.id,
            type: "SUPER_ADMIN_ALLOCATION",
            amount: data.initialCredits,
            balanceAfter: data.initialCredits,
            reason: `Initial credit allocation upon onboarding ${college.name}`,
          },
        });
      }

      // 6. Create Invitation record
      const invitation = await tx.invitation.create({
        data: {
          collegeId: college.id,
          email: data.mainFaculty.email,
          role: "college_main_faculty",
          tokenHash,
          expiresAt,
          status: "pending",
          invitedById: req.user!.id,
          metadata: {
            name: data.mainFaculty.name,
            department: data.mainFaculty.department,
            designation: data.mainFaculty.designation,
            isMainFaculty: true,
          },
        },
      });

      return { college, creditAccount, facultyUser, facultyProfile, invitation };
    },
    {
      maxWait: 20000,
      timeout: 60000,
    });

    // Send invitation email
    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    const activationLink = `${frontendUrl}/login?invite=${rawToken}&email=${encodeURIComponent(data.mainFaculty.email)}`;

    await EmailService.sendFacultyInvitation({
      to: data.mainFaculty.email,
      recipientName: data.mainFaculty.name,
      collegeName: data.name,
      isMainFaculty: true,
      activationLink,
      tempPassword: rawTempPassword,
    });

    // Log Enterprise Audit
    await logEnterpriseAudit({
      collegeId: result.college.id,
      actorId: req.user!.id,
      action: "COLLEGE_CREATED",
      entity: "College",
      entityId: result.college.id,
      newValue: {
        name: result.college.name,
        code: result.college.code,
        initialCredits: data.initialCredits,
        mainFacultyEmail: data.mainFaculty.email,
      },
    });

    res.status(201).json({
      success: true,
      message: `College "${result.college.name}" created successfully. Invitation sent to Main Faculty.`,
      college: result.college,
      creditBalance: result.creditAccount.balance,
      invitationToken: env.NODE_ENV !== "production" ? rawToken : undefined,
      tempPassword: env.NODE_ENV !== "production" ? rawTempPassword : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/colleges - List all colleges with metrics
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const search = ((req.query.search as string) || "").trim();
    const status = req.query.status as string;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { officialEmail: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, colleges] = await Promise.all([
      prisma.college.count({ where }),
      prisma.college.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          creditAccount: true,
          _count: {
            select: {
              students: true,
              faculties: true,
              interviewSessions: true,
            },
          },
          faculties: {
            where: { isMainFaculty: true },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
            take: 1,
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: colleges.map((c) => ({
        id: c.id,
        name: c.name,
        universityName: c.universityName,
        code: c.code,
        officialEmail: c.officialEmail,
        contactPhone: c.contactPhone,
        city: c.city,
        state: c.state,
        status: c.status,
        createdAt: c.createdAt,
        creditBalance: c.creditAccount?.balance ?? 0,
        totalCreditsAllocated: c.creditAccount?.totalAllocated ?? 0,
        totalCreditsDistributed: c.creditAccount?.totalDistributed ?? 0,
        studentCount: c._count.students,
        facultyCount: c._count.faculties,
        interviewCount: c._count.interviewSessions,
        mainFaculty: c.faculties[0]
          ? {
              id: c.faculties[0].id,
              name: c.faculties[0].user.name,
              email: c.faculties[0].user.email,
              phone: c.faculties[0].user.phone,
              department: c.faculties[0].department,
              designation: c.faculties[0].designation,
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

// GET /api/admin/colleges/:id - Get single college details
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const college = await prisma.college.findUnique({
      where: { id },
      include: {
        creditAccount: true,
        _count: {
          select: {
            students: true,
            faculties: true,
            interviewSessions: true,
            resumes: true,
          },
        },
        faculties: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true, role: true },
            },
          },
        },
      },
    });

    if (!college) {
      return res.status(404).json({ success: false, message: "College not found" });
    }

    res.json({ success: true, college });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/colleges/:id/credits - Super Admin allocates credits to college
router.post("/:id/credits", async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      amount: z.number().int().min(1, "Amount must be at least 1 credit"),
      reason: z.string().min(3, "Reason for credit allocation is required"),
    });

    const { amount, reason } = schema.parse(req.body);

    const college = await prisma.college.findUnique({
      where: { id },
      include: {
        creditAccount: true,
        faculties: {
          where: { isMainFaculty: true },
          include: { user: true },
          take: 1,
        },
      },
    });

    if (!college) {
      return res.status(404).json({ success: false, message: "College not found" });
    }

    const updatedAccount = await prisma.$transaction(
      async (tx) => {
        const account = await tx.collegeCreditAccount.upsert({
          where: { collegeId: id },
          create: {
            collegeId: id,
            totalAllocated: amount,
            totalDistributed: 0,
            balance: amount,
          },
          update: {
            totalAllocated: { increment: amount },
            balance: { increment: amount },
          },
        });

        await tx.collegeCreditTransaction.create({
          data: {
            collegeId: id,
            createdById: req.user!.id,
            type: "SUPER_ADMIN_ALLOCATION",
            amount,
            balanceAfter: account.balance,
            reason,
          },
        });

        return account;
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    // Notify Main Faculty via email
    if (college.faculties[0]?.user?.email) {
      await EmailService.sendCreditAllocationNotice({
        to: college.faculties[0].user.email,
        collegeName: college.name,
        creditsAllocated: amount,
        totalBalance: updatedAccount.balance,
        reason,
      });
    }

    await logEnterpriseAudit({
      collegeId: id,
      actorId: req.user!.id,
      action: "CREDITS_ALLOCATED",
      entity: "CollegeCreditAccount",
      entityId: updatedAccount.id,
      newValue: { amount, balanceAfter: updatedAccount.balance, reason },
    });

    res.json({
      success: true,
      message: `Successfully allocated ${amount} credits to ${college.name}.`,
      creditBalance: updatedAccount.balance,
      totalAllocated: updatedAccount.totalAllocated,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/colleges/:id - Update status or details
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(2).optional(),
      universityName: z.string().optional(),
      status: z.enum(["active", "inactive", "suspended"]).optional(),
      contactPhone: z.string().optional(),
      website: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const existing = await prisma.college.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "College not found" });
    }

    const updated = await prisma.college.update({
      where: { id },
      data,
    });

    await logEnterpriseAudit({
      collegeId: id,
      actorId: req.user!.id,
      action: "COLLEGE_UPDATED",
      entity: "College",
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, college: updated });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/colleges/:id/credit-ledger - Super Admin view credit transaction ledger for a college
router.get("/:id/credit-ledger", async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const type = req.query.type as string;

    const where: any = { collegeId: id };
    if (type) where.type = type;

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
      data: transactions,
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
